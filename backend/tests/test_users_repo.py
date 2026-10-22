import pytest

from app.db import user_settings
from app.db.users import UsernameTakenError, create, get_by_id, get_by_username
from tests.fakes import FakeSupabase


@pytest.fixture
def db() -> FakeSupabase:
    return FakeSupabase()


def test_create_then_lookup_by_username(db):
    user = create(db, username="amir", display_name="Amir", persona="frequent_bnpl")

    found = get_by_username(db, "amir")

    assert found["id"] == user["id"]
    assert found["persona"] == "frequent_bnpl"


def test_lookup_is_case_insensitive_and_trims(db):
    user = create(db, username="Amir", display_name="Amir")

    assert get_by_username(db, "  aMIR ")["id"] == user["id"]


def test_unknown_username_returns_none(db):
    assert get_by_username(db, "nobody") is None


@pytest.mark.parametrize("hostile", ["%", "a%", "_mir", "amir%", "x' or '1'='1", "", "   "])
def test_wildcards_and_junk_never_match_a_user(db, hostile):
    create(db, username="amir", display_name="Amir")

    assert get_by_username(db, hostile) is None


def test_duplicate_username_is_rejected_case_insensitively(db):
    create(db, username="amir", display_name="Amir")

    with pytest.raises(UsernameTakenError):
        create(db, username="AMIR", display_name="Other Amir")


def test_invalid_username_is_rejected_on_create(db):
    with pytest.raises(ValueError, match="username"):
        create(db, username="has space", display_name="X")


def test_get_by_id(db):
    user = create(db, username="amir", display_name="Amir")

    assert get_by_id(db, user["id"])["username"] == "amir"
    assert get_by_id(db, "00000000-0000-0000-0000-000000000000") is None


def test_default_settings_are_created_without_any_balance(db):
    user = create(db, username="amir", display_name="Amir")

    settings = user_settings.create_default(db, user["id"])

    assert settings["onboarding_state"] == "new"
    # D-27: the forecast runs on flows, so there is no balance to store.
    assert set(settings) == {"user_id", "onboarding_state"}
    assert user_settings.get(db, user["id"])["onboarding_state"] == "new"


def test_create_default_settings_is_idempotent(db):
    user = create(db, username="amir", display_name="Amir")

    first = user_settings.create_default(db, user["id"])
    second = user_settings.create_default(db, user["id"])

    assert first["user_id"] == second["user_id"]
    assert len(db.rows("user_settings")) == 1


def test_onboarding_state_can_advance_and_rejects_unknown_states(db):
    user = create(db, username="amir", display_name="Amir")
    user_settings.create_default(db, user["id"])

    updated = user_settings.set_onboarding_state(db, user["id"], "history_imported")

    assert updated["onboarding_state"] == "history_imported"
    with pytest.raises(ValueError, match="onboarding_state"):
        user_settings.set_onboarding_state(db, user["id"], "finished")


def test_setting_the_onboarding_state_creates_the_row_if_it_is_missing(db):
    user = create(db, username="amir", display_name="Amir")

    updated = user_settings.set_onboarding_state(db, user["id"], "history_imported")

    assert updated["onboarding_state"] == "history_imported"
    assert len(db.rows("user_settings")) == 1


def test_setting_the_onboarding_state_only_touches_that_user(db):
    amir = create(db, username="amir", display_name="Amir")
    siti = create(db, username="siti", display_name="Siti")
    user_settings.create_default(db, siti["id"])

    user_settings.set_onboarding_state(db, amir["id"], "complete")

    assert user_settings.get(db, siti["id"])["onboarding_state"] == "new"


# ------------------------------------------------------------------ roles (ADR D-56)
def test_a_new_user_is_an_ordinary_user_by_default(db):
    from app.db.users import role_of

    user = create(db, username="amir", display_name="Amir")

    assert role_of(get_by_username(db, "amir")) == "user"
    assert role_of(user) == "user"


def test_an_admin_can_be_created_and_a_made_up_role_cannot(db):
    from app.db.users import role_of

    admin = create(db, username="farah", display_name="Farah", role="admin")

    assert role_of(get_by_username(db, "farah")) == "admin" and admin["role"] == "admin"
    with pytest.raises(ValueError, match="role"):
        create(db, username="root", display_name="Root", role="root")


