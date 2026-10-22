"""Users. `get_by_username` is the one deliberately unscoped read: it is how a session starts."""

import re
from typing import Any

from postgrest import APIError

from app.db.base import is_uuid
from app.db.client import Database

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")
PERSONAS = frozenset({"frequent_bnpl", "budget_conscious", "irregular_income"})
# A role is authorisation data on the user row (ADR D-56): read from the database on every
# request, never from the token or the request.
ROLES = frozenset({"user", "admin"})
DEFAULT_ROLE = "user"
UNIQUE_VIOLATION = "23505"


class UsernameTakenError(Exception):
    """A user with this username (case-insensitive) already exists."""


def normalise_username(raw: str) -> str | None:
    """Trimmed username if it is well-formed, else None. Never raises on hostile input."""
    candidate = raw.strip() if isinstance(raw, str) else ""
    return candidate if USERNAME_PATTERN.fullmatch(candidate) else None


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def get_by_username(db: Database, username: str) -> dict[str, Any] | None:
    name = normalise_username(username)
    if name is None:
        return None
    rows = (
        db.table("users").select("*").ilike("username", _escape_like(name)).limit(2).execute().data
    )
    exact = [r for r in rows if r["username"].lower() == name.lower()]
    return exact[0] if exact else None


def role_of(row: dict[str, Any]) -> str:
    """The row's role. A row from a database before migration 0003 has none, and a value this
    build does not know confers nothing: both read as an ordinary user."""
    role = row.get("role")
    return role if role in ROLES else DEFAULT_ROLE


def get_by_id(db: Database, user_id: str) -> dict[str, Any] | None:
    if not is_uuid(user_id):
        return None
    rows = db.table("users").select("*").eq("id", user_id).limit(1).execute().data
    return rows[0] if rows else None


def create(
    db: Database,
    *,
    username: str,
    display_name: str,
    persona: str | None = None,
    role: str = DEFAULT_ROLE,
) -> dict[str, Any]:
    name = normalise_username(username)
    if name is None:
        raise ValueError("username must be 1-64 characters: letters, digits, '.', '_' or '-'")
    if persona is not None and persona not in PERSONAS:
        raise ValueError(f"persona must be one of {sorted(PERSONAS)}")
    if not display_name.strip():
        raise ValueError("display_name is required")
    if role not in ROLES:
        raise ValueError(f"role must be one of {sorted(ROLES)}")
    row: dict[str, Any] = {
        "username": name,
        "display_name": display_name.strip(),
        "persona": persona,
    }
    if role != DEFAULT_ROLE:  # an ordinary user needs no role column, so seeding works before 0003
        row["role"] = role
    try:
        created = db.table("users").insert(row).execute().data
    except APIError as err:
        if err.code == UNIQUE_VIOLATION:
            raise UsernameTakenError(name) from err
        raise
    return created[0]


def update_user(
    db: Database,
    username: str,
    *,
    role: str | None = None,
    display_name: str | None = None,
    new_username: str | None = None,
) -> dict[str, Any] | None:
    """Change a user's role, display name and/or username, found by username. None if there is no
    such user. A username already taken by someone else (in any letter case) raises
    `UsernameTakenError`; nothing is changed then.

    Like `get_by_username` this is deliberately unscoped: it is the author's own tool
    (`scripts/set_role.py`), never reachable from a route. A login session names the person's id,
    not their username, so a rename does not end anyone's session."""
    changes: dict[str, Any] = {}
    if role is not None:
        if role not in ROLES:
            raise ValueError(f"role must be one of {sorted(ROLES)}")
        changes["role"] = role
    if display_name is not None:
        if not display_name.strip():
            raise ValueError("display_name is required")
        changes["display_name"] = display_name.strip()
    if new_username is not None:
        wanted = normalise_username(new_username)
        if wanted is None:
            raise ValueError("username must be 1-64 characters: letters, digits, '.', '_' or '-'")
        changes["username"] = wanted
    if not changes:
        raise ValueError("nothing to change: give a role, a display name or a new username")
    user = get_by_username(db, username)
    if user is None:
        return None
    if "username" in changes:
        holder = get_by_username(db, changes["username"])
        if holder is not None and holder["id"] != user["id"]:
            raise UsernameTakenError(changes["username"])
    try:
        updated = db.table("users").update(changes).eq("id", user["id"]).execute().data
    except APIError as err:
        if err.code == UNIQUE_VIOLATION:  # the unique index on lower(username) is the last guard
            raise UsernameTakenError(changes.get("username", username)) from err
        raise
    return updated[0] if updated else None
