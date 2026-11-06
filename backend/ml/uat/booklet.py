"""The self-guided tester pack: one page and one statement file per tester (ADR D-67).

    cd backend && uv run python -m ml.uat.booklet --roster ../uat/testers.csv --session 2026-11-08 \
        --app-url https://<app>.vercel.app --form-a <link> --form-b <link> --out ../uat/data/pack

For each tester it writes `<out>/<participant>/PaySense-UAT-<participant>.html` (a single page that
reads on a phone and prints) and `student-statement.csv`, the persona's history moved forward so it
ends just before the session date. Username, provider, limit and every purchase come from the
roster and `uat/purchase-cards.yaml`, so nothing is typed by hand. The page never names a result,
a persona or a feature: it gives context and goals only (see the plan, section 1). The answer key
(`reports/uat/purchase_cards.md`) is never read here.
"""

import argparse
import base64
import html
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse

from app.domain.providers import PROVIDERS
from app.engines.forecasting.service import STALE_AFTER_DAYS
from ml.uat.load import UatDataError, load_vignettes
from ml.uat.purchase_cards import CARDS_PATH, Card, PersonaCards, load_cards
from ml.uat.roster import Tester, load_roster, refuse_example_usernames
from ml.uat.shift_persona import DATE_FORMAT, PERSONA_DIR, read_rows, shift_rows, write_rows

ROOT = Path(__file__).resolve().parents[3]
TEMPLATE_PATH = ROOT / "uat" / "booklet-template.html"
VIGNETTES_PATH = ROOT / "uat" / "vignettes.yaml"
STATEMENT_NAME = "student-statement.csv"
SEN_PER_RINGGIT = 100
DAY_FORMAT = "%d %B %Y"


@dataclass(frozen=True)
class Links:
    app_url: str
    form_a_url: str
    form_b_url: str

    def __post_init__(self) -> None:
        for name in ("app_url", "form_a_url", "form_b_url"):
            parsed = urlparse(getattr(self, name))
            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                raise UatDataError(f"{name}: the link must start with http:// or https://")


def ordered_cards(persona: PersonaCards) -> tuple[Card, ...]:
    """The card behind the tester's scenario first, so their second answer to the scenario follows
    the check it refers to; the others keep the order of the cards file."""
    behind = next((c for c in persona.cards if c.vignette is not None), None)
    if behind is None:
        raise UatDataError("a persona needs one card that belongs to a scenario")
    return (behind, *(c for c in persona.cards if c is not behind))


def _ringgit(sen: int) -> str:
    return f"RM {sen // SEN_PER_RINGGIT:,}"


def _fee(card: Card) -> str:
    return "none" if card.monthly_fee_pct == 0 else f"{card.monthly_fee_pct:g}% a month"


def _card_html(number: int, total: int, card: Card, provider: str) -> str:
    rows = (
        ("Item", html.escape(card.item)),
        ("Price", _ringgit(card.price_sen)),
        ("Pay with", html.escape(provider)),
        ("Pay in", f"{card.instalments} instalments"),
        ("Extra fee", html.escape(_fee(card))),
        ("Purchase date", "today (leave it as it is)"),
    )
    body = "".join(f"<div><dt>{label}</dt><dd>{value}</dd></div>" for label, value in rows)
    return (
        f'<section class="card" aria-labelledby="p{number}">'
        f'<h3 id="p{number}">Purchase {number} of {total}</h3><dl>{body}</dl></section>'
    )


def _download_link(statement_csv: str) -> str:
    """The statement as a link that downloads it, carried inside the page itself so the one file
    the tester receives is all they need."""
    data = base64.b64encode(statement_csv.encode("utf-8")).decode("ascii")
    return f'<a download="{STATEMENT_NAME}" href="data:text/csv;base64,{data}">{STATEMENT_NAME}</a>'


def render_pack(
    tester: Tester,
    persona: PersonaCards,
    links: Links,
    last_transaction: date,
    statement_csv: str,
) -> str:
    """The tester's page. `last_transaction` is the newest date in their statement file, whose
    text is `statement_csv`."""
    provider = PROVIDERS[persona.provider].label
    cards = ordered_cards(persona)
    stays_current = last_transaction + timedelta(days=STALE_AFTER_DAYS)
    values = {
        "participant": html.escape(tester.participant),
        "username": html.escape(tester.username),
        "app_url": html.escape(links.app_url, quote=True),
        "form_a_url": html.escape(links.form_a_url, quote=True),
        "form_b_url": html.escape(links.form_b_url, quote=True),
        "statement_link": _download_link(statement_csv),
        "last_day": stays_current.strftime(DAY_FORMAT),
        "provider": html.escape(provider),
        "limit": _ringgit(persona.limit_sen),
        "cards": "".join(
            _card_html(n, len(cards), card, provider) for n, card in enumerate(cards, start=1)
        ),
        "card_count": str(len(cards)),
    }
    page = TEMPLATE_PATH.read_text(encoding="utf-8")
    for key, value in values.items():
        page = page.replace("{{" + key + "}}", value)
    return page


def build_packs(
    testers: Sequence[Tester],
    out_dir: Path,
    session: date,
    links: Links,
    cards: Mapping[str, PersonaCards] | None = None,
) -> list[Path]:
    """Write every tester's folder; returns the pages. Refuses the template's example usernames."""
    refuse_example_usernames(list(testers))
    by_persona = cards or load_cards(CARDS_PATH, load_vignettes(VIGNETTES_PATH))
    pages: list[Path] = []
    for tester in testers:
        if tester.persona not in by_persona:
            raise UatDataError(f"{tester.participant}: no purchase cards for {tester.persona}")
        source = PERSONA_DIR / f"{tester.persona}.csv"
        shifted = shift_rows(read_rows(source), session)
        folder = out_dir / tester.participant
        write_rows(folder / STATEMENT_NAME, shifted)
        ends = max(datetime.strptime(r["Date"], DATE_FORMAT).date() for r in shifted)
        statement = (folder / STATEMENT_NAME).read_bytes().decode("utf-8")
        page = folder / f"PaySense-UAT-{tester.participant}.html"
        page.write_text(
            render_pack(tester, by_persona[tester.persona], links, ends, statement),
            encoding="utf-8",
        )
        pages.append(page)
    return pages


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--roster", type=Path, required=True)
    parser.add_argument("--session", type=date.fromisoformat, required=True, help="YYYY-MM-DD")
    parser.add_argument("--app-url", required=True)
    parser.add_argument("--form-a", required=True)
    parser.add_argument("--form-b", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        links = Links(args.app_url, args.form_a, args.form_b)
        pages = build_packs(load_roster(args.roster), args.out, args.session, links)
    except (UatDataError, FileNotFoundError) as err:
        print(f"Cannot build the packs: {err}", file=sys.stderr)
        return 2
    for page in pages:
        print(f"Wrote {page}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
