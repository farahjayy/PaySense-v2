"""POST /api/plans takes a snapshot of the risk check the day a plan is added (ADR D-47).

A plan added with the plain button is checked for the person and the frozen report is linked to the
plan, so its statistics stay with it. A plan that already started (instalments dated before today)
can say which of them are already paid; those are a record and change nothing about the future,
and the check covers only what is still owed. The check runs BEFORE the plan is saved, so a plan is
never counted against itself.

A stub model stands in for the trained one; the real pipeline runs underneath it.
"""

from datetime import date, timedelta

import pytest

from app.api import risk as risk_routes
from app.api.deps import get_today
from app.api.forecast import get_forecaster
from app.db import transactions as transactions_repo
from app.db import users
from app.engines.forecasting.models import MovingAverage
from app.engines.risk.features import FEATURE_NAMES, FEATURE_SCHEMA_HASH

TODAY = date(2025, 5, 12)  # a Monday
RATIO = FEATURE_NAMES.index("instalment_to_income")
DSR = FEATURE_NAMES.index("dsr_with_purchase")


class Model:
    version = "stub-model-1"
    feature_schema_hash = FEATURE_SCHEMA_HASH

    def predict(self, vector):
        return min(1.0, vector[RATIO] * 2.0)

    def contributions(self, vector):
        out = [0.0] * len(FEATURE_NAMES)
        out[DSR] = 0.05
        return out


@pytest.fixture(autouse=True)
def pinned(api):
    api.app.dependency_overrides[get_today] = lambda: TODAY
    api.app.dependency_overrides[get_forecaster] = lambda: MovingAverage(8)
    api.app.state.predictor = Model()
    yield
    api.app.dependency_overrides.clear()


def user_id(fake_db, username="amir"):
    return users.get_by_username(fake_db, username)["id"]


def txn(day, amount, kind="expense", category="Food", description="Kedai makan"):
    return {
        "date": day.isoformat(),
        "amount_sen": amount,
        "type": kind,
        "category": category,
        "description": description,
    }


def fill(fake_db, username="amir", income=200000, weekly=6000, first=date(2025, 1, 6)):
    rows, day = [], first
    while day < TODAY:
        rows.append(txn(day, weekly))
        day += timedelta(days=7)
    rows += [
        txn(date(2025, m, 1), income, "income", "Allowance", "Duit belanja") for m in range(1, 6)
    ]
    transactions_repo.bulk_create(fake_db, user_id(fake_db, username), rows, source="seed")


def body(**overrides):
    base = {
        "provider": "spaylater",
        "item_name": "Headphones",
        "purchase_date": TODAY.isoformat(),
        "num_installments": 3,
        "total_price_sen": 60000,
    }
    base.update(overrides)
    return base


def existing(**overrides):
    """Bought four months ago over six instalments (SPayLater bills a month later, so the first
    was due 12 Feb): three are behind us, three are still to come."""
    return body(
        **{
            "item_name": "Laptop",
            "purchase_date": "2025-01-12",
            "num_installments": 6,
            "total_price_sen": 120000,
            **overrides,
        }
    )


