"""Clearing a person's data: only their own rows go, and a second run is harmless.

Every scope is tested with two people who both have data, because the one way this can go badly
wrong is deleting someone else's.
"""

from datetime import date

import pytest

from app.db import (
    account_data,
    categories,
    provider_limits,
    recurring_items,
    risk_checks,
    user_settings,
)
from app.db import plans as plans_repo
from app.db import transactions as transactions_repo
from app.db.users import create as create_user
from app.domain.providers import get_provider
from app.domain.schedule import build_schedule
from tests.fakes import FakeSupabase

PURCHASE = date(2026, 3, 5)
ALL = ("transactions", "plans", "recurring", "limits", "categories")


@pytest.fixture
def db() -> FakeSupabase:
    return FakeSupabase()


@pytest.fixture
def amir(db) -> str:
    return create_user(db, username="amir", display_name="Amir")["id"]


@pytest.fixture
def siti(db) -> str:
    return create_user(db, username="siti", display_name="Siti")["id"]


def report(label="safe"):
    return {
        "input": {"provider": "atome"},
        "features": {},
        "feature_schema_hash": "abc",
        "model_version": "v1",
        "p": 0.1,
        "p_simulated": 0.1,
        "score": 90,
        "label": label,
        "factors": [],
    }


def fill(db, uid, *, tag="a"):
    """One of everything the person can own, with a plan that has a report and logged payments."""
    transactions_repo.bulk_create(
        db,
        uid,
        [
            {
                "date": "2026-03-01",
                "amount_sen": 1000,
                "type": "expense",
                "category": "Food",
                "description": f"Lunch {tag}",
            },
            {
                "date": "2026-03-02",
                "amount_sen": 2000,
                "type": "expense",
                "category": "Food",
                "description": f"Dinner {tag}",
            },
        ],
        source="seed",
    )
    instalments = build_schedule("atome", 30000, 0, 3, PURCHASE)
    plan = {
        "item_name": f"Phone {tag}",
        "provider": "atome",
        "provider_label": get_provider("atome").label,
        "schedule_source": "provider_rule",
        "total_price_sen": 30000,
        "financed_sen": 30000,
        "upfront_sen": 0,
        "monthly_fee_rate_pct": 0,
        "num_installments": 3,
        "purchase_date": PURCHASE,
        "first_payment_date": instalments[0].due_date,
    }
    stored = risk_checks.create(db, uid, report())
    plans_repo.create_plan(
        db,
        uid,
        {**plan, "risk_check_id": stored["id"], "risk_check_type": "before_purchase"},
        instalments,
    )
    recurring_items.create(
        db,
        uid,
        kind="bill",
        name=f"Rent {tag}",
        amount_sen=45000,
        cadence="monthly",
        anchor_date="2026-03-25",
    )
    provider_limits.upsert_limit(db, uid, "atome", 50000)
    categories.add(db, uid, f"Gym {tag}")


def test_it_counts_what_a_person_has(db, amir):
    fill(db, amir)

    counts = account_data.counts(db, amir)

    assert counts["plans"] == 1
    assert counts["recurring"] == 1
    assert counts["limits"] == 1
    assert counts["categories"] == 1
    assert counts["transactions"] >= 2  # the plan's own checkout payment may add to it


@pytest.mark.parametrize("scope", ALL)
def test_each_scope_clears_only_its_own_kind_and_only_the_callers(db, amir, siti, scope):
    fill(db, amir, tag="amir")
    fill(db, siti, tag="siti")
    before_siti = account_data.counts(db, siti)
    before_amir = account_data.counts(db, amir)

    removed = account_data.erase(db, amir, [scope])

    assert account_data.counts(db, siti) == before_siti  # nobody else is touched
    after = account_data.counts(db, amir)
    assert after[scope] == 0
    assert removed[scope] == before_amir[scope]
    for other in ALL:
        if other not in (scope, "transactions"):  # plans may leave their payments behind
            assert after[other] == before_amir[other]


def test_clearing_everything_leaves_the_person_with_an_empty_account_and_nobody_else_changed(
    db, amir, siti
):
    fill(db, amir, tag="amir")
    fill(db, siti, tag="siti")
    before_siti = account_data.counts(db, siti)

    account_data.erase(db, amir, list(ALL))

    assert all(count == 0 for count in account_data.counts(db, amir).values())
    assert account_data.counts(db, siti) == before_siti
    assert db.rows("bnpl_installments") != []  # siti's instalments are still there
    assert all(r["user_id"] == siti for r in db.rows("bnpl_installments"))
    assert all(r["user_id"] == siti for r in db.rows("risk_checks"))


