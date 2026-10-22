"""The three UAT persona CSVs (plan P2, A10): `python -m ml.datagen.personas`.

Testers do not upload their own statements; each uploads a pre-made, persona-matched history of
at least four months (academic constraints, section 3). Every file is synthetic, built from a
fixed seed so the output is byte-for-byte reproducible, and chosen (deterministically) from the
first profile that actually shows what the persona exists to test.
"""

import csv
import io
from collections import Counter
from collections.abc import Callable
from datetime import date, timedelta
from pathlib import Path

from app.domain.categorize import BNPL, REFUND, TRANSFER
from app.domain.csv_import import parse_csv
from ml.datagen.params import Params, load_params
from ml.datagen.profile import StudentProfile, generate_profile

PERSONA_SEEDS = {"frequent_bnpl": 1101, "budget_conscious": 1202, "irregular_income": 1303}
SEARCH_LIMIT = 1000  # candidate profiles tried per persona before giving up
MIN_SHOWCASE_ROWS = 3
# "Frequent BNPL" has to be felt in the ledger: instalments of at least this share of monthly
# income (ASSUMED). Two plans costing RM 12 a month met the old rule of three rows, showing nothing.
MIN_BNPL_SHARE = 0.10
# The supervisor asks for at least four months before the forecast unlocks (history.persona_months);
# the forecast also needs 17 complete Monday-Sunday weeks, and four calendar months can hold fewer
# (a file that starts on a Tuesday has 16). One extra month leaves room, including for the shift to
# a session date. Kept here, not in params.yaml, so the labels' provenance hash is unchanged.
PERSONA_EXTRA_MONTHS = 1
# The UAT runs 25-31 October 2026. The histories end the day before it opens, so every row is in
# the past for every tester and nobody imports a ledger with dated-in-the-future transactions;
# the last test day is then 7 days after the last row, well inside the 14 the forecast allows.
PERSONA_AS_OF = date(2026, 10, 24)
# The forecast looks three months ahead from the day a tester opens it, so the same ledger can read
# differently on different days. A persona must tell purchases apart on every day of the study.
CHECK_DAY_OFFSETS = tuple(range(1, 8))
# Whether a persona must also have a purchase that comes out Safe. A student with a large standing
# BNPL load sits in one band whatever they add (of the 51 heavy-BNPL candidates in the search, none
# spanned Safe and a worse band), so for frequent_bnpl two different bands are what can be asked.
NEEDS_A_SAFE_PURCHASE = {"frequent_bnpl": False, "budget_conscious": True, "irregular_income": True}
# How many of the 10 purchases the less common band must hold: a split, not a single outlier. The
# first heavy-BNPL candidate had one Caution among nine At Risk, which shows a tester nothing.
MIN_MINORITY_CELLS = {"frequent_bnpl": 3, "budget_conscious": 1, "irregular_income": 1}
# The band a tester is SHOWN is the trained model's, not the simulation's, and the two can differ
# sharply (frequent_bnpl was Caution on the simulation yet At Risk for every purchase from RM 200 to
# RM 2,500 on the model). So a persona is also judged on the shown band, over a SPayLater 3-month
# 0% grid with the persona's limit applied, whether or not the tester confirms the Recurring
# suggestions (the forecast places confirmed bills exactly, which can change the answer).
SHOWN_PRICES_SEN = tuple(ringgit * 100 for ringgit in (200, 400, 600, 800, 1000, 1200, 1500))
SHOWN_LIMITS_SEN = {"spaylater": 150_000}  # RM 1,500, the assumed student median (params.yaml)
DEFAULT_OUT_DIR = Path(__file__).resolve().parents[3] / "data" / "personas"
OUTFLOW_TYPES = ("expense", "savings")


def _count(profile: StudentProfile, category: str) -> int:
    return sum(1 for t in profile.transactions if t.category == category)


def _has_messy_rows(profile: StudentProfile) -> bool:
    return _count(profile, REFUND) > 0 and _count(profile, TRANSFER) > 0


def _net_sen(profile: StudentProfile) -> int:
    signed = (
        -t.amount_sen if t.type in OUTFLOW_TYPES else t.amount_sen for t in profile.transactions
    )
    return sum(signed)


def _bnpl_share_of_income(profile: StudentProfile) -> float:
    months = len({(t.date.year, t.date.month) for t in profile.transactions})
    bnpl_sen = sum(t.amount_sen for t in profile.transactions if t.category == BNPL)
    return bnpl_sen / months / profile.expected_monthly_income_sen


SHOWCASE: dict[str, Callable[[StudentProfile], bool]] = {
    "frequent_bnpl": lambda p: (
        _count(p, BNPL) >= MIN_SHOWCASE_ROWS and _bnpl_share_of_income(p) >= MIN_BNPL_SHARE
    ),
    # solvent but tight: no BNPL, no gigs, and the whole history ends no worse than break-even
    "budget_conscious": lambda p: (
        _count(p, BNPL) == 0 and _count(p, "Gig") == 0 and _net_sen(p) >= 0
    ),
    "irregular_income": lambda p: _count(p, "Gig") >= MIN_SHOWCASE_ROWS,
}


