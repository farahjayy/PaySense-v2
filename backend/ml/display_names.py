"""Names a reader can use in a figure or a table, for the model codes the code runs under.

The codes (`arima`, `random_forest`) are identifiers in the run files and must not change; only
what is drawn is renamed. A code with no entry is shown as it is, never hidden.
"""

DISPLAY_NAMES = {
    "naive": "Naive",
    "ma4": "Moving average (4 weeks)",
    "ma13": "Moving average (13 weeks)",
    "arima": "ARIMA",
    "prophet": "Prophet",
    "lstm": "LSTM",
    "logistic": "Logistic regression",
    "random_forest": "Random Forest",
    "xgboost": "XGBoost",
    "lightgbm": "LightGBM",
}


def display_name(code: str) -> str:
    return DISPLAY_NAMES.get(code, code)
