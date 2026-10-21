"""The Second-Opinion Check's pure parts (ADR D-51): every unpaid instalment across providers
stacked by month with the plan under check, the exposure before and after it, and the points the
purchase adds to the chance of running short. No I/O; every amount is integer sen from the plans,
the plan rules or the confirmed recurring items.
"""

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any

from app.domain.flows import as_date

# Bank Negara Malaysia's policy document on personal financing (30 Sep 2025) asks banks that offer
# BNPL for a full affordability assessment once a consumer's BNPL limits add up to RM1,500. Shown
# as information about the person's own recorded limits, never as a compliance statement.
BNM_LIMIT_LINE_SEN = 150_000

MONTHS_PER_YEAR = 12


@dataclass(frozen=True)
class StackMonth:
    month: str  # "YYYY-MM"
    by_provider: tuple[tuple[str, int], ...]  # (provider label, unpaid sen due), by label
    new_plan_sen: int
    total_sen: int  # what is already owed that month plus the new plan
    known_income_sen: int  # confirmed recurring income falling in the month


@dataclass(frozen=True)
class Exposure:
    unpaid_before_sen: int
    unpaid_after_sen: int
    providers_before: tuple[str, ...]
    providers_after: tuple[str, ...]
    plans_before: int
    plans_after: int
    recorded_limits_sen: int | None  # None until the person has recorded at least one limit
    reaches_bnm_line: bool | None


def _month(day: date) -> str:
    return day.strftime("%Y-%m")


def _unpaid(plans: Iterable[Mapping[str, Any]]) -> list[tuple[str, date, int]]:
    """(provider label, due date, sen) for every instalment not yet paid."""
    out = []
    for plan in plans:
        label = plan.get("provider_label") or plan["provider"]
        for instalment in plan["installments"]:
            if not instalment["is_paid"]:
                out.append((label, as_date(instalment["due_date"]), int(instalment["amount_sen"])))
    return out


def _months_between(first: str, last: str) -> list[str]:
    year, month = int(first[:4]), int(first[5:])
    out = []
    while f"{year:04d}-{month:02d}" <= last:
        out.append(f"{year:04d}-{month:02d}")
        year, month = (year + 1, 1) if month == MONTHS_PER_YEAR else (year, month + 1)
    return out


def stack_dues(
    plans: Iterable[Mapping[str, Any]],
    new_instalments: Sequence[tuple[date, int]],
    income_by_month: Mapping[str, int],
    today: date,
) -> list[StackMonth]:
    """Every month from this one to the last instalment owed, with no gaps.

    An unpaid instalment whose due date has passed (an existing plan's, or the new plan's when its
    purchase date is in the past) is still owed, so it sits in the current month."""
    current = _month(today)
    owed: dict[str, dict[str, int]] = {}
    for label, due, sen in _unpaid(plans):
        by_label = owed.setdefault(max(_month(due), current), {})
        by_label[label] = by_label.get(label, 0) + sen
    new: dict[str, int] = {}
    for due, sen in new_instalments:
        key = max(_month(due), current)
        new[key] = new.get(key, 0) + sen
    last = max([current, *owed, *new])
    months = []
    for month in _months_between(current, last):
        by_provider = tuple(sorted(owed.get(month, {}).items()))
        existing = sum(sen for _, sen in by_provider)
        months.append(
            StackMonth(
                month=month,
                by_provider=by_provider,
                new_plan_sen=new.get(month, 0),
                total_sen=existing + new.get(month, 0),
                known_income_sen=int(income_by_month.get(month, 0)),
            )
        )
    return months


def last_month_owed(
    plans: Iterable[Mapping[str, Any]], new_instalments: Sequence[tuple[date, int]], today: date
) -> date:
    """The latest due date among what is owed and the new plan (today if nothing is), so the
    caller knows how far ahead to look for the confirmed income of each month."""
    dates = [due for _, due, _ in _unpaid(plans)] + [due for due, _ in new_instalments]
    return max([today, *dates])


def peak(months: Sequence[StackMonth]) -> StackMonth | None:
    """The month with the most owed, the earliest on a tie; None when nothing is owed at all."""
    owing = [m for m in months if m.total_sen > 0]
    return max(owing, key=lambda m: (m.total_sen, -owing.index(m)), default=None)


def exposure(
    plans: Iterable[Mapping[str, Any]],
    new_payable_sen: int,
    new_label: str,
    provider_limits: Mapping[str, int | None],
) -> Exposure:
    plans = list(plans)
    unpaid = _unpaid(plans)
    owing = [p for p in plans if any(not i["is_paid"] for i in p["installments"])]
    before = tuple(sorted({label for label, _, _ in unpaid}))
    after = tuple(sorted({*before, new_label}))
    owed_sen = sum(sen for _, _, sen in unpaid)
    recorded = [limit for limit in provider_limits.values() if limit is not None]
    total_limits = sum(recorded) if recorded else None
    return Exposure(
        unpaid_before_sen=owed_sen,
        unpaid_after_sen=owed_sen + new_payable_sen,
        providers_before=before,
        providers_after=after,
        plans_before=len(owing),
        plans_after=len(owing) + 1,
        recorded_limits_sen=total_limits,
        reaches_bnm_line=None if total_limits is None else total_limits >= BNM_LIMIT_LINE_SEN,
    )


def added_probability(with_purchase: float | None, without: float | None) -> float | None:
    """The simulated chance of running short with the purchase minus without it. Both come from
    one build with one seed, so the purchase cannot lower it; a negative difference is rounding
    and is shown as zero."""
    if with_purchase is None or without is None:
        return None
    return max(with_purchase - without, 0.0)
