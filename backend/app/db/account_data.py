"""Counting and clearing everything a person owns (ADR D-50).

Every function takes `user_id` first and reaches the database only through user-scoped helpers, so
a reset can only ever touch the caller's own rows. There is no table-wide delete anywhere here.

The order is transactions, then plans (which take their instalments with them), the saved risk
reports, recurring items, limits and categories. A reset
that fails partway can simply be run again; clearing what is already gone removes nothing.
"""

from collections.abc import Sequence
from typing import Any

from app.db import categories, provider_limits, recurring_items, user_settings
from app.db import plans as plans_repo
from app.db.base import ScopedTable, require_user_id
from app.db.client import Database

SCOPES = ("transactions", "plans", "recurring", "limits", "categories")

_TRANSACTIONS = "transactions"
_PLANS = "bnpl_plans"
_INSTALMENTS = "bnpl_installments"
_REPORTS = "risk_checks"
_RECURRING = "recurring_items"
_CATEGORIES = "user_categories"


def _count(db: Database, user_id: str, table: str) -> int:
    return len(ScopedTable(db, table).list_rows(user_id, columns="id"))


def counts(db: Database, user_id: str) -> dict[str, int]:
    """How many of each kind the person has, keyed by scope."""
    uid = require_user_id(user_id)
    return {
        "transactions": _count(db, uid, _TRANSACTIONS),
        "plans": _count(db, uid, _PLANS),
        "recurring": _count(db, uid, _RECURRING),
        "limits": len(provider_limits.list_limits(db, uid)),
        "categories": _count(db, uid, _CATEGORIES),
    }


def _checked(scopes: Sequence[str]) -> list[str]:
    unknown = [s for s in scopes if s not in SCOPES]
    if unknown:
        raise ValueError(f"unknown scope {unknown}; choose from {list(SCOPES)}")
    wanted = [s for s in SCOPES if s in scopes]  # the safe order, each once
    if not wanted:
        raise ValueError("choose at least one kind of data to clear")
    return wanted


def erase(
    db: Database, user_id: str, scopes: Sequence[str], *, reset_onboarding: bool = False
) -> dict[str, int]:
    """Clear the chosen kinds of the caller's data and return how many of each were removed.

    A plan's saved risk reports go with the plan. The payments a plan logged stay behind as
    ordinary transactions unless transactions are cleared too. Nothing is deleted if a scope is
    unknown: they are all checked first."""
    uid = require_user_id(user_id)
    wanted = _checked(scopes)
    removed = dict.fromkeys(SCOPES, 0)
    if "transactions" in wanted:
        removed["transactions"] = ScopedTable(db, _TRANSACTIONS).delete_all(uid)
    if "plans" in wanted:
        # Plans first: each plan takes its instalments with it (they cascade), so a failure never
        # leaves plans with no schedule. The sweep after is for any instalment left over.
        removed["plans"] = ScopedTable(db, _PLANS).delete_all(uid)
        ScopedTable(db, _INSTALMENTS).delete_all(uid)
        ScopedTable(db, _REPORTS).delete_all(uid)
    if "recurring" in wanted:
        removed["recurring"] = ScopedTable(db, _RECURRING).delete_all(uid)
    if "limits" in wanted:
        removed["limits"] = provider_limits.delete_all(db, uid)
    if "categories" in wanted:
        removed["categories"] = ScopedTable(db, _CATEGORIES).delete_all(uid)
    if reset_onboarding:
        user_settings.set_onboarding_state(db, uid, "new")
    return removed


_TRANSACTION_FIELDS = ("date", "amount_sen", "type", "category", "description", "source")
_PLAN_FIELDS = (
    "item_name",
    "provider",
    "provider_label",
    "purchase_date",
    "num_installments",
    "total_price_sen",
    "financed_sen",
    "upfront_sen",
    "monthly_fee_rate_pct",
    "first_payment_date",
)
_INSTALMENT_FIELDS = ("seq", "due_date", "amount_sen", "is_paid", "paid_date")
_RECURRING_FIELDS = (
    "name",
    "kind",
    "amount_sen",
    "cadence",
    "custom_interval_days",
    "anchor_date",
    "active",
    "match_text",
)


def _pick(row: dict[str, Any], fields: tuple[str, ...]) -> dict[str, Any]:
    return {field: row.get(field) for field in fields}


def transactions_for_export(db: Database, user_id: str) -> list[dict[str, Any]]:
    """The caller's transactions, oldest first, without database ids."""
    rows = ScopedTable(db, _TRANSACTIONS).list_rows(
        require_user_id(user_id), order_by="date", columns=",".join(_TRANSACTION_FIELDS)
    )
    return [_pick(row, _TRANSACTION_FIELDS) for row in rows]


def export(db: Database, user_id: str) -> dict[str, Any]:
    """Everything the caller owns, for a file they keep. Money is integer sen; no database ids
    and no user id appear, because the file is theirs and those mean nothing outside the app."""
    uid = require_user_id(user_id)
    return {
        "transactions": transactions_for_export(db, uid),
        "plans": [
            {
                **_pick(plan, _PLAN_FIELDS),
                "installments": [_pick(i, _INSTALMENT_FIELDS) for i in plan["installments"]],
            }
            for plan in plans_repo.list_with_instalments(db, uid)
        ],
        "recurring_items": [
            _pick(item, _RECURRING_FIELDS) for item in recurring_items.list_items(db, uid)
        ],
        "provider_limits": [
            {"provider": limit["provider"], "limit_sen": limit["limit_sen"]}
            for limit in provider_limits.list_limits(db, uid)
        ],
        "categories": categories.names(db, uid),
    }
