"""The dashboard's alert line (ADR D-52): what needs attention that the main card does not say."""

import datetime as dt
from typing import Literal

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbDep, TodayDep, rate_limited
from app.api.schemas import PROTECTED_RESPONSES, ApiModel
from app.db import plans as plans_repo
from app.db import provider_limits, recurring_items
from app.domain.alerts import LOOKAHEAD_DAYS, Payment, build_alerts
from app.engines.forecasting.flows import occurrences

router = APIRouter(prefix="/alerts", tags=["alerts"], responses=PROTECTED_RESPONSES)


class AlertOut(ApiModel):
    rule: Literal["overdue", "collision", "limit_near"]
    severity: Literal["high", "medium"]
    title: str
    detail: str
    href: Literal["/plans"]


class AlertsOut(ApiModel):
    items: list[AlertOut]


def _upcoming_bills(items: list[dict], today: dt.date) -> list[Payment]:
    """Each active confirmed bill's payments in the look-ahead, placed on their dates."""
    end = today + dt.timedelta(days=LOOKAHEAD_DAYS)
    return [
        (item["name"], day, int(item["amount_sen"]))
        for item in items
        if item["kind"] == "bill" and item.get("active", True)
        for day in occurrences(item, today, end)
    ]


@router.get("", response_model=AlertsOut, dependencies=[rate_limited("alerts", 60, 60)])
def alerts(user: CurrentUser, db: DbDep, today: TodayDep) -> AlertsOut:
    found = build_alerts(
        plans_repo.list_with_instalments(db, user.id),
        _upcoming_bills(recurring_items.list_items(db, user.id, active_only=True), today),
        {row["provider"]: row["limit_sen"] for row in provider_limits.list_limits(db, user.id)},
        today,
    )
    return AlertsOut(items=[AlertOut(**vars(alert)) for alert in found])
