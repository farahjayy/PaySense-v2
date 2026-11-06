"""The colour and icon a person gives a category (ADR D-64). Every function takes `user_id` first
and goes through ScopedTable. A row exists only when something was chosen; no row is the default
look. Names are matched without regard to case, as the categories themselves are."""

from typing import Any

from app.db.base import ScopedTable
from app.db.client import Database

TABLE = "user_category_styles"


def _table(db: Database) -> ScopedTable:
    return ScopedTable(db, TABLE)


def _row(db: Database, user_id: str, name: str) -> dict[str, Any] | None:
    folded = name.casefold()
    return next((r for r in _table(db).list_rows(user_id) if r["name"].casefold() == folded), None)


def styles(db: Database, user_id: str) -> dict[str, tuple[str | None, str | None]]:
    """{category name: (icon, colour)} for what the person chose; either part may be None."""
    rows = _table(db).list_rows(user_id, columns="name,icon,colour")
    return {r["name"]: (r["icon"], r["colour"]) for r in rows}


def set_style(db: Database, user_id: str, name: str, icon: str | None, colour: str | None) -> None:
    """Store the look; choosing nothing for both puts the default back."""
    existing = _row(db, user_id, name)
    if icon is None and colour is None:
        if existing:
            _table(db).delete(user_id, existing["id"])
        return
    patch = {"icon": icon, "colour": colour}
    if existing:
        _table(db).update(user_id, existing["id"], patch)
    else:
        _table(db).insert(user_id, {"name": name, **patch})


def clear(db: Database, user_id: str, name: str) -> None:
    existing = _row(db, user_id, name)
    if existing:
        _table(db).delete(user_id, existing["id"])


def move(db: Database, user_id: str, old: str, new: str) -> None:
    """A renamed category keeps its look. If `new` somehow has a look already, it is replaced."""
    existing = _row(db, user_id, old)
    if existing is None:
        return
    clear(db, user_id, new)
    _table(db).update(user_id, existing["id"], {"name": new})


def delete_all(db: Database, user_id: str) -> int:
    return _table(db).delete_all(user_id)
