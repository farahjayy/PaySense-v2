"""Purchase cards for the self-guided UAT (plan 2026-10-22-uat-purchase-cards).

    cd backend && uv run python -m ml.uat.purchase_cards [--out ../reports/uat/purchase_cards.md]

`uat/purchase-cards.yaml` holds, per persona, one provider limit to record and three purchases to
check. This module validates that file and measures every card through the same `run_check` the
browser's request ends in, with the limit applied, on each study day and for several random seeds
(the app seeds per user and day), in the two ways a tester can arrive: every Recurring suggestion
confirmed (the instructed path) or the suggestions left alone. The generated report is the answer
key for us; testers never see an expected result.
"""

import argparse
import csv
import io
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from app.domain.csv_import import parse_csv
from app.domain.providers import PROVIDERS
from app.domain.schedule import MAX_INSTALMENTS, MIN_INSTALMENTS
from app.engines.forecasting.simulate import CAUTION_BELOW, SAFE_BELOW, health_score
from app.engines.risk.check import RiskRequest
from ml.datagen.personas import CHECK_DAY_OFFSETS, PERSONA_AS_OF
from ml.uat.load import UatDataError, Vignette
from ml.uat.shift_persona import COLUMNS, read_rows, shift_rows
from ml.uat.shown_check import check_card, confirmed_items

ROOT = Path(__file__).resolve().parents[3]
CARDS_PATH = ROOT / "uat" / "purchase-cards.yaml"
PERSONA_DIR = ROOT / "data" / "personas"
DEFAULT_REPORT = ROOT / "reports" / "uat" / "purchase_cards.md"
BANDS = ("Safe", "Caution", "At Risk")
SEEDS = (1, 2, 3, 4, 5)
NEAR_EDGE = 0.02  # a probability this close to a band edge is flagged in the report
MAX_FEE_PCT = 30.0  # the API's own ceiling on the monthly fee
SEN_PER_RINGGIT = 100


@dataclass(frozen=True)
class Card:
    id: str
    item: str
    price_sen: int
    instalments: int
    monthly_fee_pct: float
    vignette: str | None
    expected_band: str


@dataclass(frozen=True)
class PersonaCards:
    provider: str
    limit_sen: int
    cards: tuple[Card, ...]


@dataclass(frozen=True)
class PathResult:
    bands: frozenset[str]
    low: float  # lowest shown probability over every study day and seed
    high: float


@dataclass(frozen=True)
class CardMeasure:
    confirmed: PathResult
    raw: PathResult
    financed_sen: int
    upfront_sen: int  # the part above the recorded limit, paid at checkout
    checkout_sen: int  # all cash due on the purchase date (adds Atome's first payment)


def _fail(path: Path, message: str) -> UatDataError:
    return UatDataError(f"{path.name}: {message}")


def _card(
    path: Path, persona: str, raw: Mapping[str, Any], vignettes: Mapping[str, Vignette]
) -> Card:
    card_id = str(raw.get("id", "")).strip()
    where = f"{persona} card {card_id or '?'}"
    price, count = raw.get("price_rm"), raw.get("instalments")
    fee, band = raw.get("monthly_fee_pct", 0), raw.get("expected_band")
    vignette = raw.get("vignette")
    if not card_id or not str(raw.get("item", "")).strip():
        raise _fail(path, f"{where}: needs an id and an item")
    if not isinstance(price, int) or isinstance(price, bool) or price <= 0:
        raise _fail(path, f"{where}: price_rm must be a positive whole number of ringgit")
    if not isinstance(count, int) or not MIN_INSTALMENTS <= count <= MAX_INSTALMENTS:
        raise _fail(path, f"{where}: instalments must be {MIN_INSTALMENTS} to {MAX_INSTALMENTS}")
    if not isinstance(fee, int | float) or not 0 <= fee <= MAX_FEE_PCT:
        raise _fail(path, f"{where}: monthly_fee_pct must be between 0 and {MAX_FEE_PCT:g}")
    if band not in BANDS:
        raise _fail(path, f"{where}: expected_band must be one of {', '.join(BANDS)}")
    if vignette is not None and vignette not in vignettes:
        raise _fail(path, f"{where}: unknown vignette {vignette!r}")
    return Card(
        card_id,
        str(raw["item"]).strip(),
        price * SEN_PER_RINGGIT,
        count,
        float(fee),
        vignette,
        band,
    )


