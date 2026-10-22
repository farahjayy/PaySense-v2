"""The risk check as a tester sees it (plan 2026-10-22-uat-purchase-cards).

`ml.buffer_check` measures the direct simulation, the quantity Engine 2's label is built from. The
band a tester is shown is different: it is `band(probability)` of the trained model, and the two can
disagree sharply (a persona the simulation calls Caution can be At Risk on the model's estimate).
Persona histories and purchase cards are judged on what the tester sees, through the same
`run_check` the browser's request ends in, with the provider limit applied.

A tester reaches the check by one of two paths: they leave the Recurring page's suggestions alone,
or they confirm every one. The forecast places confirmed income and bills on their exact dates, so
the two paths can give different answers; both are measured.
"""

from collections.abc import Iterable, Mapping, Sequence
from datetime import date
from typing import Any

from app.engines.forecasting.recurring import detect
from app.engines.risk.check import Predictor, RiskRequest, run_check

DEFAULT_SEED = 7


def confirmed_items(rows: Iterable[Mapping[str, Any]], today: date) -> list[dict[str, Any]]:
    """The recurring items a tester gets by pressing Confirm on every suggestion."""
    return [
        {
            "kind": s.kind,
            "name": s.display_name,
            "match_text": s.name,
            "amount_sen": s.amount_sen,
            "cadence": s.cadence,
            "custom_interval_days": None,
            "anchor_date": s.anchor_date,
            "active": True,
        }
        for s in detect(rows, today=today)
    ]


def check_card(
    rows: Sequence[Mapping[str, Any]],
    items: Sequence[Mapping[str, Any]],
    today: date,
    request: RiskRequest,
    limits: Mapping[str, int | None],
    forecaster: Any,
    predictor: Predictor,
    seed: int = DEFAULT_SEED,
):
    """One full check, exactly as the API runs it for a ledger with no plans."""
    return run_check(rows, items, [], limits, request, today, forecaster, predictor, seed=seed)


def shown_bands(
    rows: Sequence[Mapping[str, Any]],
    today: date,
    *,
    confirmed: bool,
    prices_sen: Iterable[int],
    forecaster: Any,
    predictor: Predictor,
    limits: Mapping[str, int | None] | None = None,
    provider: str = "spaylater",
    instalments: int = 3,
    fee_pct: float = 0.0,
    seed: int = DEFAULT_SEED,
) -> list[str] | None:
    """The shown band for each price, or None when the forecast is locked for this ledger."""
    items = confirmed_items(rows, today) if confirmed else []
    bands = []
    for price in prices_sen:
        request = RiskRequest(
            provider=provider,
            item_name="Purchase",
            purchase_date=today,
            num_installments=instalments,
            total_price_sen=price,
            monthly_fee_rate_pct=fee_pct,
        )
        result = check_card(rows, items, today, request, limits or {}, forecaster, predictor, seed)
        if result.status != "ok" or result.band is None:
            return None
        bands.append(result.band)
    return bands
