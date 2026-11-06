"""Categories: the ones a person can pick, and managing their own (ADR D-43).

Names travel in the body or the query string, never in the path: "Drink/Dessert" has a slash.
"""

import logging
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict

from app.api.deps import CurrentUser, DbDep, rate_limited
from app.api.schemas import CONFLICT_RESPONSE, NOT_FOUND_RESPONSE, PROTECTED_RESPONSES, ApiModel
from app.api.types import text
from app.core.errors import conflict, not_found, unprocessable
from app.db import categories, category_styles, transactions
from app.db.client import Database
from app.domain.categories import (
    CHANGES_THE_MATHS,
    COLOURS,
    ICONS,
    MAX_NAME_LENGTH,
    CategoryEntry,
    build_listing,
    clean_name,
    locked_name,
)

logger = logging.getLogger("paysense")

router = APIRouter(prefix="/categories", tags=["categories"], responses=PROTECTED_RESPONSES)

NameQuery = Annotated[str, Query(min_length=1, max_length=200)]
# Writes read the whole ledger (to count and to move rows), so one person cannot spam them.
WRITE_LIMIT = rate_limited("categories-write", 20, 60)


# The looks a person may choose (ADR D-64). Literals, so the schema the frontend is generated from
# lists exactly these keys and anything else is a 422 before it reaches the database.
IconKey = Literal[*ICONS]
ColourKey = Literal[*COLOURS]


class CategoryIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: text(MAX_NAME_LENGTH)
    icon: IconKey | None = None
    colour: ColourKey | None = None


class CategoryStyleIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: text(200)
    icon: IconKey | None = None
    colour: ColourKey | None = None


class CategoryRenameIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: text(200)
    new_name: text(MAX_NAME_LENGTH)


class CategoryOut(ApiModel):
    name: str
    builtin: bool
    locked: bool
    assignable: bool
    note: str | None
    transaction_count: int
    icon: IconKey | None
    colour: ColourKey | None


class CategoryListOut(ApiModel):
    categories: list[CategoryOut]


class CategoryChangeOut(ApiModel):
    category: CategoryOut
    moved: int


class CategoryDeleteOut(ApiModel):
    moved: int


def _out(entry: CategoryEntry) -> CategoryOut:
    return CategoryOut(**vars(entry))


def _listing(db: Database, user_id: str) -> list[CategoryEntry]:
    return build_listing(
        categories.names(db, user_id),
        transactions.category_counts(db, user_id),
        category_styles.styles(db, user_id),
    )


def _entry(db: Database, user_id: str, name: str) -> CategoryEntry:
    """The listing entry for `name` after a write. If it has vanished (a concurrent delete), say so
    rather than fail with a server error."""
    found = next((e for e in _listing(db, user_id) if e.name == name), None)
    if found is None:
        raise not_found("category_not_found", "That category no longer exists.")
    return found


def _usable_name(raw: str) -> str:
    try:
        return clean_name(raw)
    except ValueError as err:
        raise unprocessable("invalid_category_name", str(err)) from err


def _taken(entries: list[CategoryEntry], name: str, *, except_name: str | None = None) -> bool:
    folded = name.casefold()
    return any(e.name.casefold() == folded and e.name != except_name for e in entries)


def _own(entries: list[CategoryEntry], name: str) -> CategoryEntry:
    """The person's own category called `name`; 404 if there is none, 409 if it is built in."""
    if locked_name(name) is not None:
        raise conflict(
            "category_locked", f"{locked_name(name)} is built in and cannot be changed or deleted."
        )
    entry = next((e for e in entries if e.name == name), None)
    if entry is None:
        raise not_found("category_not_found", "You have no category with that name.")
    return entry


def _exists() -> HTTPException:
    return conflict("category_exists", "A category with that name already exists.")


@router.get("", response_model=CategoryListOut)
def list_categories(user: CurrentUser, db: DbDep) -> CategoryListOut:
    return CategoryListOut(categories=[_out(e) for e in _listing(db, user.id)])


@router.post(
    "",
    response_model=CategoryOut,
    status_code=201,
    responses=CONFLICT_RESPONSE,
    dependencies=[WRITE_LIMIT],
)
def add_category(body: CategoryIn, user: CurrentUser, db: DbDep) -> CategoryOut:
    name = _usable_name(body.name)
    if locked_name(name) is not None or _taken(_listing(db, user.id), name):
        raise _exists()
    try:
        categories.add(db, user.id, name)
    except categories.DuplicateCategory as err:
        raise _exists() from err
    category_styles.set_style(db, user.id, name, body.icon, body.colour)
    return _out(_entry(db, user.id, name))


