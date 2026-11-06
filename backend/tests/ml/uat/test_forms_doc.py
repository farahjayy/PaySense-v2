"""`uat/forms.md` is pasted into a form tool by hand. These tests keep it from drifting away from
the files the analysis reads: the three CSV templates, the vignettes and the instrument wording."""

import csv
import re
from pathlib import Path

import pytest
import yaml

from ml.uat.load import load_vignettes
from ml.uat.purchase_cards import CARDS_PATH, load_cards

ROOT = Path(__file__).resolve().parents[4]
FORMS = (ROOT / "uat" / "forms.md").read_text(encoding="utf-8")
INSTRUMENTS = (ROOT / "uat" / "instruments.md").read_text(encoding="utf-8")
VIGNETTES = load_vignettes(ROOT / "uat" / "vignettes.yaml")
CODES = set(re.findall(r"^\| `([A-Za-z0-9-]+)` \|", FORMS, re.MULTILINE))


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def template_columns(name: str) -> list[str]:
    path = ROOT / "uat" / "templates" / name
    with path.open(encoding="utf-8", newline="") as handle:
        return next(csv.reader(handle))


def test_every_sus_and_clarity_column_has_a_question_with_a_code():
    for name, prefix in (("sus.csv", "S"), ("clarity.csv", "C")):
        for column in template_columns(name):
            if column != "participant":
                assert f"{prefix}{column[1:]}" in CODES, column


def test_both_forms_identify_the_tester_by_participant_code():
    assert {"A-CODE", "B-CODE"} <= CODES


@pytest.mark.parametrize("vignette", sorted(VIGNETTES))
def test_each_vignette_is_asked_before_and_after_with_its_confidence(vignette):
    for suffix in ("pre", "pre-conf", "post", "post-conf"):
        assert f"{vignette}-{suffix}" in CODES


@pytest.mark.parametrize("vignette", sorted(VIGNETTES))
def test_the_scenario_and_every_option_are_worded_as_in_the_vignettes_file(vignette):
    text = squash(FORMS)
    raw = yaml.safe_load((ROOT / "uat" / "vignettes.yaml").read_text(encoding="utf-8"))
    scenario = next(v["scenario"] for v in raw["vignettes"] if v["id"] == vignette)
    assert squash(scenario) in text
    for option in VIGNETTES[vignette].options:
        assert f"{option.id}. {option.text}" in text


def test_the_sus_statements_are_worded_exactly_as_in_the_instruments():
    statements = re.findall(r"^\| (S\d+) \| (.+?) \|$", INSTRUMENTS, re.MULTILINE)
    assert len(statements) == 10
    text = squash(FORMS)
    for _, statement in statements:
        assert statement in text


def test_the_clarity_statements_are_worded_exactly_as_in_the_instruments():
    statements = re.findall(r"^\| (C\d) \| (.+?) \|$", INSTRUMENTS, re.MULTILINE)
    assert len(statements) == 4
    text = squash(FORMS)
    for _, statement in statements:
        assert statement in text


def test_the_forms_never_carry_the_hidden_risk_ranking_or_an_expected_band():
    lowered = FORMS.lower()
    assert "risk_rank" not in lowered
    assert "expected_band" not in lowered


def test_the_scenario_choice_names_the_item_on_each_scenario_card():
    # the tester picks their scenario by the item on Purchase 1, which the pack takes from the cards
    cards = load_cards(CARDS_PATH, VIGNETTES)
    behind = [c for persona in cards.values() for c in persona.cards if c.vignette is not None]
    assert len(behind) == len(VIGNETTES)
    for card in behind:
        assert card.item in FORMS
