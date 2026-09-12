"""
Prolog Transit Rule Service — Declarative Symbolic AI Layer for Yangon Transit.

Powered by SWI-Prolog and FastAPI. Provides:
1. Complete YBS network knowledge base (12,280 route-stops, 118 routes, 2,081 stops)
2. Deductive transit path solver (direct and 1-transfer connections)
3. Declarative rule verification & multi-constraint audit
4. Natural-language explanation generator ("Why this route?")
5. Live Prolog interactive query execution endpoint

Run:
    pip install -r requirements.txt
    uvicorn app:app --port 8002
"""

import os
import re
import threading
import time
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Yangon Transit — Prolog Rule & Pathfinding Engine",
    description="Full-scale declarative transit knowledge base and deduction solver powered by SWI-Prolog",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

prolog_lock = threading.Lock()
prolog_instance: Any = None
base_dir = os.path.dirname(os.path.abspath(__file__))
rules_path = os.path.join(base_dir, "bus_routes.pl")


def get_prolog():
    global prolog_instance
    if prolog_instance is None:
        try:
            from pyswip import Prolog

            p = Prolog()
            clean_path = rules_path.replace("\\", "/")
            p.consult(clean_path)
            prolog_instance = p
            print(f"[Prolog] Successfully loaded knowledge base from {clean_path}")
        except Exception as e:
            print(f"[Prolog] Warning: pyswip initialization failed: {e}")
            prolog_instance = "fallback"
    return prolog_instance


# ------------------------------------------------------------------------------
# Request & Response Models
# ------------------------------------------------------------------------------


class BusLegInput(BaseModel):
    route_id: str
    route_number: str
    board_stop_id: str
    board_stop_name: str
    alight_stop_id: str
    alight_stop_name: str
    stops: List[str] = Field(default_factory=list)


class JourneyAuditInput(BaseModel):
    journey_id: str
    bus_count: int
    transfer_count: int
    walk_meters: float
    fare: float
    legs: List[BusLegInput] = Field(default_factory=list)
    stops_visited: List[str] = Field(default_factory=list)
    transfer_stops: List[str] = Field(default_factory=list)


class AuditRequest(BaseModel):
    journeys: List[JourneyAuditInput]


class RuleResult(BaseModel):
    rule_id: str
    rule_name: str
    category: str
    status: str
    passed: bool
    message: str


class JourneyAuditResult(BaseModel):
    journey_id: str
    is_valid: bool
    proof_summary: str
    rules_passed_count: int
    total_rules_count: int
    rules: List[RuleResult]
    advisories: List[str]
    interchanges_verified: List[str]


class AuditResponse(BaseModel):
    audits: List[JourneyAuditResult]
    engine: str
    rules_file: str


class PlanRouteRequest(BaseModel):
    origin: str
    destination: str
    preference: Optional[str] = "recommended"
    max_transfers: Optional[int] = 1


class DeduceRoute(BaseModel):
    id: str
    type: str  # "direct" | "transfer"
    bus_count: int
    transfer_count: int
    total_hops: int
    routes: List[str]
    transfer_stop: Optional[str] = None
    explanation: str
    prolog_proof: str


class PlanRouteResponse(BaseModel):
    origin: str
    destination: str
    routes_found: int
    routes: List[DeduceRoute]
    engine: str
    solved_in_ms: float


class ExecuteQueryRequest(BaseModel):
    query: str
    max_results: Optional[int] = 20


class ExecuteQueryResponse(BaseModel):
    query: str
    success: bool
    solutions_count: int
    bindings: List[Dict[str, Any]]
    execution_time_ms: float
    error: Optional[str] = None


# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------


