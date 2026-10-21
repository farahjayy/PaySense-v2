"""The Second-Opinion Check as the API shows it (ADR D-51): what one purchase adds to the chance of
running short, and everything already owed across providers by month.

The three probabilities come from one build with one seed (`CheckResult.p_without` and
`p_simulated`), the figures behind the headline band. Nothing here is a new model output: the
arithmetic is `domain/second_opinion.py`, and the only inputs are the person's own plans, limits
and confirmed recurring items. The browser computes nothing from it.
"""

import datetime as dt
from collections.abc import Iterable, Mapping
from typing import Any

from pydantic import Field

from app.api.schemas import ApiModel
from app.domain import second_opinion as so
from app.engines.forecasting.flows import known_flows
from app.engines.forecasting.simulate import band as band_of
from app.engines.risk.check import CheckResult

PROBABILITY_DIGITS = 6  # stored and shown to six decimals, as the headline probabilities are


class StackProviderOut(ApiModel):
    provider_label: str
    amount_sen: int


class StackMonthOut(ApiModel):
    month: str
    by_provider: list[StackProviderOut]
    new_plan_sen: int
    total_sen: int
    known_income_sen: int


class PeakOut(ApiModel):
    month: str
    total_sen: int


class ExposureOut(ApiModel):
    unpaid_before_sen: int
    unpaid_after_sen: int
    providers_before: list[str]
    providers_after: list[str]
    plans_before: int
    plans_after: int
    recorded_limits_sen: int | None
    reaches_bnm_line: bool | None
    bnm_line_sen: int


class SecondOpinionOut(ApiModel):
    without_probability: float = Field(ge=0, le=1)
    with_probability: float = Field(ge=0, le=1)
    added_probability: float = Field(ge=0, le=1)
    without_band: str
    already_at_risk: bool
    stack: list[StackMonthOut]
    peak: PeakOut | None
    # what falls due after the last month the stack shows (it stops after five years)
    beyond_sen: int
    exposure: ExposureOut


def _income_by_month(
    items: Iterable[Mapping[str, Any]], today: dt.date, last: dt.date
) -> dict[str, int]:
    flows = known_flows(items, [], today.replace(day=1), last)
    return {month: flow.income_sen for month, flow in flows.items()}


def build(
    result: CheckResult,
    plans: list[Mapping[str, Any]],
    items: Iterable[Mapping[str, Any]],
    provider_limits: Mapping[str, int | None],
    today: dt.date,
) -> SecondOpinionOut | None:
    """None when the check was refused (a ledger too short): there is nothing to compare."""
    if result.status != "ok" or result.p_without is None or result.p_simulated is None:
        return None
    proposal = result.proposal
    # an instalment taken at checkout is paid the day it is bought, as it is on a saved plan
    new = [(i.due_date, i.amount_sen) for i in proposal.instalments if not i.paid_at_checkout]
    new_owed_sen = sum(sen for _, sen in new)
    income = _income_by_month(items, today, so.last_month_owed(plans, new, today))
    months = so.stack_dues(plans, new, income, today)
    top = so.peak(months)
    exposure = so.exposure(plans, new_owed_sen, proposal.provider_label, provider_limits)
    without = round(result.p_without, PROBABILITY_DIGITS)
    with_purchase = round(result.p_simulated, PROBABILITY_DIGITS)
    added = so.added_probability(with_purchase, without)
    without_band = band_of(without)
    return SecondOpinionOut(
        without_probability=without,
        with_probability=with_purchase,
        added_probability=round(added or 0.0, PROBABILITY_DIGITS),
        without_band=without_band,
        already_at_risk=without_band == "At Risk",
        stack=[
            StackMonthOut(
                month=m.month,
                by_provider=[
                    StackProviderOut(provider_label=label, amount_sen=sen)
                    for label, sen in m.by_provider
                ],
                new_plan_sen=m.new_plan_sen,
                total_sen=m.total_sen,
                known_income_sen=m.known_income_sen,
            )
            for m in months
        ],
        peak=None if top is None else PeakOut(month=top.month, total_sen=top.total_sen),
        beyond_sen=so.owed_after_window(plans, new, today),
        exposure=ExposureOut(
            unpaid_before_sen=exposure.unpaid_before_sen,
            unpaid_after_sen=exposure.unpaid_after_sen,
            providers_before=list(exposure.providers_before),
            providers_after=list(exposure.providers_after),
            plans_before=exposure.plans_before,
            plans_after=exposure.plans_after,
            recorded_limits_sen=exposure.recorded_limits_sen,
            reaches_bnm_line=exposure.reaches_bnm_line,
            bnm_line_sen=so.BNM_LIMIT_LINE_SEN,
        ),
    )