def create(api, headers, payload):
    res = api.post("/api/plans", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def report(api, headers, plan):
    res = api.get(f"/api/risk/checks/{plan['risk_check_id']}", headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def plan_payments(fake_db):
    return [r for r in fake_db.rows("transactions") if r.get("bnpl_plan_id")]


# ------------------------------------------------------------------ the snapshot
def test_a_plan_added_with_the_plain_button_is_checked_and_keeps_the_result(api, amir, fake_db):
    fill(fake_db)

    plan = create(api, amir, body())

    assert plan["risk_check_id"] is not None
    assert plan["risk_check_type"] == "before_purchase"
    assert plan["risk_band"] in {"Safe", "Caution", "At Risk"}
    assert isinstance(plan["risk_score_at_creation"], int)
    assert plan["added_on"]  # the day the snapshot was taken


def test_the_saved_report_is_the_same_as_checking_the_purchase_first(api, amir, fake_db):
    fill(fake_db)
    checked = api.post("/api/risk/check", json=body(), headers=amir).json()

    plan = create(api, amir, body())
    saved = report(api, amir, plan)

    assert saved["check_type"] == "before_purchase"
    assert saved["probability"] == checked["probability"]
    assert saved["score"] == checked["score"] == plan["risk_score_at_creation"]
    assert saved["band"] == checked["band"] == plan["risk_band"]
    assert saved["factors"] == checked["factors"]


def test_the_report_does_not_change_when_the_ledger_does_afterwards(api, amir, fake_db):
    fill(fake_db)
    plan = create(api, amir, body())
    before = report(api, amir, plan)
    transactions_repo.bulk_create(
        fake_db,
        user_id(fake_db),
        [txn(TODAY - timedelta(days=1), 150000, category="Shopping")],
        source="manual",
    )

    assert report(api, amir, plan) == before


def test_plan_list_and_single_read_carry_the_snapshot_fields_too(api, amir, fake_db):
    fill(fake_db)
    plan = create(api, amir, body())

    listed = api.get("/api/plans", headers=amir).json()[0]
    single = api.get(f"/api/plans/{plan['id']}", headers=amir).json()

    for field in ("risk_check_id", "risk_check_type", "risk_band", "risk_score_at_creation"):
        assert listed[field] == single[field] == plan[field]


def test_a_ledger_that_is_too_short_still_saves_the_plan_with_no_analysis(api, amir):
    plan = create(api, amir, body())

    assert plan["risk_check_id"] is None
    assert plan["risk_band"] is None and plan["risk_check_type"] is None
    assert plan["risk_score_at_creation"] is None


def test_no_trained_model_still_saves_the_plan(api, amir, fake_db):
    fill(fake_db)
    api.app.state.predictor = None

    plan = create(api, amir, body())

    assert plan["risk_check_id"] is None and plan["item_name"] == "Headphones"


def test_a_check_that_fails_never_stops_the_plan_being_saved(api, amir, fake_db, monkeypatch):
    fill(fake_db)

    def broken(*_args, **_kwargs):
        raise RuntimeError("the simulation fell over")

    monkeypatch.setattr(risk_routes, "assess", broken)

    plan = create(api, amir, body())

    assert plan["risk_check_id"] is None
    assert len(api.get("/api/plans", headers=amir).json()) == 1


def test_a_plan_that_cannot_be_saved_leaves_no_orphan_report(api, amir, fake_db, monkeypatch):
    fill(fake_db)

    def refuse(*_args, **_kwargs):
        raise RuntimeError("database down")

    monkeypatch.setattr(risk_routes, "store_plan", refuse)

    with pytest.raises(RuntimeError):
        api.post("/api/plans", json=body(), headers=amir)

    assert fake_db.rows("risk_checks") == []


def test_the_check_runs_before_the_plan_exists_so_a_plan_is_never_counted_against_itself(
    api, amir, fake_db, monkeypatch
):
    fill(fake_db)
    seen = []
    real = risk_routes.assess

    def spy(rows, items, plans, *args, **kwargs):
        seen.append(len(plans))
        return real(rows, items, plans, *args, **kwargs)

    monkeypatch.setattr(risk_routes, "assess", spy)

    create(api, amir, body(item_name="First"))
    create(api, amir, body(item_name="Second", total_price_sen=30000))

    assert seen == [0, 1]  # the second check sees the first plan, never itself


def test_each_person_sees_only_their_own_report(api, amir, siti, fake_db):
    fill(fake_db)
    plan = create(api, amir, body())

    assert api.get(f"/api/risk/checks/{plan['risk_check_id']}", headers=siti).status_code == 404
    assert api.get("/api/plans", headers=siti).json() == []


def test_deleting_a_plan_erases_its_snapshot(api, amir, fake_db):
    fill(fake_db)
    plan = create(api, amir, body())

    assert api.delete(f"/api/plans/{plan['id']}", headers=amir).status_code == 204

    assert fake_db.rows("risk_checks") == []


# ------------------------------------------------------------------ a plan that already started
def test_instalments_already_paid_are_a_record_and_log_nothing_unless_asked(api, amir, fake_db):
    fill(fake_db)

    plan = create(api, amir, existing(paid_seqs=[1, 2, 3]))

    assert (plan["paid_count"], plan["remaining_count"]) == (3, 3)
    paid = [i for i in plan["installments"] if i["is_paid"]]
    assert [i["seq"] for i in paid] == [1, 2, 3]
    assert all(i["paid_date"] == i["due_date"] for i in paid)  # recorded on the day it fell due
    assert plan_payments(fake_db) == []  # a record only: no expense was added to the ledger


def test_the_person_can_ask_for_those_payments_to_be_added_to_their_transactions(
    api, amir, fake_db
):
    fill(fake_db)

    plan = create(api, amir, existing(paid_seqs=[1, 2, 3], log_payments=True))

    logged = plan_payments(fake_db)
    assert sorted(r["date"] for r in logged) == ["2025-02-12", "2025-03-12", "2025-04-12"]
    assert {r["amount_sen"] for r in logged} == {20000}
    assert all(r["category"] == "BNPL" for r in logged)
    assert plan["paid_count"] == 3


def test_an_instalment_that_is_not_ticked_stays_unpaid_and_overdue(api, amir, fake_db):
    fill(fake_db)

    plan = create(api, amir, existing(paid_seqs=[1]))

    assert plan["paid_count"] == 1
    assert plan["status"] == "overdue"  # instalments 2 and 3 really are behind


def test_only_instalments_that_have_fallen_due_can_be_called_paid(api, amir):
    res = api.post("/api/plans", json=existing(paid_seqs=[6]), headers=amir)

    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "instalment_not_due"


def test_an_instalment_the_plan_does_not_have_is_refused(api, amir):
    res = api.post("/api/plans", json=existing(paid_seqs=[9]), headers=amir)

    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "unknown_instalment"


def test_listing_an_instalment_twice_is_harmless(api, amir):
    plan = create(api, amir, existing(paid_seqs=[1, 1, 2]))

    assert plan["paid_count"] == 2


def test_a_checkout_instalment_named_as_paid_is_not_logged_twice(api, amir, fake_db):
    fill(fake_db)
    # Atome takes the first instalment at checkout, so it is already paid and already logged
    plan = create(
        api,
        amir,
        body(provider="atome", purchase_date="2025-05-01", paid_seqs=[1], log_payments=True),
    )

    assert plan["paid_count"] == 1
    assert len([r for r in plan_payments(fake_db) if r["date"] == "2025-05-01"]) == 1


def test_a_past_purchase_has_no_30_day_limit_when_it_is_added_as_a_plan(api, amir):
    plan = create(api, amir, existing(purchase_date="2024-06-12", paid_seqs=[1, 2, 3, 4, 5]))

    assert plan["purchase_date"] == "2024-06-12"


# ------------------------------------------------------------------ the check of what is left
def test_a_plan_that_already_started_is_checked_on_what_is_still_owed(api, amir, fake_db):
    fill(fake_db)

    plan = create(api, amir, existing(paid_seqs=[1, 2, 3]))
    saved = report(api, amir, plan)

    assert plan["risk_check_type"] == "current_state"
    assert saved["check_type"] == "current_state"
    assert saved["plan"]["num_installments"] == 3  # the three still to pay, not all six
    assert saved["plan"]["total_payable_sen"] == 60000
    assert [i["amount_sen"] for i in saved["plan"]["installments"]] == [20000, 20000, 20000]
    assert saved["plan"]["upfront_sen"] == 0


def test_there_is_no_smallest_change_for_a_plan_that_already_exists(api, amir, fake_db):
    fill(fake_db)

    plan = create(api, amir, existing(paid_seqs=[1, 2, 3]))

    assert report(api, amir, plan)["suggestion"] is None


def test_an_instalment_that_is_behind_counts_as_due_today_in_the_check(api, amir, fake_db):
    fill(fake_db)

    plan = create(api, amir, existing(paid_seqs=[1]))
    saved = report(api, amir, plan)

    assert saved["plan"]["num_installments"] == 5
    assert saved["plan"]["installments"][0]["due_date"] == TODAY.isoformat()


def test_nothing_is_checked_when_every_instalment_is_already_paid(api, amir, fake_db):
    fill(fake_db)

    done = create(
        api,
        amir,
        existing(
            item_name="Old",
            purchase_date="2024-10-01",
            num_installments=3,
            total_price_sen=30000,
            paid_seqs=[1, 2, 3],
        ),
    )

    assert done["status"] == "completed"
    assert done["risk_check_id"] is None  # nothing is left to owe, so nothing to check


def test_the_same_remaining_schedule_gives_the_same_answer_however_the_past_was_recorded(
    api, amir, fake_db
):
    fill(fake_db)
    first = create(api, amir, existing(paid_seqs=[1, 2, 3]))
    first_report = report(api, amir, first)
    api.delete(f"/api/plans/{first['id']}", headers=amir)

    second = create(api, amir, existing(paid_seqs=[1, 2, 3], log_payments=True))
    second_report = report(api, amir, second)

    for field in ("probability", "score", "band", "simulated_probability", "with_plan_curve"):
        assert first_report[field] == second_report[field], field


def test_the_old_report_without_a_type_still_reads_as_before_purchase(api, amir, fake_db):
    fill(fake_db)
    confirmed = api.post("/api/risk/confirm", json=body(), headers=amir).json()
    stored = fake_db.rows("risk_checks")[0]["input"]
    stored.pop("kind", None)  # a report saved before the type was recorded

    read = api.get(f"/api/risk/checks/{confirmed['check_id']}", headers=amir).json()

    assert read["check_type"] == "before_purchase"
    assert confirmed["check"]["check_type"] == "before_purchase"