def load_cards(path: Path, vignettes: Mapping[str, Vignette]) -> dict[str, PersonaCards]:
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        personas = raw["personas"]
    except (yaml.YAMLError, KeyError, TypeError) as err:
        raise _fail(path, "not a valid purchase-cards file (a top-level 'personas' map)") from err
    out: dict[str, PersonaCards] = {}
    seen: set[str] = set()
    for persona, entry in personas.items():
        provider, limit = entry.get("provider"), entry.get("limit_rm")
        if provider not in PROVIDERS or not PROVIDERS[provider].rule_driven:
            raise _fail(path, f"{persona}: provider must be SPayLater, TikTok PayLater or Atome")
        if not isinstance(limit, int) or isinstance(limit, bool) or limit <= 0:
            raise _fail(path, f"{persona}: limit_rm must be a positive whole number of ringgit")
        cards = []
        for item in entry.get("cards") or []:
            card = _card(path, persona, item, vignettes)
            if card.id in seen:
                raise _fail(path, f"card id {card.id} is used twice")
            seen.add(card.id)
            cards.append(card)
        out[persona] = PersonaCards(provider, limit * SEN_PER_RINGGIT, tuple(cards))
    return out


@lru_cache(maxsize=1)
def _engines():
    from app.engines.forecasting.serving import served_forecaster
    from app.engines.risk.artefact import load_if_present

    predictor = load_if_present()
    if predictor is None:
        raise RuntimeError("the trained risk model is not in backend/models/engine2")
    return served_forecaster(), predictor


def _session_text(persona: str, session: date) -> str:
    """The persona file moved by whole weeks to end just before `session`: what `ml.uat.booklet`
    gives a tester for that session date."""
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=COLUMNS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(shift_rows(read_rows(PERSONA_DIR / f"{persona}.csv"), session))
    return out.getvalue()


def _ledger(persona: str, session: date | None = None) -> list[dict[str, Any]]:
    text = (
        _session_text(persona, session)
        if session
        else (PERSONA_DIR / f"{persona}.csv").read_text(encoding="utf-8")
    )
    return [
        {
            "date": r.date,
            "amount_sen": r.amount_sen,
            "type": r.type,
            "category": r.category_guess,
            "description": r.description,
        }
        for r in parse_csv(text).rows
    ]


def measure_persona(
    persona: str, entry: PersonaCards, session: date | None = None
) -> dict[str, CardMeasure]:
    """Every card of one persona on each study day, for each seed, on both paths.

    By default the committed persona file on the days it was built for. With `session`, the file a
    tester gets for that session date (moved forward by whole weeks), on the week from `session`."""
    forecaster, predictor = _engines()
    rows = _ledger(persona, session)
    as_of = session - timedelta(days=1) if session else PERSONA_AS_OF
    days = [as_of + timedelta(days=offset) for offset in CHECK_DAY_OFFSETS]
    items_by_day = {day: confirmed_items(rows, day) for day in days}
    limits = {entry.provider: entry.limit_sen}
    out: dict[str, CardMeasure] = {}
    for card in entry.cards:
        paths: dict[str, tuple[set[str], list[float]]] = {
            "confirmed": (set(), []),
            "raw": (set(), []),
        }
        split = (0, 0, 0)
        for day in days:
            request = RiskRequest(
                provider=entry.provider,
                item_name=card.item,
                purchase_date=day,
                num_installments=card.instalments,
                total_price_sen=card.price_sen,
                monthly_fee_rate_pct=card.monthly_fee_pct,
            )
            for path, items in (("confirmed", items_by_day[day]), ("raw", [])):
                for seed in SEEDS:
                    result = check_card(
                        rows, items, day, request, limits, forecaster, predictor, seed
                    )
                    if result.status != "ok" or result.band is None or result.probability is None:
                        raise RuntimeError(f"{persona} {card.id}: the forecast is locked on {day}")
                    paths[path][0].add(result.band)
                    paths[path][1].append(result.probability)
                    split = (
                        result.proposal.financed_sen,
                        result.proposal.upfront_sen,
                        result.proposal.cash_at_purchase_sen,
                    )
        out[card.id] = CardMeasure(
            confirmed=PathResult(frozenset(paths["confirmed"][0]), *_range(paths["confirmed"][1])),
            raw=PathResult(frozenset(paths["raw"][0]), *_range(paths["raw"][1])),
            financed_sen=split[0],
            upfront_sen=split[1],
            checkout_sen=split[2],
        )
    return out


def _range(values: Sequence[float]) -> tuple[float, float]:
    return min(values), max(values)


def _a(noun: str) -> str:
    return f"{'an' if noun[0].lower() in 'aeiou' else 'a'} {noun}"


def _ringgit(sen: int) -> str:
    return f"RM {sen // SEN_PER_RINGGIT:,}"


def _ringgit_sen(sen: int) -> str:
    return f"RM {sen // SEN_PER_RINGGIT:,}.{sen % SEN_PER_RINGGIT:02d}"


