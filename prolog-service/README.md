# Prolog Transit Rule Service

This service provides symbolic AI and declarative logic rules for Yangon Transit using **SWI-Prolog** and **FastAPI**.

It complements the machine learning passenger demand model (`ml-service/`) and the deterministic Dijkstra route engine (`src/lib/transit/engine.ts`).

## Capabilities

Defined in `bus_routes.pl`:

- **Deductive Route Inference**: Infers direct connections (`direct_connection/4`) and 1-transfer transit interchanges (`transfer_connection/6`).
- **Stop Sequence Monotonicity**: Proves whether candidate bus stops form a strictly forward, ordered sequence (`valid_stop_sequence/2`).
- **Acyclic Route Guarantee**: Deduces whether visited stops are cycle-free (`rule_acyclic_path/3`).
- **Transfer Efficiency & Certification**: Certifies interchange points as valid multi-route hubs (`rule_interchange_certified/3`) and checks transfer budgets (`rule_transfer_efficiency/3`).
- **Pedestrian Comfort Audit**: Verifies walking distance against the 500m urban walkability threshold (`rule_pedestrian_comfort/3`).
- **Flat-Fare Logic Compliance**: Formally checks fare calculations against the 400 MMK/leg flat fare rule (`rule_fare_compliance/4`).

## Running the Service

```bash
cd prolog-service
pip install -r requirements.txt
uvicorn app:app --port 8002
```

Then tell the web application where to find it:

```bash
# In .env
PROLOG_SERVICE_URL=http://localhost:8002
```

## Running without the Service

The web app never strictly requires this service to be running. `src/lib/prolog/prolog-service.ts` falls back to a deterministic Prolog rule evaluator when `PROLOG_SERVICE_URL` is unset or unreachable—mirroring how `ML_CROWDING_URL` and `ML_PREDICTOR_URL` work.
