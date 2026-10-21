"""Settings: what a person has, a copy of it, and clearing it (ADR D-50).

The danger here is deleting the wrong person's data, so every route is tested with two people.
"""

from datetime import date

import pytest

from app.api import account as account_routes
from app.db import categories, provider_limits, recurring_items, risk_checks, user_settings, users
from app.db import plans as plans_repo
from app.db import transactions as transactions_repo
from app.domain.providers import get_provider
from app.domain.schedule import build_schedule

PURCHASE = date(2026, 3, 5)
ALL = ["transactions", "plans", "recurring", "limits", "categories"]


def uid(fake_db, name="amir"):
    return users.get_by_username(fake_db, name)["id"]


def fill(fake_db, name="amir", tag="a"):
    u = uid(fake_db, name)
    transactions_repo.bulk_create(
        fake_db,
        u,
        [
            {
                "date": "2026-03-01",
                "amount_sen": 650,
                "type": "expense",
                "category": "Food",
                "description": f"Lunch {tag}",
            },
            {
                "date": "2026-03-05",
                "amount_sen": 100000,
                "type": "income",
                "category": "Allowance",
                "description": f"PESP {tag}",
            },
        ],
        source="seed",
    )
    instalments = build_schedule("atome", 30000, 0, 3, PURCHASE)
    stored = risk_checks.create(
        fake_db,
        u,
        {
            "input": {},
            "features": {},
            "feature_schema_hash": "x",
            "model_version": "v",
            "p": 0.1,
            "p_simulated": 0.1,
            "score": 90,
            "label": "safe",
            "factors": [],
        },
    )
    plans_repo.create_plan(
        fake_db,
        u,
        {
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
            "risk_check_id": stored["id"],
            "risk_check_type": "before_purchase",
        },
        instalments,
    )
    recurring_items.create(
        fake_db,
        u,
        kind="bill",
        name=f"Rent {tag}",
        amount_sen=45000,
        cadence="monthly",
        anchor_date="2026-03-25",
    )
    provider_limits.upsert_limit(fake_db, u, "atome", 50000)
    categories.add(fake_db, u, f"Gym {tag}")


def reset(api, headers, scopes=None, confirm="RESET"):
    body = {"scopes": ALL if scopes is None else scopes}
    if confirm is not None:
        body["confirm"] = confirm
    return api.post("/api/account/reset", json=body, headers=headers)


def summary(api, headers):
    return api.get("/api/account/summary", headers=headers).json()


# Two transactions are typed in; Atome takes its first instalment at checkout, which logs a third.
class TestSummary:
    def test_it_counts_what_the_person_has(self, api, amir, fake_db):
        fill(fake_db)

        res = api.get("/api/account/summary", headers=amir)

        assert res.status_code == 200
        assert res.json() == {
            "transactions": 3,
            "plans": 1,
            "recurring": 1,
            "limits": 1,
            "categories": 1,
        }

    def test_each_person_sees_only_their_own_counts(self, api, amir, siti, fake_db):
        fill(fake_db, "amir")

        assert summary(api, siti)["transactions"] == 0

    def test_it_needs_a_login(self, api):
        assert api.get("/api/account/summary").status_code == 401


