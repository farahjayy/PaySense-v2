"""The look a person gives a category (ADR D-64): user-scoped; nothing is stored until chosen."""

import pytest

from app.db import category_styles as repo
from app.db.users import create as create_user
from tests.fakes import FakeSupabase


@pytest.fixture
def db() -> FakeSupabase:
    return FakeSupabase()


@pytest.fixture
def amir(db) -> str:
    return create_user(db, username="amir", display_name="Amir")["id"]


@pytest.fixture
def siti(db) -> str:
    return create_user(db, username="siti", display_name="Siti")["id"]


def test_nothing_is_stored_until_the_person_chooses(db, amir):
    assert repo.styles(db, amir) == {}


def test_choosing_a_look_stores_it_for_that_person(db, amir):
    repo.set_style(db, amir, "Food", "drink", "plum")

    assert repo.styles(db, amir) == {"Food": ("drink", "plum")}


def test_choosing_again_replaces_the_look_in_place(db, amir):
    repo.set_style(db, amir, "Gym", "tag", "rust")
    repo.set_style(db, amir, "gym", None, "sky")

    assert repo.styles(db, amir) == {"Gym": (None, "sky")}


def test_choosing_nothing_for_both_puts_the_default_back(db, amir):
    repo.set_style(db, amir, "Gym", "tag", "rust")

    repo.set_style(db, amir, "Gym", None, None)

    assert repo.styles(db, amir) == {}


def test_a_look_follows_a_rename_and_goes_with_a_delete(db, amir):
    repo.set_style(db, amir, "Gym", "tag", "rust")

    repo.move(db, amir, "Gym", "Fitness")
    assert repo.styles(db, amir) == {"Fitness": ("tag", "rust")}

    repo.clear(db, amir, "fitness")
    assert repo.styles(db, amir) == {}


def test_moving_a_name_that_has_no_look_changes_nothing(db, amir):
    repo.move(db, amir, "Gym", "Fitness")

    assert repo.styles(db, amir) == {}


def test_each_person_has_their_own_looks(db, amir, siti):
    repo.set_style(db, amir, "Food", "drink", "plum")

    assert repo.styles(db, siti) == {}
    repo.set_style(db, siti, "Food", "tag", "sky")
    repo.clear(db, siti, "Food")
    assert repo.styles(db, amir) == {"Food": ("drink", "plum")}


def test_clearing_everything_only_clears_the_callers_looks(db, amir, siti):
    repo.set_style(db, amir, "Food", "drink", "plum")
    repo.set_style(db, siti, "Food", "tag", "sky")

    assert repo.delete_all(db, amir) == 1

    assert repo.styles(db, amir) == {}
    assert repo.styles(db, siti) == {"Food": ("tag", "sky")}
