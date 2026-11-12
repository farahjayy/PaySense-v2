import pandas as pd
import pytest

from ml.engine2_train.report import brier_figure_data


def cv_table():
    return pd.DataFrame(
        {
            "model": ["logistic", "lightgbm", "random_forest", "constant (the mean label)"],
            "brier": [0.0205, 0.0163, 0.0612, 0.1799],
            "brier_se": [0.0002, 0.0002, 0.0004, float("nan")],
        }
    )


def test_the_brier_figure_shows_readable_names_and_leaves_every_number_alone():
    shown = brier_figure_data(cv_table())

    assert set(shown["label"]) == {
        "Logistic regression",
        "LightGBM",
        "Random Forest",
        "constant (the mean label)",
    }
    original = cv_table().set_index("model")
    for _, row in shown.iterrows():
        assert row["brier"] == pytest.approx(original.loc[row["model"], "brier"])


def test_the_best_model_comes_first_and_the_constant_baseline_is_marked_as_one():
    shown = brier_figure_data(cv_table())

    assert list(shown["label"])[0] == "LightGBM"
    assert shown["is_baseline"].tolist() == [False, False, False, True]
    assert shown["brier_se"].notna().all()  # a missing error bar is drawn as none, not as NaN
