# ML crowding service

This folder is the merged home of what used to be the standalone `AI/` folder
at the repo root (`predict.py`, `overcrowding.py`, `bus_allocation.py`,
`train_model.py`, `transport_data_5000.csv`, `model.pkl`). It turns that
one-off script trio into an HTTP service the web app calls, the same way
`prolog-service/` wraps the Prolog rules engine.

It predicts, per bus route / hour / weather / traffic condition:

- **predicted passenger demand** (the original regression model)
- **occupancy %** and a **risk level** (low / medium / high / critical)
- **buses required** and **additional buses needed** to stay under capacity

The web app shows this as a crowding badge on each bus leg of a journey.

## Run it

```bash
cd ml-service
pip install -r requirements.txt
python train_model.py        # writes model.pkl (re-run after changing the CSV)
uvicorn app:app --port 8001
```

Then tell the Node app where to find it:

```bash
# yangon-route-wiz/.env
ML_CROWDING_URL=http://localhost:8001
```

## Without the service running

The web app never *requires* this service. `src/lib/ai/crowding-predictor.ts`
falls back to a deterministic demo heuristic (clearly labelled "Demo model"
in the UI) when `ML_CROWDING_URL` is unset or the service is unreachable —
mirroring how `ML_PREDICTOR_URL` / `travel-time-predictor.ts` already works
for travel-time predictions.
