"""Settings: what a person has, a copy of it, and clearing it (ADR D-50).

Everything here is about the signed-in person's own data. Clearing is irreversible, so it needs
the word RESET, runs one at a time per person, and is rate limited. The account itself is never
deleted: the person keeps their username and can start again.
"""

import json
import threading
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.deps import CurrentUser, DbDep, TodayDep, rate_limited
from app.api.schemas import PROTECTED_RESPONSES, ApiModel
from app.core.errors import conflict
from app.db import account_data
from app.domain.export import transactions_csv

router = APIRouter(prefix="/account", tags=["account"], responses=PROTECTED_RESPONSES)

Scope = Literal["transactions", "plans", "recurring", "limits", "categories"]
_RESET_LOCKS: dict[str, threading.Lock] = {}
_RESET_LOCKS_GUARD = threading.Lock()


def _reset_lock(user_id: str) -> threading.Lock:
    with _RESET_LOCKS_GUARD:
        return _RESET_LOCKS.setdefault(user_id, threading.Lock())


class AccountSummaryOut(ApiModel):
    transactions: int
    plans: int
    recurring: int
    limits: int
    categories: int


class AccountResetIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scopes: list[Scope] = Field(min_length=1, max_length=len(account_data.SCOPES))
    confirm: Literal["RESET"]

    @field_validator("scopes")
    @classmethod
    def _each_once(cls, scopes: list[Scope]) -> list[Scope]:
        if len(set(scopes)) != len(scopes):
            raise ValueError("each kind of data can be chosen once")
        return scopes


class AccountResetOut(ApiModel):
    removed: AccountSummaryOut
    # every kind was cleared, so onboarding is back to new as well
    factory_reset: bool


@router.get(
    "/summary",
    response_model=AccountSummaryOut,
    dependencies=[rate_limited("account-summary", 30, 60)],
)
def summary(user: CurrentUser, db: DbDep) -> AccountSummaryOut:
    """How many of each kind the person has, shown beside the tick boxes."""
    return AccountSummaryOut(**account_data.counts(db, user.id))


@router.post(
    "/reset",
    response_model=AccountResetOut,
    dependencies=[rate_limited("account-reset", 5, 60)],
)
def reset(body: AccountResetIn, user: CurrentUser, db: DbDep) -> AccountResetOut:
    """Clear the chosen kinds of the caller's data. Clearing all five is a factory reset."""
    lock = _reset_lock(user.id)
    if not lock.acquire(blocking=False):  # never park a server thread behind another reset
        raise conflict("reset_in_progress", "A reset is already running. Wait a moment.")
    try:
        everything = set(body.scopes) == set(account_data.SCOPES)
        removed = account_data.erase(db, user.id, body.scopes, reset_onboarding=everything)
        return AccountResetOut(removed=AccountSummaryOut(**removed), factory_reset=everything)
    finally:
        lock.release()


@router.get(
    "/export",
    response_class=Response,
    dependencies=[rate_limited("account-export", 5, 60)],
    responses={200: {"content": {"text/csv": {}, "application/json": {}}}},
)
def export(
    user: CurrentUser,
    db: DbDep,
    today: TodayDep,
    format: Annotated[Literal["csv", "json"], Query()] = "csv",  # noqa: A002 (the query name)
) -> Response:
    """A copy of the person's data as a file: CSV is the transactions in the import template's
    format (so it can be imported back), JSON is everything."""
    if format == "csv":
        body = transactions_csv(account_data.transactions_for_export(db, user.id))
        media, name = "text/csv; charset=utf-8", f"paysense-transactions-{today.isoformat()}.csv"
    else:
        data = {"exported_on": today.isoformat(), **account_data.export(db, user.id)}
        body = json.dumps(data, indent=2, default=str)
        media, name = "application/json", f"paysense-data-{today.isoformat()}.json"
    return Response(
        content=body,
        media_type=media,
        headers={
            "Content-Disposition": f'attachment; filename="{name}"',
            # a private financial file: never kept by a cache, never guessed to be something else
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