@router.put(
    "/style",
    response_model=CategoryOut,
    responses=NOT_FOUND_RESPONSE,
    dependencies=[WRITE_LIMIT],
)
def set_category_style(body: CategoryStyleIn, user: CurrentUser, db: DbDep) -> CategoryOut:
    """Give any category, built in or the person's own, a colour and an icon from the fixed set.
    Choosing nothing for both puts the default look back. A built-in category keeps its name."""
    entries = _listing(db, user.id)
    folded = body.name.strip().casefold()
    current = next((e for e in entries if e.name.casefold() == folded), None)
    if current is None:
        raise not_found("category_not_found", "You have no category with that name.")
    category_styles.set_style(db, user.id, current.name, body.icon, body.colour)
    return _out(_entry(db, user.id, current.name))


def _undo_name(db: Database, user_id: str, old: str, new: str, had_row: bool) -> None:
    """Best effort: put the name back after the move of transactions failed. If this fails too the
    two names are both listed, and deleting the old one with `move_to` the new one finishes it."""
    try:
        if had_row:
            categories.rename(db, user_id, new, old)
        else:
            categories.remove(db, user_id, new)
    except Exception:  # noqa: BLE001 - nothing more can be done here; the caller re-raises the cause
        logger.exception("could not undo the category name change %r -> %r", old, new)


@router.patch(
    "",
    response_model=CategoryChangeOut,
    responses={**NOT_FOUND_RESPONSE, **CONFLICT_RESPONSE},
    dependencies=[WRITE_LIMIT],
)
def rename_category(body: CategoryRenameIn, user: CurrentUser, db: DbDep) -> CategoryChangeOut:
    """Rename one of the person's own categories; every transaction that used it follows.

    The name is written first: the unique index is the authority on a clash, so a clash is found
    before any transaction has moved. If the move then fails, the name is put back."""
    entries = _listing(db, user.id)
    current = _own(entries, body.name)
    new_name = _usable_name(body.new_name)
    if locked_name(new_name) is not None or _taken(entries, new_name, except_name=current.name):
        raise _exists()
    try:
        had_row = categories.rename(db, user.id, current.name, new_name) is not None
        if not had_row:
            categories.add(db, user.id, new_name)  # it only existed on transactions until now
    except categories.DuplicateCategory as err:
        raise _exists() from err
    try:
        moved = transactions.recategorise(db, user.id, current.name, new_name)
    except Exception:
        _undo_name(db, user.id, current.name, new_name, had_row)
        raise
    category_styles.move(db, user.id, current.name, new_name)  # its look follows the name
    return CategoryChangeOut(category=_out(_entry(db, user.id, new_name)), moved=moved)


@router.delete(
    "",
    response_model=CategoryDeleteOut,
    responses={**NOT_FOUND_RESPONSE, **CONFLICT_RESPONSE},
    dependencies=[WRITE_LIMIT],
)
def delete_category(
    name: NameQuery,
    user: CurrentUser,
    db: DbDep,
    move_to: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
) -> CategoryDeleteOut:
    """Delete one of the person's own categories. Any transactions that used it are moved to
    `move_to`, which is required when there are some."""
    entries = _listing(db, user.id)
    current = _own(entries, name)
    moved = 0
    if current.transaction_count:
        if move_to is None:
            raise conflict(
                "category_in_use",
                f"{current.transaction_count} transactions use {current.name}. "
                "Choose a category to move them to.",
            )
        target = next((e for e in entries if e.name == move_to), None)
        if (
            target is None
            or target.name == current.name
            or not target.assignable
            or target.name in CHANGES_THE_MATHS
        ):
            raise unprocessable(
                "invalid_move_target",
                "Choose a different, existing category to move them to. Refund and Transfer "
                "change how money counts, so spending cannot be moved into them.",
            )
        moved = transactions.recategorise(db, user.id, current.name, target.name)
    categories.remove(db, user.id, current.name)
    category_styles.clear(db, user.id, current.name)
    return CategoryDeleteOut(moved=moved)
