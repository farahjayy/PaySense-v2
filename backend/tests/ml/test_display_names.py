import pytest

from ml.display_names import display_name
from ml.engine1_eval.report import BENCHMARKS, LITERATURE
from ml.engine2_train.models import CANDIDATES


@pytest.mark.parametrize("code", [*BENCHMARKS, *LITERATURE, *CANDIDATES])
def test_every_candidate_has_a_name_a_reader_can_use_in_a_figure(code):
    name = display_name(code)

    assert name != code and "_" not in name


@pytest.mark.parametrize(
    ("code", "name"),
    [
        ("arima", "ARIMA"),
        ("lstm", "LSTM"),
        ("ma13", "Moving average (13 weeks)"),
        ("random_forest", "Random Forest"),
        ("xgboost", "XGBoost"),
        ("lightgbm", "LightGBM"),
        ("logistic", "Logistic regression"),
    ],
)
def test_the_names_are_the_ones_the_dissertation_uses(code, name):
    assert display_name(code) == name


def test_a_label_with_no_entry_is_shown_as_it_is_rather_than_hidden():
    assert display_name("constant (the mean label)") == "constant (the mean label)"
    assert display_name("something_new") == "something_new"
