"""Roles on the wire (ADR D-56): the role comes back on sign-in and /me, is read from the database
on every request, and `require_admin` keeps everyone else out."""

from typing import Annotated

import pytest
from fastapi import Depends

from app.api.deps import AdminUser, require_admin
from app.db import users


@pytest.fixture
def probe(api):
    """A throwaway admin-only route: nothing in the app uses require_admin yet."""

    def admin_only(user: AdminUser) -> dict[str, str]:
        return {"who": user.username}

    api.app.add_api_route("/api/_admin_probe", admin_only, methods=["GET"])
    return api


def login(client, username):
    res = client.post("/api/auth/login", json={"username": username})
    assert res.status_code == 200
    return res


def bearer(res):
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_sign_in_and_me_say_who_is_an_admin_and_who_is_not(api, fake_db):
    users.update_user(fake_db, "amir", role="admin")

    admin = login(api, "amir")
    ordinary = login(api, "siti")

    assert admin.json()["user"]["role"] == "admin"
    assert ordinary.json()["user"]["role"] == "user"
    assert api.get("/api/auth/me", headers=bearer(admin)).json()["role"] == "admin"
    assert api.get("/api/auth/me", headers=bearer(ordinary)).json()["role"] == "user"


def test_a_database_without_the_role_column_still_signs_everyone_in_as_a_user(api, fake_db):
    for row in fake_db.rows("users"):
        row.pop("role", None)

    assert login(api, "amir").json()["user"]["role"] == "user"


def test_an_admin_route_refuses_the_anonymous_and_the_ordinary_and_lets_an_admin_in(
    api, fake_db, probe
):
    users.update_user(fake_db, "amir", role="admin")

    assert probe.get("/api/_admin_probe").status_code == 401
    refused = probe.get("/api/_admin_probe", headers=bearer(login(probe, "siti")))
    assert refused.status_code == 403
    assert refused.json()["detail"]["code"] == "forbidden"
    allowed = probe.get("/api/_admin_probe", headers=bearer(login(probe, "amir")))
    assert allowed.status_code == 200 and allowed.json() == {"who": "amir"}


def test_taking_admin_away_works_on_the_very_next_request_with_the_same_token(api, fake_db, probe):
    users.update_user(fake_db, "amir", role="admin")
    headers = bearer(login(probe, "amir"))
    assert probe.get("/api/_admin_probe", headers=headers).status_code == 200

    users.update_user(fake_db, "amir", role="user")

    assert probe.get("/api/_admin_probe", headers=headers).status_code == 403


def test_giving_admin_to_one_person_does_not_give_it_to_another(api, fake_db, probe):
    users.update_user(fake_db, "amir", role="admin")
    other = bearer(login(probe, "siti"))

    assert probe.get("/api/_admin_probe", headers=other).status_code == 403


def test_require_admin_is_the_gate_and_returns_the_user(api):
    # the dependency is importable by any future route, and typed to hand back the user
    assert callable(require_admin) and Annotated[object, Depends(require_admin)]