def test_clearing_plans_takes_their_reports_and_instalments_but_keeps_logged_payments(db, amir):
    fill(db, amir)
    before = account_data.counts(db, amir)["transactions"]

    account_data.erase(db, amir, ["plans"])

    assert db.rows("bnpl_installments") == []
    assert db.rows("risk_checks") == []
    assert account_data.counts(db, amir)["transactions"] == before  # kept as ordinary rows
    assert all(t["bnpl_plan_id"] is None for t in db.rows("transactions"))


def test_clearing_plans_and_transactions_together_leaves_no_payment_behind(db, amir):
    fill(db, amir)

    account_data.erase(db, amir, ["transactions", "plans"])

    assert account_data.counts(db, amir)["transactions"] == 0


def test_a_second_run_removes_nothing_and_does_not_fail(db, amir):
    fill(db, amir)
    account_data.erase(db, amir, list(ALL))

    again = account_data.erase(db, amir, list(ALL))

    assert all(count == 0 for count in again.values())


def test_a_large_ledger_is_cleared_in_full_past_the_row_cap(db, amir):
    rows = [
        {
            "date": "2026-03-01",
            "amount_sen": 100,
            "type": "expense",
            "category": "Food",
            "description": f"Row {i}",
        }
        for i in range(2500)
    ]
    transactions_repo.bulk_create(db, amir, rows, source="seed")

    removed = account_data.erase(db, amir, ["transactions"])

    assert removed["transactions"] == 2500
    assert account_data.counts(db, amir)["transactions"] == 0


def test_an_unknown_scope_is_refused_before_anything_is_deleted(db, amir):
    fill(db, amir)
    before = account_data.counts(db, amir)

    with pytest.raises(ValueError):
        account_data.erase(db, amir, ["transactions", "everything_else"])

    assert account_data.counts(db, amir) == before


def test_no_scopes_is_refused(db, amir):
    with pytest.raises(ValueError):
        account_data.erase(db, amir, [])


def test_a_blank_user_id_is_refused(db):
    with pytest.raises(ValueError):
        account_data.erase(db, "", ["transactions"])


def test_resetting_everything_puts_onboarding_back_to_new(db, amir):
    user_settings.set_onboarding_state(db, amir, "complete")

    account_data.erase(db, amir, list(ALL), reset_onboarding=True)

    assert user_settings.get(db, amir)["onboarding_state"] == "new"


def test_clearing_part_of_the_data_leaves_onboarding_alone(db, amir):
    user_settings.set_onboarding_state(db, amir, "complete")

    account_data.erase(db, amir, ["transactions"])

    assert user_settings.get(db, amir)["onboarding_state"] == "complete"


def test_delete_all_with_a_filter_removes_only_that_users_matching_rows(db, amir, siti):
    from app.db.base import ScopedTable

    for uid in (amir, siti):
        transactions_repo.bulk_create(
            db,
            uid,
            [
                {"date": "2026-03-01", "amount_sen": 100, "type": "expense", "category": "Food"},
                {"date": "2026-03-02", "amount_sen": 100, "type": "expense", "category": "Bills"},
            ],
            source="seed",
        )

    removed = ScopedTable(db, "transactions").delete_all(amir, category="Food")

    assert removed == 1
    assert [r["category"] for r in transactions_repo.list_between(db, amir, None, None)] == [
        "Bills"
    ]
    assert len(transactions_repo.list_between(db, siti, None, None)) == 2


def test_clearing_limits_never_touches_another_persons_limits(db, amir, siti):
    provider_limits.upsert_limit(db, amir, "atome", 10000)
    provider_limits.upsert_limit(db, siti, "atome", 20000)

    assert provider_limits.delete_all(db, amir) == 1

    assert provider_limits.list_limits(db, amir) == []
    assert [r["limit_sen"] for r in provider_limits.list_limits(db, siti)] == [20000]


def test_plans_go_before_their_instalments_so_a_failure_never_leaves_plans_with_no_schedule(
    db, amir, monkeypatch
):
    from app.db.base import ScopedTable

    fill(db, amir)
    order: list[str] = []
    real = ScopedTable.delete_all

    def recording(self, user_id, /, **equals):
        order.append(self._table)
        return real(self, user_id, **equals)

    monkeypatch.setattr(ScopedTable, "delete_all", recording)

    account_data.erase(db, amir, ["plans"])

    assert order.index("bnpl_plans") < order.index("bnpl_installments")
    assert order.index("bnpl_plans") < order.index("risk_checks")