def test_a_row_from_a_database_without_the_role_column_reads_as_a_user(db):
    from app.db.users import role_of

    user = create(db, username="amir", display_name="Amir")
    user.pop("role", None)

    assert role_of(user) == "user"
    assert role_of({"role": None}) == "user"
    assert role_of({"role": "auditor"}) == "user"  # a value this build does not know is no power


def test_the_role_and_display_name_can_be_changed_by_username(db):
    from app.db.users import role_of, update_user

    create(db, username="amir-k7q2xm", display_name="Amir")

    changed = update_user(db, "AMIR-k7q2xm", role="admin", display_name="  Farah ")

    assert changed is not None
    assert role_of(changed) == "admin" and changed["display_name"] == "Farah"
    assert role_of(get_by_username(db, "amir-k7q2xm")) == "admin"


def test_changing_only_one_thing_leaves_the_other_alone(db):
    from app.db.users import role_of, update_user

    create(db, username="amir", display_name="Amir", role="admin")

    renamed = update_user(db, "amir", display_name="Farah")

    assert renamed["display_name"] == "Farah" and role_of(renamed) == "admin"


def test_updating_an_unknown_user_returns_none_and_a_bad_value_is_refused(db):
    from app.db.users import update_user

    create(db, username="amir", display_name="Amir")

    assert update_user(db, "nobody", role="admin") is None
    with pytest.raises(ValueError, match="role"):
        update_user(db, "amir", role="superuser")
    with pytest.raises(ValueError, match="display_name"):
        update_user(db, "amir", display_name="   ")
    with pytest.raises(ValueError, match="nothing"):
        update_user(db, "amir")


def test_changing_one_users_role_never_touches_another(db):
    from app.db.users import role_of, update_user

    create(db, username="amir", display_name="Amir")
    create(db, username="siti", display_name="Siti")

    update_user(db, "amir", role="admin")

    assert role_of(get_by_username(db, "siti")) == "user"


def test_a_role_in_the_wrong_case_or_with_spaces_confers_nothing(db):
    from app.db.users import role_of

    for odd in ("Admin", "ADMIN", " admin", "admin ", ""):
        assert role_of({"role": odd}) == "user", repr(odd)


# --------------------------------------------------------------- renaming (the author's tool)
def test_a_user_can_be_given_a_new_username_and_the_old_one_stops_working(db):
    from app.db.users import update_user

    user = create(db, username="amir-k7q2xm", display_name="Amir")

    renamed = update_user(db, "amir-k7q2xm", new_username="admin")

    assert renamed["username"] == "admin" and renamed["id"] == user["id"]
    assert get_by_username(db, "admin")["id"] == user["id"]
    assert get_by_username(db, "amir-k7q2xm") is None


def test_a_rename_can_be_combined_with_a_role_and_a_display_name(db):
    from app.db.users import role_of, update_user

    create(db, username="amir-k7q2xm", display_name="Amir")

    done = update_user(db, "amir-k7q2xm", new_username="admin", role="admin", display_name="Farah")

    assert (done["username"], done["display_name"], role_of(done)) == ("admin", "Farah", "admin")


def test_a_username_that_is_taken_cannot_be_used_even_in_another_case(db):
    from app.db.users import update_user

    create(db, username="amir", display_name="Amir")
    create(db, username="Siti", display_name="Siti")

    with pytest.raises(UsernameTakenError):
        update_user(db, "amir", new_username="siti")
    assert get_by_username(db, "amir") is not None  # nothing changed


def test_changing_only_the_case_of_ones_own_username_is_allowed(db):
    from app.db.users import update_user

    create(db, username="admin", display_name="Farah")

    assert update_user(db, "admin", new_username="Admin")["username"] == "Admin"


def test_a_new_username_must_be_well_formed(db):
    from app.db.users import update_user

    create(db, username="amir", display_name="Amir")

    for bad in ("", "  ", "has space", "a" * 65, "semi;colon"):
        with pytest.raises(ValueError, match="username"):
            update_user(db, "amir", new_username=bad)
    assert get_by_username(db, "amir") is not None


def test_renaming_one_user_leaves_everyone_else_alone(db):
    from app.db.users import update_user

    create(db, username="amir", display_name="Amir")
    siti = create(db, username="siti", display_name="Siti")

    update_user(db, "amir", new_username="admin")

    assert get_by_username(db, "siti")["id"] == siti["id"]
