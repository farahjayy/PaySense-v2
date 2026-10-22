import hashlib
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

import pytest

from app.domain.categorize import REFUND, TRANSFER
from app.domain.csv_import import parse_csv
from app.domain.flows import history_span, month_summary
from ml.datagen.params import load_params
from ml.datagen.personas import (
    CHECK_DAY_OFFSETS,
    MIN_BNPL_SHARE,
    MIN_MINORITY_CELLS,
    NEEDS_A_SAFE_PURCHASE,
    PERSONA_SEEDS,
    build_persona_profile,
    render_csv,
    write_personas,
)

PARAMS = load_params()
PERSONAS = tuple(PERSONA_SEEDS)


@pytest.fixture(scope="module")
def profiles():
    return {persona: build_persona_profile(PARAMS, persona) for persona in PERSONAS}


def as_rows(preview):
    return [
        {
            "date": r.date,
            "amount_sen": r.amount_sen,
            "type": r.type,
            "category": r.category_guess,
            "description": r.description,
        }
        for r in preview.rows
    ]


def test_each_persona_has_a_fixed_seed():
    assert set(PERSONA_SEEDS) == {"frequent_bnpl", "budget_conscious", "irregular_income"}


def test_the_csv_is_bank_style_with_signed_ringgit_amounts_and_dd_mm_yyyy_dates(profiles):
    text = render_csv(profiles["budget_conscious"])
    header, first, *_ = text.splitlines()

    assert header == "Date,Description,Amount"
    date_cell, _, amount = first.partition(",")[0], None, first.rsplit(",", 1)[1]
    assert len(date_cell) == 10 and date_cell[2] == "/" and date_cell[5] == "/"
    assert amount.lstrip("-").count(".") == 1 and len(amount.rsplit(".", 1)[1]) == 2


def test_rendering_is_reproducible(profiles):
    assert render_csv(profiles["frequent_bnpl"]) == render_csv(
        build_persona_profile(PARAMS, "frequent_bnpl")
    )


@pytest.mark.parametrize("persona", PERSONAS)
def test_the_importer_reads_every_row_without_skipping_any(profiles, persona):
    profile = profiles[persona]
    preview = parse_csv(render_csv(profile))

    assert preview.skipped == ()
    assert len(preview.rows) == len(profile.transactions)


@pytest.mark.parametrize("persona", PERSONAS)
def test_each_file_covers_at_least_four_distinct_months(profiles, persona):
    profile = profiles[persona]
    span = history_span(as_rows(parse_csv(render_csv(profile))), profile.as_of)

    assert span.distinct_months >= 4


@pytest.mark.parametrize("persona", PERSONAS)
def test_income_and_spend_survive_the_round_trip(profiles, persona):
    profile = profiles[persona]
    original = month_summary(t.as_row() for t in profile.transactions)
    imported = month_summary(as_rows(parse_csv(render_csv(profile))))

    assert [m.income_sen for m in imported] == [m.income_sen for m in original]
    assert [m.spend_sen for m in imported] == [m.spend_sen for m in original]


@pytest.mark.parametrize("persona", PERSONAS)
def test_the_file_includes_a_refund_and_an_own_account_transfer_on_purpose(profiles, persona):
    categories = {r["category"] for r in as_rows(parse_csv(render_csv(profiles[persona])))}

    assert {REFUND, TRANSFER} <= categories


def test_the_frequent_bnpl_persona_pays_bnpl_instalments(profiles):
    bnpl = [t for t in profiles["frequent_bnpl"].transactions if t.category == "BNPL"]

    assert len(bnpl) >= 3


def test_the_irregular_persona_is_paid_in_gigs_not_a_steady_allowance(profiles):
    gigs = [t for t in profiles["irregular_income"].transactions if t.category == "Gig"]

    assert len(gigs) >= 3


@pytest.mark.parametrize("persona", PERSONAS)
def test_each_history_runs_from_june_to_the_day_before_the_study_opens(profiles, persona):
    profile = profiles[persona]
    dates = [t.date for t in profile.transactions]

    assert profile.as_of == date(2026, 10, 24)
    assert min(dates) >= date(2026, 6, 1) and min(dates).month == 6
    assert max(dates).year == 2026 and max(dates).month == 10


