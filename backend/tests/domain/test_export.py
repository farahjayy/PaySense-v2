"""The export: exact amounts, safe in a spreadsheet, and importable back into the app."""

import pytest

from app.domain.csv_import import parse_csv
from app.domain.export import CSV_HEADER, plain_rm, transactions_csv


def row(**overrides):
    base = {
        "date": "2026-03-01",
        "amount_sen": 650,
        "type": "expense",
        "category": "Food",
        "description": "Nasi lemak",
    }
    base.update(overrides)
    return base


@pytest.mark.parametrize(
    ("sen", "text"),
    [(0, "0.00"), (5, "0.05"), (650, "6.50"), (100000, "1000.00"), (123456789, "1234567.89")],
)
def test_amounts_are_written_exactly_from_sen_with_no_float_in_sight(sen, text):
    assert plain_rm(sen) == text


def test_the_header_is_the_import_templates():
    assert CSV_HEADER == ("type", "date", "item", "amount", "category")
    assert transactions_csv([]).splitlines()[0] == "type,date,item,amount,category"


def test_a_row_is_written_in_the_templates_column_order():
    text = transactions_csv([row()])

    assert text.splitlines()[1] == "expense,2026-03-01,Nasi lemak,6.50,Food"


def test_an_item_with_a_comma_a_quote_or_a_newline_survives_the_trip_back_through_the_importer():
    tricky = 'Mak\'s "special", nasi\nlemak'
    text = transactions_csv(
        [row(description=tricky), row(description="Plain", amount_sen=100000, type="income")]
    )

    preview = parse_csv(text)

    # the importer reads a line break inside an item as a space
    assert [r.description for r in preview.rows] == [" ".join(tricky.split()), "Plain"]
    assert [r.amount_sen for r in preview.rows] == [650, 100000]
    assert [r.type for r in preview.rows] == ["expense", "income"]
    assert preview.skipped == ()


@pytest.mark.parametrize("lead", ["=", "+", "-", "@", "	"])
def test_an_item_that_a_spreadsheet_would_run_as_a_formula_is_defused(lead):
    text = transactions_csv([row(description=f"{lead}SUM(A1:A9)")])

    item = text.splitlines()[1].split(",")[2]
    assert not item.startswith(("=", "+", "-", "@", "	"))
    assert "SUM(A1:A9)" in item


def test_a_missing_description_falls_back_to_the_category_so_the_row_can_be_imported():
    text = transactions_csv([row(description=None, category="Transport")])

    assert text.splitlines()[1] == "expense,2026-03-01,Transport,6.50,Transport"


@pytest.mark.parametrize("item", ["-50% voucher", "=HYPERLINK", "+60 top-up", "@home"])
def test_an_item_that_was_defused_for_a_spreadsheet_comes_back_as_it_was(item):
    text = transactions_csv([row(description=item)])

    preview = parse_csv(text)

    assert [r.description for r in preview.rows] == [item]
