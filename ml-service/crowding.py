"""
Shared prediction logic — one place merging what used to be three separate
scripts in the standalone AI/ folder:
  - predict.py        → predict_passengers()
  - overcrowding.py    → occupancy % + risk level
  - bus_allocation.py  → required / additional buses

BUS_SEAT_CAPACITY mirrors AI/bus_allocation.py's assumption of 50 seats/bus.
"""

from dataclasses import dataclass
from pathlib import Path
import math

import joblib
import pandas as pd

MODEL_PATH = Path(__file__).parent / "model.pkl"
BUS_SEAT_CAPACITY = 50

_loaded = None


class ModelNotTrained(Exception):
    pass


def _load():
    global _loaded
    if _loaded is None:
        if not MODEL_PATH.exists():
            raise ModelNotTrained(f"{MODEL_PATH} not found — run `python train_model.py` first.")
        _loaded = joblib.load(MODEL_PATH)
    return _loaded


@dataclass
class CrowdingFeatures:
    route_id: str
    hour: int
    weather: str
    is_holiday: bool
    traffic_level: str
    capacity: float
    current_buses: int


@dataclass
class CrowdingPrediction:
    predicted_passengers: int
    capacity: float
    occupancy_pct: float
    risk_level: str
    required_buses: int
    additional_buses_needed: int


def risk_level_for(occupancy_pct: float) -> str:
    if occupancy_pct < 70:
        return "low"
    if occupancy_pct < 90:
        return "medium"
    if occupancy_pct <= 100:
        return "high"
    return "critical"


def predict_one(f: CrowdingFeatures) -> CrowdingPrediction:
    bundle = _load()
    pipeline = bundle["pipeline"]

    # route_id in the training data is a small integer id (1-5). Real network
    # route ids can be any string; fall back to a stable hash into that range
    # so every route still gets a plausible, deterministic prediction.
    try:
        model_route_id = int(f.route_id)
    except ValueError:
        model_route_id = (abs(hash(f.route_id)) % 5) + 1

    row = pd.DataFrame(
        {
            "route_id": [model_route_id],
            "hour": [f.hour],
            "weather": [f.weather],
            "is_holiday": [int(f.is_holiday)],
            "traffic_level": [f.traffic_level],
            "capacity": [f.capacity],
            "current_buses": [f.current_buses],
        }
    )
    predicted_demand = max(0, round(float(pipeline.predict(row)[0])))

    occupancy_pct = round((predicted_demand / f.capacity) * 100, 2) if f.capacity else 0.0
    risk = risk_level_for(occupancy_pct)
    required_buses = math.ceil(predicted_demand / BUS_SEAT_CAPACITY) if predicted_demand else 0
    additional = max(0, required_buses - f.current_buses)

    return CrowdingPrediction(
        predicted_passengers=predicted_demand,
        capacity=f.capacity,
        occupancy_pct=occupancy_pct,
        risk_level=risk,
        required_buses=required_buses,
        additional_buses_needed=additional,
    )


def predict_batch(instances: list[CrowdingFeatures]) -> list[CrowdingPrediction]:
    return [predict_one(f) for f in instances]


def model_version() -> str:
    try:
        return _load().get("version", "unknown")
    except ModelNotTrained:
        return "untrained"