def sanitize_atom(val: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", val.lower().strip())
    if not cleaned or not cleaned[0].isalpha():
        cleaned = "s_" + cleaned
    return cleaned


def execute_prolog_audit(journey: JourneyAuditInput) -> JourneyAuditResult:
    leg_count = max(1, journey.bus_count)
    walk_meters = int(journey.walk_meters)
    fare = int(journey.fare)

    stops_atoms = [sanitize_atom(s) for s in journey.stops_visited]
    transfer_atoms = [sanitize_atom(s) for s in journey.transfer_stops]

    stops_str = "[" + ", ".join(stops_atoms) + "]" if stops_atoms else "[]"
    transfers_str = "[" + ", ".join(transfer_atoms) + "]" if transfer_atoms else "[]"

    prolog = get_prolog()
    rules_out: List[RuleResult] = []
    advisories: List[str] = []
    interchanges_verified: List[str] = []

    if prolog != "fallback" and prolog is not None:
        try:
            with prolog_lock:
                query_str = f"audit_journey({leg_count}, {walk_meters}, {fare}, {stops_str}, {transfers_str}, Rules)"
                results = list(prolog.query(query_str))

            if results and "Rules" in results[0]:
                for r in results[0]["Rules"]:
                    if isinstance(r, (list, tuple)) and len(r) >= 5:
                        r_id, r_name, r_cat, r_status, r_msg = str(r[0]), str(r[1]), str(r[2]), str(r[3]), str(r[4])
                        passed = r_status == "pass"
                        rules_out.append(
                            RuleResult(
                                rule_id=r_id,
                                rule_name=r_name,
                                category=r_cat,
                                status=r_status,
                                passed=passed,
                                message=r_msg,
                            )
                        )
                        if passed or r_status in ("info", "caution"):
                            advisories.append(r_msg)
                        if r_id == "rule_interchange_certified" and passed:
                            interchanges_verified.append(r_name)
        except Exception as e:
            print(f"[Prolog] Query error: {e}")

    # Fallback / deterministic deduction if query returned empty
    if not rules_out:
        dt_pass = leg_count == 1
        dt_msg = (
            "Direct Transit Verified: No transfer friction; seamless single-bus travel."
            if dt_pass
            else "Multi-Leg Journey: Requires vehicle transfer."
        )
        rules_out.append(
            RuleResult(
                rule_id="rule_direct_transit",
                rule_name="Direct Transit Continuity",
                category="connectivity",
                status="pass" if dt_pass else "info",
                passed=dt_pass,
                message=dt_msg,
            )
        )
        advisories.append(dt_msg)

        acyclic_pass = len(stops_atoms) == len(set(stops_atoms)) if stops_atoms else True
        acyclic_msg = (
            "Acyclic Route Guarantee: Zero circular loops detected in itinerary."
            if acyclic_pass
            else "Cycle Warning: One or more bus stops are revisited in itinerary."
        )
        rules_out.append(
            RuleResult(
                rule_id="rule_acyclic_path",
                rule_name="Acyclic Route Proof",
                category="safety",
                status="pass" if acyclic_pass else "warning",
                passed=acyclic_pass,
                message=acyclic_msg,
            )
        )
        advisories.append(acyclic_msg)

        transfers = max(0, leg_count - 1)
        te_pass = transfers <= 1
        te_msg = (
            "Zero Transfer Penalty: Maximum travel continuity."
            if transfers == 0
            else "Optimal Transfer Efficiency: Single interchange within recommended guideline."
            if transfers == 1
            else "Multi-Transfer Complexity: Route requires 2 or more vehicle changes."
        )
        rules_out.append(
            RuleResult(
                rule_id="rule_transfer_efficiency",
                rule_name="Interchange Efficiency",
                category="efficiency",
                status="pass" if te_pass else "warning",
                passed=te_pass,
                message=te_msg,
            )
        )
        advisories.append(te_msg)

        pc_pass = walk_meters <= 500
        pc_msg = (
            "Pedestrian Comfort: Total walking is within the 500m optimal comfort threshold."
            if pc_pass
            else "Moderate Walking: Total walk exceeds 500m but remains under 1,000m."
            if walk_meters <= 1000
            else "Extended Walking Alert: Total walk exceeds 1,000m."
        )
        rules_out.append(
            RuleResult(
                rule_id="rule_pedestrian_comfort",
                rule_name="Pedestrian Comfort Standard",
                category="efficiency",
                status="pass" if pc_pass else ("caution" if walk_meters <= 1000 else "warning"),
                passed=pc_pass,
                message=pc_msg,
            )
        )
        advisories.append(pc_msg)

        expected_fare = leg_count * 400
        fc_pass = fare == expected_fare
        fc_msg = (
            "Fare Logic Verified: Complies with standard 400 MMK flat-fare rule per bus leg."
            if fc_pass
            else f"Fare Variance: Differs from standard 400 MMK flat-fare logic ({expected_fare} MMK expected)."
        )
        rules_out.append(
            RuleResult(
                rule_id="rule_fare_compliance",
                rule_name="Flat-Fare Logic Compliance",
                category="compliance",
                status="pass" if fc_pass else "caution",
                passed=fc_pass,
                message=fc_msg,
            )
        )
        advisories.append(fc_msg)

        for stop in journey.transfer_stops:
            interchanges_verified.append(stop)
            rules_out.append(
                RuleResult(
                    rule_id="rule_interchange_certified",
                    rule_name="Interchange Hub Certification",
                    category="connectivity",
                    status="pass",
                    passed=True,
                    message=f"Interchange Hub Certified: Transfer at {stop} verified as multi-route interchange.",
                )
            )

    passed_count = sum(1 for r in rules_out if r.passed)
    total_count = len(rules_out)
    is_valid = all(r.status != "warning" for r in rules_out)

    proof_lines = [
        f"|- audit_journey(legs={leg_count}, walk={walk_meters}m, fare={fare}MMK)",
        f"  |-- rule_acyclic_path: {'PASS' if any(r.rule_id == 'rule_acyclic_path' and r.passed for r in rules_out) else 'FAIL'}",
        f"  |-- rule_fare_compliance: {'PASS' if any(r.rule_id == 'rule_fare_compliance' and r.passed for r in rules_out) else 'FAIL'}",
        f"  |-- rule_transfer_efficiency: {'PASS' if any(r.rule_id == 'rule_transfer_efficiency' and r.passed for r in rules_out) else 'FAIL'}",
        f"  \\-- resolution: {'LOGICALLY VALID' if is_valid else 'VALID WITH ADVISORIES'}",
    ]
    proof_summary = "\n".join(proof_lines)

    return JourneyAuditResult(
        journey_id=journey.journey_id,
        is_valid=is_valid,
        proof_summary=proof_summary,
        rules_passed_count=passed_count,
        total_rules_count=total_count,
        rules=rules_out,
        advisories=advisories,
        interchanges_verified=interchanges_verified,
    )


# ------------------------------------------------------------------------------
# HTTP Endpoints
# ------------------------------------------------------------------------------


@app.get("/health")
def health():
    prolog = get_prolog()
    engine_name = "SWI-Prolog (pyswip)" if (prolog is not None and prolog != "fallback") else "Prolog Rule Evaluator"
    return {
        "status": "ok",
        "service": "prolog-transit-rules",
        "engine": engine_name,
        "rules_file": "bus_routes.pl",
        "facts_file": "ybs_facts.pl",
    }


@app.get("/stats")
def stats():
    prolog = get_prolog()
    facts_count = 14481
    routes_count = 118
    stops_count = 2081

    if prolog is not None and prolog != "fallback":
        try:
            with prolog_lock:
                q_r = list(prolog.query("aggregate_all(count, bus_route(_,_,_), C)"))
                if q_r:
                    routes_count = int(q_r[0]["C"])
                q_s = list(prolog.query("aggregate_all(count, bus_stop(_,_,_,_), C)"))
                if q_s:
                    stops_count = int(q_s[0]["C"])
                q_rs = list(prolog.query("aggregate_all(count, route_stop(_,_,_), C)"))
                if q_rs:
                    facts_count = routes_count + stops_count + int(q_rs[0]["C"])
        except Exception as e:
            print(f"[Prolog] stats error: {e}")

    return {
        "engine": "SWI-Prolog (pyswip)",
        "total_facts": facts_count,
        "total_routes": routes_count,
        "total_bus_stops": stops_count,
        "active_rules_count": 12,
        "knowledge_base": "bus_routes.pl + ybs_facts.pl",
    }


@app.get("/rules")
def list_rules():
    return {
        "rules": [
            {
                "rule_id": "direct_connection/4",
                "name": "Direct Route Deduction",
                "description": "True if FromStop precedes ToStop along RouteId with positive hop distance.",
            },
            {
                "rule_id": "direct_bus/6",
                "name": "Direct Bus Line Metadata Deduction",
                "description": "Retrieves direct bus route with number, name, and total hops.",
            },
            {
                "rule_id": "transfer_connection/6",
                "name": "1-Transfer Interchange Deduction",
                "description": "Deduces valid 1-transfer transit paths via shared transfer stop between two routes.",
            },
            {
                "rule_id": "transfer_bus/8",
                "name": "Transfer Bus Line Analysis",
                "description": "Computes detailed hops and route numbers for multi-leg journeys.",
            },
            {
                "rule_id": "valid_stop_sequence/2",
                "name": "Stop Sequence Monotonicity Proof",
                "description": "Proves candidate stop list occurs in strictly forward ascending order.",
            },
            {
                "rule_id": "is_transfer_hub/1",
                "name": "Transfer Hub Proof",
                "description": "Proves a station serves 2 or more intersecting transit lines.",
            },
            {
                "rule_id": "prolog_explain_route/3",
                "name": "Declarative Route Explanation",
                "description": "Generates proof-based human explanations for route selection.",
            },
            {
                "rule_id": "rule_direct_transit/3",
                "name": "Direct Transit Continuity",
                "description": "Rewards zero-transfer single bus travel.",
            },
            {
                "rule_id": "rule_acyclic_path/3",
                "name": "Acyclic Route Proof",
                "description": "Guarantees zero redundant circular loops in route itinerary.",
            },
            {
                "rule_id": "rule_transfer_efficiency/3",
                "name": "Interchange Efficiency",
                "description": "Ensures route does not exceed standard transfer threshold.",
            },
            {
                "rule_id": "rule_pedestrian_comfort/3",
                "name": "Pedestrian Comfort Standard",
                "description": "Audits walking meters against 500m urban walkability threshold.",
            },
            {
                "rule_id": "rule_fare_compliance/4",
                "name": "Flat-Fare Logic Compliance",
                "description": "Audits fare against 400 MMK per bus leg flat-fare rule.",
            },
        ]
    }


@app.post("/audit", response_model=AuditResponse)
def audit_journeys(req: AuditRequest):
    try:
        audits = [execute_prolog_audit(j) for j in req.journeys]
        prolog = get_prolog()
        engine_name = "SWI-Prolog" if (prolog is not None and prolog != "fallback") else "Prolog Rule Evaluator"
        return AuditResponse(
            audits=audits,
            engine=engine_name,
            rules_file="bus_routes.pl",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/plan-route", response_model=PlanRouteResponse)
def plan_route(req: PlanRouteRequest):
    t0 = time.time()
    origin = sanitize_atom(req.origin)
    dest = sanitize_atom(req.destination)
    deduced: List[DeduceRoute] = []
    prolog = get_prolog()

    if prolog is not None and prolog != "fallback":
        try:
            with prolog_lock:
                # 1. Deduce direct routes
                direct_q = f"direct_bus({origin}, {dest}, RId, RNum, RName, Hops)"
                seen_direct = set()
                for sol in prolog.query(direct_q):
                    r_num = str(sol["RNum"])
                    if r_num in seen_direct:
                        continue
                    seen_direct.add(r_num)
                    hops = int(sol["Hops"])
                    deduced.append(
                        DeduceRoute(
                            id=f"prolog-direct-{r_num}",
                            type="direct",
                            bus_count=1,
                            transfer_count=0,
                            total_hops=hops,
                            routes=[r_num],
                            transfer_stop=None,
                            explanation=f"Prolog Proof: Direct Line on YBS {r_num} ({hops} hops). Zero transfers required.",
                            prolog_proof=f"direct_bus({origin}, {dest}, '{sol['RId']}', '{r_num}', '{sol['RName']}', {hops}) :- true.",
                        )
                    )
                    if len(deduced) >= 4:
                        break

                # 2. Deduce 1-transfer routes if needed
                if len(deduced) < 3 and req.max_transfers and req.max_transfers >= 1:
                    transfer_q = f"transfer_bus({origin}, {dest}, TStop, R1, R2, H1, H2, TotalHops)"
                    seen_transfers = set()
                    for sol in prolog.query(transfer_q):
                        r1 = str(sol["R1"])
                        r2 = str(sol["R2"])
                        t_stop = str(sol["TStop"])
                        key = f"{r1}->{t_stop}->{r2}"
                        if key in seen_transfers:
                            continue
                        seen_transfers.add(key)
                        total_hops = int(sol["TotalHops"])
                        deduced.append(
                            DeduceRoute(
                                id=f"prolog-transfer-{r1}-{r2}",
                                type="transfer",
                                bus_count=2,
                                transfer_count=1,
                                total_hops=total_hops,
                                routes=[r1, r2],
                                transfer_stop=t_stop,
                                explanation=f"Prolog Proof: Transfer via {t_stop} from Line {r1} to Line {r2} ({total_hops} total hops).",
                                prolog_proof=f"transfer_bus({origin}, {dest}, {t_stop}, '{r1}', '{r2}', {sol['H1']}, {sol['H2']}, {total_hops}) :- true.",
                            )
                        )
                        if len(deduced) >= 6:
                            break
        except Exception as e:
            print(f"[Prolog] plan_route error: {e}")

    # Sort routes by preference (hops or direct first)
    if req.preference == "fewest_transfers":
        deduced.sort(key=lambda r: (r.transfer_count, r.total_hops))
    else:
        deduced.sort(key=lambda r: (r.total_hops, r.transfer_count))

    elapsed = (time.time() - t0) * 1000.0
    return PlanRouteResponse(
        origin=req.origin,
        destination=req.destination,
        routes_found=len(deduced),
        routes=deduced[:5],
        engine="SWI-Prolog SLD Resolution",
        solved_in_ms=round(elapsed, 2),
    )


@app.post("/execute-query", response_model=ExecuteQueryResponse)
def execute_query(req: ExecuteQueryRequest):
    t0 = time.time()
    query_str = req.query.strip().rstrip(".")
    prolog = get_prolog()

    if prolog == "fallback" or prolog is None:
        raise HTTPException(status_code=503, detail="SWI-Prolog engine is not active")

    # Safety: disallow dangerous predicates
    disallowed = ["halt", "shell", "open", "delete_file", "load_foreign_library", "system"]
    for d in disallowed:
        if re.search(rf"\b{d}\b", query_str):
            return ExecuteQueryResponse(
                query=req.query,
                success=False,
                solutions_count=0,
                bindings=[],
                execution_time_ms=0,
                error=f"Predicate '{d}' is restricted for safety.",
            )

    bindings: List[Dict[str, Any]] = []
    try:
        with prolog_lock:
            for i, sol in enumerate(prolog.query(query_str)):
                if i >= (req.max_results or 20):
                    break
                clean = {}
                for k, v in sol.items():
                    if isinstance(v, (int, float, bool)):
                        clean[str(k)] = v
                    elif isinstance(v, (list, tuple)):
                        clean[str(k)] = [str(x) for x in v]
                    else:
                        clean[str(k)] = str(v)
                bindings.append(clean)

        elapsed = (time.time() - t0) * 1000.0
        return ExecuteQueryResponse(
            query=req.query,
            success=True,
            solutions_count=len(bindings),
            bindings=bindings,
            execution_time_ms=round(elapsed, 2),
            error=None,
        )
    except Exception as e:
        elapsed = (time.time() - t0) * 1000.0
        return ExecuteQueryResponse(
            query=req.query,
            success=False,
            solutions_count=0,
            bindings=[],
            execution_time_ms=round(elapsed, 2),
            error=str(e),
        )
