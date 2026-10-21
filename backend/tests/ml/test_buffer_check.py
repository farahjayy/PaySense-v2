"""The savings-buffer measurement (plan P7d, Phase C): the parts that need no forecast network."""

import app.engines.forecasting.service as service
from ml import buffer_check


def test_a_buffer_joins_the_first_months_margin_and_nothing_else():
    seen = {}

    def spy(*args, **kwargs):
        seen.update(kwargs)
        return "simulation"

    real = service.simulate
    service.simulate = spy
    try:
        original, patched = buffer_check.with_buffer(100_000)
        assert original is spy
        assert patched(month_to_date_sen=2_500) == "simulation"
        assert seen["month_to_date_sen"] == 102_500
        patched()  # no month-to-date given: the buffer alone
        assert seen["month_to_date_sen"] == 100_000
    finally:
        service.simulate = real


def test_every_persona_statement_loads_and_ends_before_the_as_of_day():
    for persona in buffer_check.PERSONAS:
        rows, today = buffer_check.ledger(persona)
        assert len(rows) > 100
        assert today > max(r["date"] for r in rows)


def test_the_report_names_what_it_is_not_and_one_row_per_persona_and_buffer():
    cells = [
        {"price_sen": 60_000, "instalments": 3, "p_with": 0.25, "band": "Caution"}
        for _ in range(10)
    ]
    results = [
        {
            "persona": p,
            "buffer_sen": b,
            "baseline_p": 0.2,
            "baseline_band": "Caution",
            "safe_cells": 0,
            "cells": cells,
        }
        for p in buffer_check.PERSONAS
        for b in buffer_check.BUFFERS_SEN
    ]

    text = buffer_check.render(results)

    assert "not** a model score" in text.replace(
        "What it is not:** a model score", "not** a model score"
    )
    assert text.count("| budget_conscious | RM ") == len(buffer_check.BUFFERS_SEN)
    assert "RM 3,000" in text and "0 of 10" in text