def _band_text(result: PathResult) -> str:
    return " / ".join(b for b in BANDS if b in result.bands)


def _span(low: int, high: int, unit: str = "") -> str:
    return f"{low}{unit}" if low == high else f"{low}-{high}{unit}"


def _shown(result: PathResult, *, bold: bool) -> str:
    """The result as the screen shows it: the band, the big score out of 100, and the chance of
    running short printed under it (the score is 100 minus that chance)."""
    band = _band_text(result)
    score = _span(health_score(result.high), health_score(result.low))
    chance = _span(round(result.low * 100), round(result.high * 100), "%")
    return f"{f'**{band}**' if bold else band}<br>score {score}<br>chance {chance}"


def _near_edge(result: PathResult) -> bool:
    return any(
        abs(p - edge) <= NEAR_EDGE
        for p in (result.low, result.high)
        for edge in (SAFE_BELOW, CAUTION_BELOW)
    )


def render_report(
    cards: Mapping[str, PersonaCards],
    measured: Mapping[str, Mapping[str, CardMeasure]],
    session: date | None = None,
) -> str:
    as_of = session - timedelta(days=1) if session else PERSONA_AS_OF
    days = f"{(as_of + timedelta(days=min(CHECK_DAY_OFFSETS))).isoformat()} to " + (
        (as_of + timedelta(days=max(CHECK_DAY_OFFSETS))).isoformat()
    )
    lines = [
        "# UAT purchase cards: answer key",
        "",
        "**For us only, not for testers.** Generated by `cd backend && uv run python -m "
        "ml.uat.purchase_cards`; do not edit by hand. Testers see the card (provider, item, price, "
        "instalments, fee) and the one limit to record, never the band below.",
        "",
        "Measured through the same check the browser calls, with the limit applied, on every "
        f"study day ({days}) and {len(SEEDS)} random seeds. The **instructed path** is every "
        "Recurring "
        "suggestion confirmed. The other path leaves the suggestions alone: the forecast then "
        "does not know the standing bills or instalments, and for some cards the answer is "
        "different. Each result is written as the screen shows it: the **band**, the big "
        "**score out of 100** in the ring, and the **chance** printed under it as "
        '"Estimated chance of running short" (the score is 100 minus the chance). Bands: Safe '
        "below 10% chance, Caution below 30%, At Risk from 30%. A range within 2 points of an "
        "edge is marked ⚠.",
        "",
    ]
    for persona, entry in cards.items():
        lines += [
            f"## {persona}: record {_a(PROVIDERS[entry.provider].label)} limit of "
            f"{_ringgit(entry.limit_sen)}",
            "",
            "| Card | Item | Price | Instalments | Fee | Provider pays / you pay now | "
            "Every suggestion confirmed | Suggestions left alone |",
            "|---|---|---|---|---|---|---|---|",
        ]
        for card in entry.cards:
            m = measured[persona][card.id]
            vignette = f" ({card.vignette})" if card.vignette else ""
            confirmed = _shown(m.confirmed, bold=True)
            raw = _shown(m.raw, bold=False)
            lines.append(
                f"| {card.id} | {card.item}{vignette} | {_ringgit(card.price_sen)} | "
                f"{card.instalments} | {card.monthly_fee_pct:g}% | "
                f"{_ringgit_sen(m.financed_sen)} / {_ringgit_sen(m.checkout_sen)} | "
                f"{confirmed}{' ⚠' if _near_edge(m.confirmed) else ''} | "
                f"{raw}{' ⚠' if _near_edge(m.raw) else ''} |"
            )
        lines.append("")
    return "\n".join(lines)


def main(argv: Sequence[str] | None = None) -> None:
    from ml.uat.load import load_vignettes

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument(
        "--session",
        type=date.fromisoformat,
        default=None,
        help="measure the files a tester gets for this session date (YYYY-MM-DD), on the week "
        "from that day, instead of the committed files on 25-31 October",
    )
    args = parser.parse_args(argv)
    out = args.out or (
        DEFAULT_REPORT.with_name(f"purchase_cards_session_{args.session}.md")
        if args.session
        else DEFAULT_REPORT
    )
    cards = load_cards(CARDS_PATH, load_vignettes(CARDS_PATH.parent / "vignettes.yaml"))
    measured = {
        persona: measure_persona(persona, entry, args.session) for persona, entry in cards.items()
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        render_report(cards, measured, args.session) + "\n", encoding="utf-8", newline="\n"
    )
    print(f"wrote {out}")  # noqa: T201 - command-line entry point


if __name__ == "__main__":
    main()
