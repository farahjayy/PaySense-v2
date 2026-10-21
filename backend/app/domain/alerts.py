"""The dashboard's alert line (ADR D-52): what needs attention that the dashboard does not already
say in its main card. Three rules over what the person has recorded: an instalment that is overdue,
payments that fall close together, a provider limit nearly used.

Pure: plans, upcoming bill payments (already placed on dates by the caller), recorded limits and
today in; a short list out. Every figure in a sentence is the rule's own input, in integer sen.
The chance of running short is deliberately not an alert: the dashboard shows it in its main card.
"""

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Literal

from app.domain.flows import as_date
from app.domain.money import format_rm
from app.domain.plans import used_limit_sen

Severity = Literal["high", "medium"]

COLLISION_DAYS = 7  # payments fewer than this many days apart are "within a week"
LOOKAHEAD_DAYS = 14  # how far ahead payments are looked at
LIMIT_NEAR_SHARE = 0.8  # a limit this used is "nearly used" (the edge a budget uses for "near")
PLANS_HREF = "/plans"

# (name, due date, sen): an unpaid instalment or a confirmed bill's next payment
Payment = tuple[str, date, int]


@dataclass(frozen=True)
class Alert:
    rule: str
    severity: Severity
    title: str
    detail: str
    href: str


def _plural(count: int, singular: str, plural: str) -> str:
    return singular if count == 1 else plural


def _day(day: date) -> str:
    return f"{day.day} {day:%B}"


def _unpaid(plans: Iterable[Mapping[str, Any]]) -> list[tuple[str, date, int]]:
    out = []
    for plan in plans:
        label = plan.get("provider_label") or plan["provider"]
        for instalment in plan["installments"]:
            if not instalment["is_paid"]:
                out.append((label, as_date(instalment["due_date"]), int(instalment["amount_sen"])))
    return out


def _overdue(unpaid: Sequence[tuple[str, date, int]], today: date) -> Alert | None:
    late = [(label, due, sen) for label, due, sen in unpaid if due < today]
    if not late:
        return None
    count = len(late)
    total = sum(sen for _, _, sen in late)
    oldest = min(due for _, due, _ in late)
    verb = _plural(count, "is", "are")
    return Alert(
        rule="overdue",
        severity="high",
        title=f"{count} {_plural(count, 'instalment', 'instalments')} {verb} overdue",
        detail=f"{format_rm(total)} is owed, the oldest due {_day(oldest)}.",
        href=PLANS_HREF,
    )


def _collision(
    unpaid: Sequence[tuple[str, date, int]], bills: Iterable[Payment], today: date
) -> Alert | None:
    """The first run of two or more payments, each less than a week after the one before, among
    those due in the next two weeks (an overdue one is its own alert)."""
    horizon = today + timedelta(days=LOOKAHEAD_DAYS)
    payments = sorted(
        [(due, sen) for _, due, sen in unpaid if today <= due <= horizon]
        + [(due, sen) for _, due, sen in bills if today <= due <= horizon]
    )
    for start, (first_due, _) in enumerate(payments):
        run = [p for p in payments[start:] if (p[0] - first_due).days < COLLISION_DAYS]
        if len(run) >= 2:
            total = sum(sen for _, sen in run)
            return Alert(
                rule="collision",
                severity="medium",
                title=f"{len(run)} payments fall within a week",
                detail=f"{format_rm(total)} is due from {_day(first_due)}.",
                href=PLANS_HREF,
            )
    return None


def _limits(
    plans: Sequence[Mapping[str, Any]], provider_limits: Mapping[str, int | None]
) -> list[Alert]:
    labels: dict[str, str] = {}
    used: dict[str, int] = {}
    for plan in plans:
        provider = plan["provider"]
        labels.setdefault(provider, plan.get("provider_label") or provider)
        used[provider] = used.get(provider, 0) + used_limit_sen(plan["installments"])
    out = []
    for provider, limit in sorted(provider_limits.items()):
        if not limit or used.get(provider, 0) < LIMIT_NEAR_SHARE * limit:
            continue
        spent = used[provider]
        label = labels[provider]
        out.append(
            Alert(
                rule="limit_near",
                severity="medium",
                title=f"{label} limit is {int(100 * spent / limit)}% used",
                detail=f"{format_rm(spent)} of your {format_rm(limit)} limit is in use.",
                href=PLANS_HREF,
            )
        )
    return out


def build_alerts(
    plans: Sequence[Mapping[str, Any]],
    bills: Iterable[Payment],
    provider_limits: Mapping[str, int | None],
    today: date,
) -> list[Alert]:
    """Most serious first; at most one overdue and one collision alert, and one limit alert per
    provider."""
    unpaid = _unpaid(plans)
    found = [_overdue(unpaid, today), _collision(unpaid, bills, today)]
    alerts = [a for a in found if a is not None] + _limits(plans, provider_limits)
    return sorted(alerts, key=lambda a: a.severity != "high")
