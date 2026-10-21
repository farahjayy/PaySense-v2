"""The dashboard's alert line (ADR D-52): three rules over what the person has already recorded.

Overdue instalments, payments that fall close together, and a provider limit nearly used. The
forecast's own warning (the chance of running short) is not repeated here: the dashboard already
shows it in its main card."""

from datetime import date, timedelta

from app.domain.alerts import (
    COLLISION_DAYS,
    LIMIT_NEAR_SHARE,
    LOOKAHEAD_DAYS,
    build_alerts,
)

TODAY = date(2026, 10, 21)


def plan(provider, label, instalments):
    return {
        "provider": provider,
        "provider_label": label,
        "installments": [
            {"seq": n, "due_date": due, "amount_sen": sen, "is_paid": paid}
            for n, (due, sen, paid) in enumerate(instalments, start=1)
        ],
    }


def bill(name, sen, due):
    """A confirmed bill's next payment: (name, due date, sen)."""
    return (name, due, sen)


def rules(alerts):
    return [a.rule for a in alerts]


def test_nothing_to_say_gives_no_alerts():
    quiet = plan("atome", "Atome", [(date(2026, 12, 20), 5_000, False)])

    assert build_alerts([quiet], [], {}, TODAY) == []


def test_an_overdue_instalment_is_an_alert_with_its_amount_and_oldest_date():
    late = plan(
        "spaylater",
        "SPayLater",
        [(date(2026, 9, 5), 7_000, False), (date(2026, 10, 5), 7_050, False)],
    )

    [alert] = build_alerts([late], [], {}, TODAY)

    assert alert.rule == "overdue" and alert.severity == "high"
    assert alert.title == "2 instalments are overdue"
    assert "RM 140.50" in alert.detail and "5 September" in alert.detail
    assert alert.href == "/plans"


def test_one_overdue_instalment_reads_as_a_singular():
    late = plan("atome", "Atome", [(date(2026, 10, 1), 3_000, False)])

    [alert] = build_alerts([late], [], {}, TODAY)

    assert alert.title == "1 instalment is overdue"


def test_a_paid_instalment_is_never_overdue():
    paid = plan("atome", "Atome", [(date(2026, 9, 1), 3_000, True)])

    assert build_alerts([paid], [], {}, TODAY) == []


def test_two_payments_within_a_week_of_each_other_are_a_collision():
    spay = plan("spaylater", "SPayLater", [(date(2026, 10, 28), 12_000, False)])
    rent = bill("Rent", 35_000, date(2026, 10, 30))

    [alert] = build_alerts([spay], [rent], {}, TODAY)

    assert alert.rule == "collision" and alert.severity == "medium"
    assert alert.title == "2 payments fall within a week"
    assert "RM 470.00" in alert.detail and "28 October" in alert.detail
    assert alert.href == "/plans"


def test_payments_a_week_or_more_apart_are_not_a_collision():
    day = date(2026, 10, 22)
    first = plan("atome", "Atome", [(day, 5_000, False)])
    second = plan("spaylater", "SPayLater", [(day + timedelta(days=COLLISION_DAYS), 5_000, False)])

    assert build_alerts([first, second], [], {}, TODAY) == []


def test_payments_beyond_the_lookahead_are_not_looked_at():
    far = date(2026, 12, 30)
    a = plan("atome", "Atome", [(far, 5_000, False)])
    b = plan("spaylater", "SPayLater", [(far, 5_000, False)])
    assert (far - TODAY).days > LOOKAHEAD_DAYS

    assert build_alerts([a, b], [], {}, TODAY) == []


def test_a_limit_used_to_eighty_percent_is_an_alert_and_just_under_is_not():
    spay = plan("spaylater", "SPayLater", [(date(2027, 3, 1), 80_000, False)])

    [alert] = build_alerts([spay], [], {"spaylater": 100_000}, TODAY)
    assert alert.rule == "limit_near" and alert.severity == "medium"
    assert alert.title == "SPayLater limit is 80% used"
    assert "RM 800.00" in alert.detail and "RM 1,000.00" in alert.detail
    assert alert.href == "/plans"

    assert LIMIT_NEAR_SHARE == 0.8
    assert build_alerts([spay], [], {"spaylater": 100_001}, TODAY) == []


def test_a_provider_with_no_recorded_limit_never_raises_a_limit_alert():
    spay = plan("spaylater", "SPayLater", [(date(2027, 3, 1), 80_000, False)])

    assert build_alerts([spay], [], {"spaylater": None}, TODAY) == []
    assert build_alerts([spay], [], {}, TODAY) == []


def test_alerts_come_most_serious_first_one_per_rule_per_subject():
    late = plan("spaylater", "SPayLater", [(date(2026, 10, 1), 80_000, False)])
    near_a = plan("atome", "Atome", [(date(2027, 3, 1), 90_000, False)])
    rent = bill("Rent", 35_000, date(2026, 10, 25))
    soon = plan("tiktok_paylater", "TikTok PayLater", [(date(2026, 10, 26), 4_000, False)])

    alerts = build_alerts(
        [late, near_a, soon], [rent], {"spaylater": 100_000, "atome": 100_000}, TODAY
    )

    assert rules(alerts)[0] == "overdue"
    assert rules(alerts).count("overdue") == 1 and rules(alerts).count("collision") == 1
    assert sorted(a.title for a in alerts if a.rule == "limit_near") == [
        "Atome limit is 90% used",
        "SPayLater limit is 80% used",
    ]
    assert [a.severity for a in alerts] == sorted(
        (a.severity for a in alerts), key={"high": 0, "medium": 1}.get
    )
