"""
ML crowding service — the Python side of the AI/ ↔ yangon-route-wiz merge.

Exposes the passenger-demand / overcrowding-risk / bus-allocation model
(trained from AI/train_model.py's data) as an HTTP API the TanStack Start
backend calls, following the exact same pattern already used for the
travel-time model (src/lib/ai/travel-time-predictor.ts RemoteHttpPredictor):

    POST /predict   { "instances": [ { route_id, hour, weather, is_holiday,
                                        traffic_level, capacity, current_buses }, ... ] }
    ->              { "predictions": [ { predicted_passengers, capacity,
                                          occupancy_pct, risk_level,
                                          required_buses, additional_buses_needed }, ... ],
                       "model": { "name": "...", "version": "..." } }

Run:
    pip install -r requirements.txt
    python train_model.py        # writes model.pkl (once, or after data changes)
    uvicorn app:app --port 8001

Then point the web app at it:
    ML_CROWDING_URL=http://localhost:8001
"""

from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from crowding import CrowdingFeatures, ModelNotTrained, model_version, predict_batch

app = FastAPI(title="Yangon Transit — Crowding Model")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Instance(BaseModel):
    route_id: str
    hour: int = Field(ge=0, le=23)
    weather: str
    is_holiday: bool
    traffic_level: str
    capacity: float
    current_buses: int


class PredictRequest(BaseModel):
    instances: List[Instance]


class Prediction(BaseModel):
    predicted_passengers: int
    capacity: float
    occupancy_pct: float
    risk_level: str
    required_buses: int
    additional_buses_needed: int


class ModelInfo(BaseModel):
    name: str
    version: str


class PredictResponse(BaseModel):
    predictions: List[Prediction]
    model: ModelInfo


@app.get("/health")
def health():
    return {"status": "ok", "model_version": model_version()}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    try:
        features = [CrowdingFeatures(**i.model_dump()) for i in req.instances]
        preds = predict_batch(features)
    except ModelNotTrained as e:
        raise HTTPException(status_code=503, detail=str(e))

    return PredictResponse(
        predictions=[
            Prediction(
                predicted_passengers=p.predicted_passengers,
                capacity=p.capacity,
                occupancy_pct=p.occupancy_pct,
                risk_level=p.risk_level,
                required_buses=p.required_buses,
                additional_buses_needed=p.additional_buses_needed,
            )
            for p in preds
        ],
        model=ModelInfo(name="rf-passenger-demand", version=model_version()),
    )