@pytest.mark.parametrize("persona", ("budget_conscious", "irregular_income"))
def test_the_simulation_also_spreads_for_the_personas_that_can_manage_it(profiles, persona):
    """The pick prefers a candidate whose direct simulation spreads as well as the shown band.
    frequent_bnpl is exempt: no heavy-BNPL candidate does both (the shown-band test below covers
    all three personas)."""
    from app.engines.forecasting.serving import served_forecaster
    from ml.buffer_check import measure_ledger

    profile = profiles[persona]
    rows = as_rows(
        parse_csv(render_csv(profile))
    )  # what the app reads, not what the generator holds
    forecaster = served_forecaster()

    for offset in CHECK_DAY_OFFSETS:
        today = profile.as_of + timedelta(days=offset)
        result = measure_ledger(rows, today, 0, forecaster)
        counts = Counter(c["band"] for c in result["cells"])
        where = (persona, today, dict(counts))
        assert result["baseline_band"] != "At Risk", (
            where
        )  # not already failing before the purchase
        assert len(counts) >= 2, where
        assert min(counts.values()) >= MIN_MINORITY_CELLS[persona], where
        assert "Safe" in counts or not NEEDS_A_SAFE_PURCHASE[persona], where


def test_the_frequent_bnpl_persona_carries_a_material_bnpl_load(profiles):
    profile = profiles["frequent_bnpl"]
    months = len({(t.date.year, t.date.month) for t in profile.transactions})
    bnpl_sen = sum(t.amount_sen for t in profile.transactions if t.category == "BNPL")

    assert bnpl_sen / months >= MIN_BNPL_SHARE * profile.expected_monthly_income_sen


@pytest.mark.parametrize("persona", PERSONAS)
def test_the_band_the_tester_sees_spreads_on_every_study_day_whether_or_not_they_confirm_bills(
    profiles, persona
):
    """The tester is shown the model's band, not the simulation's. Whether they confirm the
    Recurring suggestions changes the forecast, so both paths must give a usable spread."""
    from app.engines.forecasting.serving import served_forecaster
    from app.engines.risk.artefact import load_if_present
    from ml.datagen.personas import SHOWN_LIMITS_SEN, SHOWN_PRICES_SEN, spreads
    from ml.uat.shown_check import shown_bands

    profile = profiles[persona]
    rows = as_rows(parse_csv(render_csv(profile)))
    forecaster, predictor = served_forecaster(), load_if_present()

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
            assert bands is not None and spreads(bands, persona), (persona, today, confirmed, bands)


def test_no_amount_is_zero_and_nothing_is_dated_in_the_future(profiles):
    for profile in profiles.values():
        assert all(t.amount_sen > 0 and t.date <= profile.as_of for t in profile.transactions)


def test_writing_twice_produces_byte_identical_files(tmp_path):
    first = write_personas(PARAMS, tmp_path / "a")
    second = write_personas(PARAMS, tmp_path / "b")

    digests = lambda paths: [hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in paths]  # noqa: E731
    assert digests(first) == digests(second)
    assert [Path(p).name for p in first] == [f"{persona}.csv" for persona in PERSONAS]


def test_files_use_unix_line_endings_and_no_byte_order_mark(tmp_path):
    for path in write_personas(PARAMS, tmp_path):
        raw = Path(path).read_bytes()
        assert b"\r" not in raw and not raw.startswith(b"\xef\xbb\xbf")


@pytest.mark.parametrize("persona", PERSONAS)
def test_an_imported_persona_unlocks_the_forecast(profiles, persona):
    """The tester's first minutes: import the file, open the dashboard. A locked forecast there
    would waste the session (frequent_bnpl once had 16 complete weeks, one short of the gate)."""
    from datetime import timedelta

    from app.engines.forecasting.models import MovingAverage
    from app.engines.forecasting.service import MIN_SERIES_WEEKS, build_forecast

    profile = profiles[persona]
    rows = as_rows(parse_csv(render_csv(profile)))
    forecast = build_forecast(
        rows=rows,
        items=[],
        plans=[],
        today=profile.as_of + timedelta(days=1),
        forecaster=MovingAverage(8),
    )

    assert forecast.status == "ok", (persona, forecast.lock_reason)
    first = min(r["date"] for r in rows)
    # a margin above the gate, so shifting the file by whole weeks cannot fall back under it
    assert (profile.as_of - first).days // 7 >= MIN_SERIES_WEEKS + 2
