"""Seeding an admin and the author's own account update (ADR D-56)."""

import pytest

from app.db import users
from app.seed import seed_user
from tests.fakes import FakeSupabase


@pytest.fixture
def db() -> FakeSupabase:
    return FakeSupabase()


def test_seeding_with_a_role_creates_an_admin(db):
    user, created = seed_user(
        db, username="farah", display_name="Farah", persona=None, role="admin"
    )

    assert created and users.role_of(user) == "admin"


def test_seeding_without_a_role_creates_an_ordinary_user(db):
    user, _ = seed_user(db, username="amir", display_name="Amir", persona="frequent_bnpl")

    assert users.role_of(user) == "user"


def test_seeding_again_does_not_change_an_existing_users_role(db):
    seed_user(db, username="farah", display_name="Farah", persona=None, role="admin")

    again, created = seed_user(db, username="farah", display_name="Farah", persona=None)

    assert not created and users.role_of(users.get_by_username(db, "farah")) == "admin"
    assert again["username"] == "farah"


def test_seeding_with_a_made_up_role_is_refused(db):
    with pytest.raises(ValueError, match="role"):
        seed_user(db, username="x", display_name="X", persona=None, role="root")
