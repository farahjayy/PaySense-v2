"""The Second-Opinion Check's arithmetic (ADR D-51): what is already owed across providers by month,
the exposure before and after one more plan, and the points a purchase adds. All integer sen."""

from datetime import date

import pytest

from app.domain.second_opinion import (
    BNM_LIMIT_LINE_SEN,
    added_probability,
    exposure,
    stack_dues,
)

TODAY = date(2026, 10, 21)


def plan(provider, label, instalments):
    """instalments: (due date, sen, is_paid)."""
    return {
        "provider": provider,
        "provider_label": label,
        "installments": [
            {"seq": n, "due_date": due, "amount_sen": sen, "is_paid": paid}
            for n, (due, sen, paid) in enumerate(instalments, start=1)
        ],
    }


SPAY = plan(
    "spaylater",
    "SPayLater",
    [
        (date(2026, 10, 5), 10_000, True),  # paid: never counted
        (date(2026, 11, 5), 10_000, False),
        (date(2026, 12, 5), 10_000, False),
    ],
)
ATOME = plan("atome", "Atome", [(date(2026, 11, 20), 5_000, False)])
NEW = [(date(2026, 11, 21), 26_633), (date(2026, 12, 21), 26_633), (date(2027, 1, 21), 26_634)]


def by_month(rows):
    return {row.month: row for row in rows}


def test_every_provider_is_stacked_in_the_month_it_falls_due_with_the_new_plan_added():
    rows = by_month(stack_dues([SPAY, ATOME], NEW, {"2026-11": 200_000}, TODAY))

    nov = rows["2026-11"]
    assert nov.by_provider == (("Atome", 5_000), ("SPayLater", 10_000))
    assert nov.new_plan_sen == 26_633
    assert nov.total_sen == 5_000 + 10_000 + 26_633
    assert nov.known_income_sen == 200_000
    assert rows["2026-12"].total_sen == 10_000 + 26_633
    assert rows["2027-01"].total_sen == 26_634 and rows["2027-01"].by_provider == ()


def test_a_paid_instalment_is_not_owed():
    rows = by_month(stack_dues([SPAY], [], {}, TODAY))

    assert rows["2026-10"].total_sen == 0  # October's was paid


def test_an_overdue_instalment_is_still_owed_so_it_sits_in_this_month():
    late = plan("spaylater", "SPayLater", [(date(2026, 8, 5), 7_000, False)])

    rows = by_month(stack_dues([late], [], {}, TODAY))

    assert rows["2026-10"].by_provider == (("SPayLater", 7_000),)


def test_months_owed_beyond_the_new_plan_are_not_dropped():
    far = plan("tiktok_paylater", "TikTok PayLater", [(date(2027, 6, 1), 9_000, False)])

    rows = by_month(stack_dues([far], NEW[:1], {}, TODAY))

    assert rows["2027-06"].total_sen == 9_000
    assert list(rows)[0] == "2026-10" and list(rows)[-1] == "2027-06"


def test_the_months_run_without_gaps_from_this_month():
    months = [row.month for row in stack_dues([ATOME], NEW, {}, TODAY)]

    assert months == ["2026-10", "2026-11", "2026-12", "2027-01"]


def test_a_new_plan_dated_in_the_past_counts_in_this_month():
    rows = by_month(stack_dues([], [(date(2026, 9, 1), 4_000)], {}, TODAY))

    assert rows["2026-10"].new_plan_sen == 4_000


def test_three_instalments_of_a_price_sum_to_the_exact_sen():
    rows = stack_dues([], NEW, {}, TODAY)

    assert sum(row.new_plan_sen for row in rows) == 79_900


def test_the_peak_is_the_month_with_the_most_owed_and_the_earliest_on_a_tie():
    rows = stack_dues([SPAY, ATOME], NEW, {}, TODAY)
    peak = max(rows, key=lambda row: (row.total_sen, -rows.index(row)))

    assert peak.month == "2026-11"


def test_exposure_counts_unpaid_money_providers_and_plans_before_and_after():
    result = exposure([SPAY, ATOME], new_payable_sen=79_900, new_label="Atome", provider_limits={})

    assert result.unpaid_before_sen == 25_000
    assert result.unpaid_after_sen == 25_000 + 79_900
    assert result.providers_before == ("Atome", "SPayLater")
    assert result.providers_after == ("Atome", "SPayLater")  # Atome was already one of them
    assert (result.plans_before, result.plans_after) == (2, 3)


def test_a_fully_paid_plan_is_not_a_plan_the_person_still_owes():
    done = plan("atome", "Atome", [(date(2026, 1, 1), 5_000, True)])

    result = exposure([done], 10_000, "SPayLater", {})

    assert (result.plans_before, result.plans_after) == (0, 1)
    assert result.providers_before == () and result.providers_after == ("SPayLater",)


def test_the_bank_negara_line_is_only_judged_from_limits_the_person_recorded():
    none = exposure([], 1_000, "SPayLater", {})
    assert none.recorded_limits_sen is None and none.reaches_bnm_line is None

    blank = exposure([], 1_000, "SPayLater", {"spaylater": None})
    assert blank.recorded_limits_sen is None and blank.reaches_bnm_line is None

    below = exposure([], 1_000, "SPayLater", {"spaylater": 100_000, "atome": 49_999})
    assert below.recorded_limits_sen == 149_999 and below.reaches_bnm_line is False

    at = exposure([], 1_000, "SPayLater", {"spaylater": 100_000, "atome": 50_000})
    assert at.recorded_limits_sen == BNM_LIMIT_LINE_SEN and at.reaches_bnm_line is True


@pytest.mark.parametrize(
    ("with_purchase", "without", "expected"),
    [
        (0.74, 0.65, 0.09),
        (0.30, 0.30, 0.0),
        (0.299999, 0.30, 0.0),
        (None, 0.4, None),
        (0.4, None, None),
    ],
)
def test_added_probability_is_never_negative_and_needs_both_sides(with_purchase, without, expected):
    got = added_probability(with_purchase, without)

    assert got == pytest.approx(expected) if expected is not None else got is None
