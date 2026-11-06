import base64
import csv
import re
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest

from app.engines.forecasting.service import STALE_AFTER_DAYS
from ml.uat.booklet import Links, build_packs, ordered_cards, render_pack
from ml.uat.load import UatDataError, load_vignettes
from ml.uat.purchase_cards import CARDS_PATH, load_cards
from ml.uat.roster import Tester as Person

ROOT = Path(__file__).resolve().parents[4]
SESSION = date(2026, 11, 8)
LINKS = Links(
    app_url="https://paysense.example.app",
    form_a_url="https://forms.example/a",
    form_b_url="https://forms.example/b",
)
CARDS = load_cards(CARDS_PATH, load_vignettes(ROOT / "uat" / "vignettes.yaml"))
TESTERS = [
    Person("P01", "p01-zz91qa", "Amir", "frequent_bnpl"),
    Person("P02", "p02-yx72wb", "Sara", "budget_conscious"),
    Person("P03", "p03-xw53vc", "Lee", "irregular_income"),
]
BANDS = ("Safe", "Caution", "At Risk")


STATEMENT = "Date,Description,Amount\n01/11/2026,Test coffee,-5.00\n"


def page(tester: Person) -> str:
    return render_pack(tester, CARDS[tester.persona], LINKS, SESSION - timedelta(days=1), STATEMENT)


def test_the_statement_is_inside_the_page_as_a_download_link():
    html = page(TESTERS[0])

    match = re.search(
        r'<a download="student-statement\.csv" href="data:text/csv;base64,([^"]+)"', html
    )
    assert match, "no download link"
    assert base64.b64decode(match.group(1)).decode("utf-8") == STATEMENT
    assert "sent with this page" not in html


@pytest.mark.parametrize("persona", sorted(CARDS))
def test_the_card_behind_the_tester_scenario_comes_first_and_the_rest_keep_their_order(persona):
    ordered = ordered_cards(CARDS[persona])

    assert ordered[0].vignette is not None
    rest = [c.id for c in CARDS[persona].cards if c is not ordered[0]]
    assert [c.id for c in ordered[1:]] == rest
    assert len(ordered) == len(CARDS[persona].cards)


@pytest.mark.parametrize("tester", TESTERS, ids=lambda t: t.participant)
def test_everything_the_tester_types_comes_from_the_cards_file(tester):
    html = page(tester)
    persona = CARDS[tester.persona]

    assert tester.username in html
    assert tester.participant in html
    for card in persona.cards:
        assert card.item in html
        assert f"RM {card.price_sen // 100:,}" in html
        assert f"{card.instalments} instalments" in html
    assert f"RM {persona.limit_sen // 100:,}" in html


def test_a_pack_holds_only_its_own_testers_cards_and_username():
    html = page(TESTERS[0])

    assert "Smartwatch" not in html and "Jacket" not in html
    assert TESTERS[1].username not in html and TESTERS[2].username not in html


@pytest.mark.parametrize("tester", TESTERS, ids=lambda t: t.participant)
def test_a_pack_never_tells_the_tester_a_result_or_which_persona_they_are(tester):
    html = page(tester).lower()

    for band in BANDS:  # whole words: "safer" is allowed, the band "Safe" is not
        assert not re.search(rf"\b{band.lower()}\b", html), band
    for leak in ("expected", "answer key", "frequent_bnpl", "budget_conscious", "irregular_income"):
        assert leak not in html, leak


def test_a_pack_names_no_button_and_explains_no_feature():
    html = page(TESTERS[0])

    for phrase in ("click the", "press the", "the button", "shap", "monte carlo", "lightgbm"):
        assert phrase not in html.lower(), phrase


def test_a_pack_links_both_forms_and_the_app():
    html = page(TESTERS[0])

    for url in (LINKS.app_url, LINKS.form_a_url, LINKS.form_b_url):
        assert f'href="{url}"' in html


@pytest.mark.parametrize("bad", ["javascript:alert(1)", "ftp://x", "paysense.example.app", ""])
def test_a_link_that_is_not_http_is_refused(bad):
    with pytest.raises(UatDataError, match="link"):
        Links(app_url=bad, form_a_url=LINKS.form_a_url, form_b_url=LINKS.form_b_url)


def test_a_pack_says_the_last_day_the_practice_data_stays_current():
    last = date(2026, 11, 7)
    html = render_pack(TESTERS[0], CARDS["frequent_bnpl"], LINKS, last, STATEMENT)

    assert (last + timedelta(days=STALE_AFTER_DAYS)).strftime("%d %B %Y") in html


def test_each_tester_gets_a_page_and_a_statement_ending_the_day_before_the_session(tmp_path):
    build_packs(TESTERS, tmp_path, SESSION, LINKS)

    for tester in TESTERS:
        folder = tmp_path / tester.participant
        assert (folder / f"PaySense-UAT-{tester.participant}.html").is_file()
        with (folder / "student-statement.csv").open(encoding="utf-8", newline="") as handle:
            rows = list(csv.DictReader(handle))
        ends = max(datetime.strptime(r["Date"], "%d/%m/%Y").date() for r in rows)
        assert SESSION - timedelta(days=8) <= ends < SESSION
        html = (folder / f"PaySense-UAT-{tester.participant}.html").read_text(encoding="utf-8")
        assert (ends + timedelta(days=STALE_AFTER_DAYS)).strftime("%d %B %Y") in html
        embedded = re.search(r'href="data:text/csv;base64,([^"]+)"', html)
        statement = (folder / "student-statement.csv").read_bytes()
        assert embedded and base64.b64decode(embedded.group(1)) == statement


def test_the_statement_is_the_persona_file_moved_forward_with_nothing_else_changed(tmp_path):
    build_packs(TESTERS[:1], tmp_path, SESSION, LINKS)

    original = (ROOT / "data" / "personas" / "frequent_bnpl.csv").read_text(encoding="utf-8")
    shifted = (tmp_path / "P01" / "student-statement.csv").read_text(encoding="utf-8")
    keep = lambda text: [re.sub(r"^[^,]*,", "", line) for line in text.splitlines()]  # noqa: E731
    assert keep(shifted) == keep(original)


def test_a_roster_that_keeps_a_template_example_username_is_refused(tmp_path):
    template = [Person("P01", "p01-k7q2xm", "Amir", "frequent_bnpl")]

    with pytest.raises(UatDataError, match="example"):
        build_packs(template, tmp_path, SESSION, LINKS)
