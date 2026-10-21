"""A person's own data as files they can keep (ADR D-50).

The CSV is exactly the import template's format (`type,date,item,amount,category`), so it can be
imported back. Amounts are written from integer sen with integer arithmetic only. An item a
spreadsheet would run as a formula (it starts with `=`, `+`, `-`, `@` or a tab) gets a leading
apostrophe, the standard defence against CSV injection, so a file opened in Excel never executes
something a transaction description said.
"""

import csv
import io
from collections.abc import Iterable, Mapping
from typing import Any

from app.domain.money import SEN_PER_RM

CSV_HEADER = ("type", "date", "item", "amount", "category")
_FORMULA_STARTS = ("=", "+", "-", "@", "\t", "\r")


def plain_rm(sen: int) -> str:
    """Integer sen -> '1234.56' (no symbol, no thousands separator, so any importer reads it)."""
    whole, cents = divmod(sen, SEN_PER_RM)
    return f"{whole}.{cents:02d}"


def _defused(text: str) -> str:
    return f"'{text}" if text.startswith(_FORMULA_STARTS) else text


def transactions_csv(rows: Iterable[Mapping[str, Any]]) -> str:
    """The transactions as CSV text, one row each, in the import template's column order."""
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(CSV_HEADER)
    for r in rows:
        item = r.get("description") or r["category"]
        writer.writerow(
            (
                r["type"],
                str(r["date"]),
                _defused(str(item)),
                plain_rm(int(r["amount_sen"])),
                _defused(str(r["category"])),
            )
        )
    return out.getvalue()