class TestReset:
    def test_the_word_must_be_exactly_RESET_and_nothing_is_deleted_otherwise(
        self, api, amir, fake_db
    ):
        fill(fake_db)

        for bad in (None, "", "reset", "RESET ", "yes"):
            assert reset(api, amir, confirm=bad).status_code == 422

        assert summary(api, amir)["transactions"] == 3

    @pytest.mark.parametrize(
        "scopes",
        [[], ["everything"], ["transactions", "transactions"], ALL + ["extra"]],
    )
    def test_the_choice_of_what_to_clear_must_be_valid(self, api, amir, fake_db, scopes):
        fill(fake_db)

        assert reset(api, amir, scopes=scopes).status_code == 422
        assert summary(api, amir)["transactions"] == 3

    def test_it_clears_only_what_was_ticked_and_says_how_much(self, api, amir, fake_db):
        fill(fake_db)

        res = reset(api, amir, scopes=["transactions", "limits"])

        assert res.status_code == 200
        assert res.json()["removed"] == {
            "transactions": 3,
            "plans": 0,
            "recurring": 0,
            "limits": 1,
            "categories": 0,
        }
        assert res.json()["factory_reset"] is False
        after = summary(api, amir)
        assert (after["transactions"], after["limits"]) == (0, 0)
        assert (after["plans"], after["recurring"], after["categories"]) == (1, 1, 1)

    def test_clearing_everything_is_a_factory_reset_and_puts_onboarding_back_to_new(
        self, api, amir, fake_db
    ):
        fill(fake_db)
        user_settings.set_onboarding_state(fake_db, uid(fake_db), "complete")

        res = reset(api, amir)

        assert res.status_code == 200 and res.json()["factory_reset"] is True
        assert set(summary(api, amir).values()) == {0}
        assert user_settings.get(fake_db, uid(fake_db))["onboarding_state"] == "new"

    def test_the_account_itself_survives_so_the_person_can_start_again(self, api, amir, fake_db):
        fill(fake_db)
        reset(api, amir)

        assert api.get("/api/auth/me", headers=amir).status_code == 200

    def test_clearing_one_person_never_touches_another(self, api, amir, siti, fake_db):
        fill(fake_db, "amir", "a")
        fill(fake_db, "siti", "s")
        before = summary(api, siti)

        assert reset(api, amir).status_code == 200

        assert summary(api, siti) == before

    def test_a_second_reset_straight_after_succeeds_and_removes_nothing(self, api, amir, fake_db):
        fill(fake_db)
        reset(api, amir)

        again = reset(api, amir)

        assert again.status_code == 200
        assert set(again.json()["removed"].values()) == {0}

    def test_a_reset_that_is_already_running_for_the_person_is_refused(self, api, amir, fake_db):
        fill(fake_db)
        lock = account_routes._reset_lock(uid(fake_db))
        lock.acquire()
        try:
            res = reset(api, amir)
        finally:
            lock.release()

        assert res.status_code == 409
        assert summary(api, amir)["transactions"] == 3

    def test_it_needs_a_login(self, api):
        res = api.post("/api/account/reset", json={"scopes": ["transactions"], "confirm": "RESET"})

        assert res.status_code == 401


class TestExport:
    def test_the_csv_is_the_import_templates_format_and_a_download(self, api, amir, fake_db):
        fill(fake_db)

        res = api.get("/api/account/export?format=csv", headers=amir)

        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/csv")
        assert "attachment" in res.headers["content-disposition"]
        assert ".csv" in res.headers["content-disposition"]
        lines = res.text.splitlines()
        assert lines[0] == "type,date,item,amount,category"
        assert "expense,2026-03-01,Lunch a,6.50,Food" in lines
        assert "income,2026-03-05,PESP a,1000.00,Allowance" in lines

    def test_the_json_holds_everything_with_money_in_integer_sen(self, api, amir, fake_db):
        fill(fake_db)

        res = api.get("/api/account/export?format=json", headers=amir)

        assert res.status_code == 200
        assert "attachment" in res.headers["content-disposition"]
        data = res.json()
        assert {t["amount_sen"] for t in data["transactions"]} >= {650, 100000}
        plan = data["plans"][0]
        assert plan["item_name"] == "Phone a"
        assert [i["amount_sen"] for i in plan["installments"]] == [10000, 10000, 10000]
        assert data["recurring_items"][0]["amount_sen"] == 45000
        assert data["provider_limits"] == [{"provider": "atome", "limit_sen": 50000}]
        assert data["categories"] == ["Gym a"]

    def test_it_never_includes_another_persons_data_or_internal_ids(self, api, amir, siti, fake_db):
        fill(fake_db, "amir", "a")
        fill(fake_db, "siti", "s")

        text = api.get("/api/account/export?format=json", headers=amir).text

        assert "Lunch s" not in text and "Phone s" not in text and "Gym s" not in text
        assert uid(fake_db, "siti") not in text
        assert uid(fake_db, "amir") not in text  # nobody needs their own database id in a file

    def test_a_format_that_does_not_exist_is_refused(self, api, amir):
        assert api.get("/api/account/export?format=xml", headers=amir).status_code == 422

    def test_it_needs_a_login(self, api):
        assert api.get("/api/account/export?format=csv").status_code == 401

    def test_the_download_is_never_cached_or_sniffed(self, api, amir, fake_db):
        fill(fake_db)

        for fmt in ("csv", "json"):
            res = api.get(f"/api/account/export?format={fmt}", headers=amir)
            assert res.headers["cache-control"] == "no-store"
            assert res.headers["x-content-type-options"] == "nosniff"

    def test_it_is_rate_limited_so_one_person_cannot_hammer_it(self, api, amir, fake_db):
        fill(fake_db)

        codes = [
            api.get("/api/account/export?format=csv", headers=amir).status_code for _ in range(7)
        ]

        assert codes[:5] == [200] * 5
        assert 429 in codes[5:]
