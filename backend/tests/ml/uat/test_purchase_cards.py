"""The purchase cards (plan 2026-10-22-uat-purchase-cards): the file is valid and every card shows
the band its answer key says, on every study day, for every seed."""

from pathlib import Path

import pytest

from ml.uat.load import UatDataError, load_vignettes
from ml.uat.purchase_cards import (
    BANDS,
    CARDS_PATH,
    load_cards,
    measure_persona,
    render_report,
)

VIGNETTES = Path(CARDS_PATH).parent / "vignettes.yaml"
PERSONAS = ("frequent_bnpl", "budget_conscious", "irregular_income")
# the provider of each persona's vignette (V1 SPayLater, V3 TikTok PayLater, V2 Atome)
PERSONA_PROVIDERS = {
    "frequent_bnpl": "spaylater",
    "budget_conscious": "tiktok_paylater",
    "irregular_income": "atome",
}
PAIRED_VIGNETTES = {
    "V1": "frequent_bnpl",
    "V2": "irregular_income",
    "V3": "budget_conscious",
}

GOOD = """
personas:
  frequent_bnpl:
    provider: spaylater
    limit_rm: 1500
    cards:
      - id: F1
        item: Headphones
        price_rm: 600
        instalments: 3
        monthly_fee_pct: 0
        expected_band: Safe
"""
SECOND_CARD_SAME_ID = """      - id: F1
        item: Again
        price_rm: 700
        instalments: 3
        monthly_fee_pct: 0
        expected_band: Caution
"""


@pytest.fixture(scope="module")
def cards():
    return load_cards(CARDS_PATH, load_vignettes(VIGNETTES))


@pytest.fixture(scope="module")
def measured(cards):
    return {persona: measure_persona(persona, cards[persona]) for persona in PERSONAS}


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "cards.yaml"
    path.write_text(text, encoding="utf-8")
    return path


def test_every_persona_has_one_provider_one_limit_and_a_card_for_each_band(cards):
    assert set(cards) == set(PERSONAS)
    for persona, entry in cards.items():
        assert entry.provider == PERSONA_PROVIDERS[persona]
        assert entry.limit_sen > 0
        assert sorted(c.expected_band for c in entry.cards) == sorted(BANDS)


def test_card_ids_are_unique_and_each_vignette_purchase_is_on_its_own_persona(cards):
    ids = [c.id for entry in cards.values() for c in entry.cards]
    assert len(ids) == len(set(ids))
    paired = {
        c.vignette: persona for persona, entry in cards.items() for c in entry.cards if c.vignette
    }
    assert paired == PAIRED_VIGNETTES


@pytest.mark.parametrize(
    ("edit", "replacement"),
    [
        ("provider: spaylater", "provider: boost"),
        ("expected_band: Safe", "expected_band: Fine"),
        ("price_rm: 600", "price_rm: 0"),
        ("instalments: 3", "instalments: 99"),
        ("limit_rm: 1500", "limit_rm: -5"),
    ],
)
def test_a_bad_card_file_is_an_error_that_names_the_file(tmp_path, edit, replacement):
    path = write(tmp_path, GOOD.replace(edit, replacement))

    with pytest.raises(UatDataError, match=r"cards\.yaml"):
        load_cards(path, load_vignettes(VIGNETTES))


def test_a_repeated_card_id_is_refused(tmp_path):
    path = write(tmp_path, GOOD + SECOND_CARD_SAME_ID)

    with pytest.raises(UatDataError, match="F1"):
        load_cards(path, load_vignettes(VIGNETTES))


def test_an_unknown_vignette_is_refused(tmp_path):
    with_vignette = GOOD.replace(
        "expected_band: Safe\n", "expected_band: Safe\n        vignette: V9\n"
    )

    with pytest.raises(UatDataError, match="V9"):
        load_cards(write(tmp_path, with_vignette), load_vignettes(VIGNETTES))


@pytest.mark.parametrize("persona", PERSONAS)
def test_each_card_shows_its_answer_key_band_on_every_study_day_and_seed(cards, measured, persona):
    """The instructed path: every Recurring suggestion confirmed."""
    for card in cards[persona].cards:
        result = measured[persona][card.id]
        assert result.confirmed.bands == {card.expected_band}, (card.id, result.confirmed)


@pytest.mark.parametrize("persona", PERSONAS)
def test_a_price_over_the_limit_is_split_between_the_provider_and_the_checkout(
    cards, measured, persona
):
    entry = cards[persona]
    for card in entry.cards:
        result = measured[persona][card.id]
        if card.price_sen > entry.limit_sen:
            assert result.financed_sen < card.price_sen and result.upfront_sen > 0
        else:
            assert result.financed_sen == card.price_sen and result.upfront_sen == 0


def test_the_answer_key_says_it_is_not_for_testers_and_lists_both_paths(cards, measured):
    text = render_report(cards, measured)

    lowered = text.lower()
    assert "not for testers" in lowered
    assert "suggestions left alone" in lowered and "every suggestion confirmed" in lowered
    for entry in cards.values():
        for card in entry.cards:
            assert card.id in text
