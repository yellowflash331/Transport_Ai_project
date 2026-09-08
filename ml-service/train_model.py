"""
Trains the passenger-demand model used for crowding / overcrowding prediction
and bus-allocation recommendations.

Merged from the standalone AI/ folder (train_model.py + predict.py +
overcrowding.py + bus_allocation.py) into one reusable service that the
yangon-route-wiz web app calls over HTTP (see app.py).

Run:
    python train_model.py
Produces:
    model.pkl  — a scikit-learn Pipeline (OneHotEncoder + RandomForestRegressor)
"""

import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

FEATURE_COLUMNS = ["route_id", "hour", "weather", "is_holiday", "traffic_level", "capacity", "current_buses"]
CATEGORICAL_COLUMNS = ["weather", "traffic_level"]
TARGET_COLUMN = "passenger_count"
MODEL_VERSION = "1.0-rf"


def train(csv_path: str = "transport_data_5000.csv", model_path: str = "model.pkl") -> None:
    df = pd.read_csv(csv_path)

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    preprocessor = ColumnTransformer(
        transformers=[("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_COLUMNS)],
        remainder="passthrough",
    )
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    pipeline = Pipeline([("preprocessor", preprocessor), ("model", model)])

    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)

    print("MAE:", mean_absolute_error(y_test, predictions))
    print("R2 :", r2_score(y_test, predictions))

    joblib.dump({"pipeline": pipeline, "version": MODEL_VERSION}, model_path)
    print(f"Model saved to {model_path} (version {MODEL_VERSION})")


if __name__ == "__main__":
    train()
