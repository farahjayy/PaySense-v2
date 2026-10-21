"""GET /api/alerts: the dashboard's alert line (ADR D-52), scoped to the signed-in person."""

from datetime import date

import pytest

from app.api.deps import get_today
from app.db import plans as plans_repo
from app.db import provider_limits, recurring_items, users
from app.domain.schedule import Instalment

TODAY = date(2026, 10, 21)


@pytest.fixture(autouse=True)
def pinned(api):
    api.app.dependency_overrides[get_today] = lambda: TODAY
    yield
    api.app.dependency_overrides.clear()


def uid(fake_db, username):
    return users.get_by_username(fake_db, username)["id"]


def a_plan(fake_db, username, provider, label, unpaid):
    instalments = [Instalment(n, due, sen, False) for n, (due, sen) in enumerate(unpaid, start=1)]
    return plans_repo.create_plan(
        fake_db,
        uid(fake_db, username),
        {
            "item_name": "Phone",
            "provider": provider,
            "provider_label": label,
            "schedule_source": "provider_rule",
            "total_price_sen": sum(sen for _, sen in unpaid),
            "financed_sen": sum(sen for _, sen in unpaid),
            "upfront_sen": 0,
            "monthly_fee_rate_pct": 0,
            "num_installments": len(unpaid),
            "purchase_date": date(2026, 6, 1),
            "first_payment_date": unpaid[0][0],
        },
        instalments,
    )


def test_the_route_refuses_anonymous_requests(api):
    assert api.get("/api/alerts").status_code == 401


def test_a_person_with_nothing_to_flag_gets_an_empty_list(api, amir):
    res = api.get("/api/alerts", headers=amir)

    assert res.status_code == 200 and res.json() == {"items": []}


def test_an_overdue_instalment_is_flagged(api, amir, fake_db):
    a_plan(fake_db, "amir", "spaylater", "SPayLater", [(date(2026, 10, 1), 7_000)])

    [alert] = api.get("/api/alerts", headers=amir).json()["items"]

    assert alert["rule"] == "overdue" and alert["severity"] == "high"
    assert alert["href"] == "/plans"


def test_another_persons_overdue_plan_never_shows_for_me(api, amir, siti, fake_db):
    a_plan(fake_db, "siti", "spaylater", "SPayLater", [(date(2026, 10, 1), 7_000)])

    assert api.get("/api/alerts", headers=amir).json() == {"items": []}
    assert len(api.get("/api/alerts", headers=siti).json()["items"]) == 1


def test_a_confirmed_bill_and_an_instalment_in_the_same_week_are_a_collision(api, amir, fake_db):
    a_plan(fake_db, "amir", "atome", "Atome", [(date(2026, 10, 28), 12_000)])
    recurring_items.create(
        fake_db, uid(fake_db, "amir"), kind="bill", name="Rent",
        amount_sen=35_000, cadence="monthly", anchor_date=date(2026, 9, 30),
    )  # fmt: skip

    [alert] = api.get("/api/alerts", headers=amir).json()["items"]

    assert alert["rule"] == "collision" and "RM 470.00" in alert["detail"]


def test_an_income_or_a_switched_off_bill_is_not_a_payment(api, amir, fake_db):
    me = uid(fake_db, "amir")
    a_plan(fake_db, "amir", "atome", "Atome", [(date(2026, 10, 28), 12_000)])
    recurring_items.create(
        fake_db, me, kind="income", name="Allowance",
        amount_sen=90_000, cadence="monthly", anchor_date=date(2026, 9, 30),
    )  # fmt: skip
    recurring_items.create(
        fake_db, me, kind="bill", name="Old gym", amount_sen=9_000,
        cadence="monthly", anchor_date=date(2026, 9, 30), active=False,
    )  # fmt: skip

    assert api.get("/api/alerts", headers=amir).json() == {"items": []}


def test_a_nearly_used_limit_is_flagged_from_the_limit_the_person_recorded(api, amir, fake_db):
    a_plan(fake_db, "amir", "spaylater", "SPayLater", [(date(2027, 3, 1), 80_000)])
    provider_limits.upsert_limit(fake_db, uid(fake_db, "amir"), "spaylater", 100_000)

    [alert] = api.get("/api/alerts", headers=amir).json()["items"]

    assert alert["rule"] == "limit_near" and alert["title"] == "SPayLater limit is 80% used"


def test_my_bills_and_limits_never_raise_someone_elses_alerts(api, amir, siti, fake_db):
    # siti has a plan nearly at its limit and a bill that collides with it; amir has neither
    a_plan(fake_db, "siti", "spaylater", "SPayLater", [(date(2026, 10, 28), 80_000)])
    provider_limits.upsert_limit(fake_db, uid(fake_db, "siti"), "spaylater", 100_000)
    recurring_items.create(
        fake_db, uid(fake_db, "siti"), kind="bill", name="Rent",
        amount_sen=35_000, cadence="monthly", anchor_date=date(2026, 9, 30),
    )  # fmt: skip

    assert api.get("/api/alerts", headers=amir).json() == {"items": []}
    assert {a["rule"] for a in api.get("/api/alerts", headers=siti).json()["items"]} == {
        "collision",
        "limit_near",
    }


def test_the_alerts_route_is_limited_per_user(api, amir, siti):
    statuses = [api.get("/api/alerts", headers=amir).status_code for _ in range(61)]

    assert statuses[:60] == [200] * 60 and statuses[60] == 429
    assert api.get("/api/alerts", headers=siti).status_code == 200


def test_every_alert_points_at_a_page_inside_the_app(api, amir, fake_db):
    a_plan(fake_db, "amir", "spaylater", "SPayLater", [(date(2026, 10, 1), 7_000)])

    assert {a["href"] for a in api.get("/api/alerts", headers=amir).json()["items"]} == {"/plans"}
