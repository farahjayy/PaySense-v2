"""The risk check as a tester sees it: the model's shown band, with the tester's two possible paths
(Recurring suggestions left alone, or all confirmed)."""

from datetime import date
from pathlib import Path

import pytest

from app.domain.csv_import import parse_csv
from app.engines.forecasting.serving import served_forecaster
from app.engines.risk.artefact import load_if_present
from ml.uat.shown_check import confirmed_items, shown_bands

PERSONA_DIR = Path(__file__).resolve().parents[3] / ".." / "data" / "personas"
TODAY = date(2026, 10, 26)
BANDS = {"Safe", "Caution", "At Risk"}


def rows_of(persona: str) -> list[dict]:
    text = (PERSONA_DIR / f"{persona}.csv").read_text(encoding="utf-8")
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


@pytest.fixture(scope="module")
def engines():
    predictor = load_if_present()
    assert predictor is not None, "the trained risk model is not in backend/models/engine2"
    return served_forecaster(), predictor


def test_confirming_every_suggestion_gives_items_the_forecast_can_use():
    items = confirmed_items(rows_of("budget_conscious"), TODAY)

    assert items, "the budget persona has a rent, an allowance and subscriptions"
    for item in items:
        assert item["kind"] in {"income", "bill"}
        assert item["amount_sen"] > 0 and item["active"] is True
        assert item["anchor_date"] <= TODAY


def test_a_card_is_measured_on_the_band_the_tester_sees(engines):
    forecaster, predictor = engines
    prices = (20_000, 150_000)

    bands = shown_bands(
        rows_of("budget_conscious"),
        TODAY,
        confirmed=False,
        prices_sen=prices,
        forecaster=forecaster,
        predictor=predictor,
    )

    assert bands is not None and len(bands) == len(prices)
    assert set(bands) <= BANDS


def test_a_bigger_purchase_never_reads_safer_than_a_small_one_for_the_budget_persona(engines):
    forecaster, predictor = engines
    order = {"Safe": 0, "Caution": 1, "At Risk": 2}

    for confirmed in (False, True):
        bands = shown_bands(
            rows_of("budget_conscious"),
            TODAY,
            confirmed=confirmed,
            prices_sen=(20_000, 150_000),
            forecaster=forecaster,
            predictor=predictor,
        )
        assert order[bands[0]] <= order[bands[1]], (confirmed, bands)
