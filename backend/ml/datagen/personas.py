"""The three UAT persona CSVs (plan P2, A10): `python -m ml.datagen.personas`.

Testers do not upload their own statements; each uploads a pre-made, persona-matched history of
at least four months (academic constraints, section 3). Every file is synthetic, built from a
fixed seed so the output is byte-for-byte reproducible, and chosen (deterministically) from the
first profile that actually shows what the persona exists to test.
"""

import csv
import io
from collections.abc import Callable
from datetime import date, timedelta
from pathlib import Path

from app.domain.categorize import BNPL, REFUND, TRANSFER
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
# The histories end on the last day of the month before the UAT, so a tester who imports one sees a
# ledger that is current and whose paydays, rent and PTPTN months sit on the real calendar.
PERSONA_AS_OF = date(2026, 10, 31)
# The forecast looks three months ahead from the day a tester opens it, so the same ledger reads
# differently on 31 October and on 1 November (a PTPTN month can fall in or out of the window). A
# persona must tell purchases apart on the end day, the day after, and the last day before the
# forecast calls the ledger stale (14 days), so the study can start anywhere in that stretch.
CHECK_DAY_OFFSETS = (0, 1, 14)
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


def _tells_purchases_apart(profile: StudentProfile, forecaster) -> bool:
    """With no savings, at least one purchase in the buffer check's grid comes out Safe and at
    least one does not, on every day a tester might open the app. A tester who sees every
    purchase get the same band cannot tell whether the risk check works. Measured with the
    app's own simulation, not a rule of thumb."""
    from ml.buffer_check import measure_ledger

    rows = [t.as_row() for t in profile.transactions]
    for offset in CHECK_DAY_OFFSETS:
        today = profile.as_of + timedelta(days=offset)
        try:
            cells = measure_ledger(rows, today, 0, forecaster)["cells"]
        except RuntimeError:  # the forecast is locked for this history
            return False
        bands = {c["band"] for c in cells}
        if "Safe" not in bands or bands == {"Safe"}:
            return False
    return True


def build_persona_profile(
    params: Params, persona: str, as_of: date = PERSONA_AS_OF
) -> StudentProfile:
    """The first candidate profile that shows what this persona exists to test."""
    from app.engines.forecasting.serving import served_forecaster

    forecaster = served_forecaster()
    months = int(params["history.persona_months"]) + PERSONA_EXTRA_MONTHS
    for index in range(SEARCH_LIMIT):
        profile = generate_profile(
            params,
            PERSONA_SEEDS[persona],
            index,
            persona=persona,
            history_months=months,
            as_of=as_of,
        )
        if (
            SHOWCASE[persona](profile)
            and _has_messy_rows(profile)
            and _tells_purchases_apart(profile, forecaster)
        ):
            return profile
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