def spreads(bands: list[str], persona: str) -> bool:
    """Two different bands across the grid, and a Safe one for the personas that must have it."""
    return len(set(bands)) >= 2 and ("Safe" in bands or not NEEDS_A_SAFE_PURCHASE[persona])


def _spreads_as_shown(profile: StudentProfile, forecaster, predictor) -> bool:
    """The shown band spreads on every study day, with the Recurring suggestions left alone and
    with every one confirmed."""
    from ml.uat.shown_check import shown_bands

    rows = [
        {
            "date": r.date,
            "amount_sen": r.amount_sen,
            "type": r.type,
            "category": r.category_guess,
            "description": r.description,
        }
        for r in parse_csv(render_csv(profile)).rows
    ]
    for offset in CHECK_DAY_OFFSETS:
        today = profile.as_of + timedelta(days=offset)
        for confirmed in (False, True):
            bands = shown_bands(
                rows,
                today,
                confirmed=confirmed,
                prices_sen=SHOWN_PRICES_SEN,
                forecaster=forecaster,
                predictor=predictor,
                limits=SHOWN_LIMITS_SEN,
            )
            if bands is None or not spreads(bands, profile.persona):
                return False
    return True


def _tells_purchases_apart(profile: StudentProfile, forecaster) -> bool:
    """With no savings, on every day a tester might open the app: the student is not already
    At Risk before the purchase, the purchases in the buffer check's grid do not all get the same
    band, and for most personas at least one is Safe. A tester who sees every purchase get the
    same band cannot tell whether the risk check works. Measured with the app's own simulation."""
    from ml.buffer_check import measure_ledger

    # the rows the app gets after a tester imports the file, not the generator's own labels
    # (the importer never guesses BNPL from a description, so the two can differ)
    rows = [
        {"date": r.date, "amount_sen": r.amount_sen, "type": r.type, "category": r.category_guess}
        for r in parse_csv(render_csv(profile)).rows
    ]
    for offset in CHECK_DAY_OFFSETS:
        today = profile.as_of + timedelta(days=offset)
        try:
            result = measure_ledger(rows, today, 0, forecaster)
        except RuntimeError:  # the forecast is locked for this history
            return False
        counts = Counter(c["band"] for c in result["cells"])
        if (
            result["baseline_band"] == "At Risk"
            or len(counts) < 2
            or min(counts.values()) < MIN_MINORITY_CELLS[profile.persona]
            or ("Safe" not in counts and NEEDS_A_SAFE_PURCHASE[profile.persona])
        ):
            return False
    return True


def build_persona_profile(
    params: Params, persona: str, as_of: date = PERSONA_AS_OF
) -> StudentProfile:
    """The first candidate profile that shows what this persona exists to test.

    A candidate must spread on the shown band. One whose simulation also spreads is preferred, so
    both ways of looking agree; where none does (no heavy-BNPL candidate does) the first that
    spreads on the shown band is taken, because that is what the tester sees."""
    from app.engines.forecasting.serving import served_forecaster
    from app.engines.risk.artefact import load_if_present

    forecaster, predictor = served_forecaster(), load_if_present()
    if predictor is None:
        raise RuntimeError("the trained risk model is not in backend/models/engine2")
    months = int(params["history.persona_months"]) + PERSONA_EXTRA_MONTHS
    fallback: StudentProfile | None = None
    for index in range(SEARCH_LIMIT):
        profile = generate_profile(
            params,
            PERSONA_SEEDS[persona],
            index,
            persona=persona,
            history_months=months,
            as_of=as_of,
        )
        if not (SHOWCASE[persona](profile) and _has_messy_rows(profile)):
            continue
        if not _spreads_as_shown(profile, forecaster, predictor):
            continue
        if _tells_purchases_apart(profile, forecaster):
            return profile
        fallback = fallback or profile
    if fallback is not None:
        return fallback
    raise RuntimeError(f"no {persona} profile in {SEARCH_LIMIT} candidates is usable for the UAT")


def _ringgit(amount_sen: int, outflow: bool) -> str:
    sign = "-" if outflow else ""
    ringgit, sen = divmod(abs(amount_sen), 100)
    return f"{sign}{ringgit}.{sen:02d}"


def render_csv(profile: StudentProfile) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(["Date", "Description", "Amount"])
    for t in profile.transactions:
        writer.writerow(
            [
                t.date.strftime("%d/%m/%Y"),
                t.description,
                _ringgit(t.amount_sen, t.type in OUTFLOW_TYPES),
            ]
        )
    return out.getvalue()


def write_personas(params: Params, out_dir: Path, as_of: date = PERSONA_AS_OF) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for persona in PERSONA_SEEDS:
        path = out_dir / f"{persona}.csv"
        profile = build_persona_profile(params, persona, as_of)
        path.write_bytes(render_csv(profile).encode("utf-8"))
        written.append(path)
    return written


def main() -> None:
    for path in write_personas(load_params(), DEFAULT_OUT_DIR):
        print(f"wrote {path}")  # noqa: T201 - command-line entry point


if __name__ == "__main__":
    main()
