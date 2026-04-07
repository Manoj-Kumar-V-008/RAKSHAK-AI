"""
Rakshak AI — Python FastAPI + LangGraph Crisis Agent Server
POST /api/agent/process  →  trigger crisis via REST
WS   /ws/{session_id}    →  bidirectional: send crisis event, receive live stream
GET  /api/health         →  liveness probe
GET  /api/history        →  recent crisis history
"""
import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from .agent import crisis_graph  # noqa: E402 — must be after load_dotenv

# ── Active WebSocket sessions ────────────────────────────────────────────────
active_ws: dict[str, WebSocket] = {}

# ── In-memory crisis history ─────────────────────────────────────────────────
crisis_history: list[dict] = []


@asynccontextmanager
async def lifespan(_app: FastAPI):
    print("[RAKSHAK AI] LangGraph Agent v2.0 started")
    yield
    print("[RAKSHAK AI] Agent shutting down")


app = FastAPI(
    title="Rakshak AI — LangGraph Agent",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _send(session_id: str, payload: dict) -> None:
    ws = active_ws.get(session_id)
    if ws:
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────────────────
#  Core agent runner — streams every node result to the client
# ─────────────────────────────────────────────────────────────────────────────

async def run_agent(session_id: str, sensor_data: dict, venue_lat: float, venue_lon: float) -> None:
    await _send(session_id, {"type": "agent_start", "timestamp": _now()})

    initial: dict = {
        "session_id":       session_id,
        "sensor_data":      sensor_data,
        "venue_lat":        venue_lat,
        "venue_lon":        venue_lon,
        "crisis_type":      "",
        "severity":         0,
        "location_name":    sensor_data.get("location", "Unknown"),
        "threat_score":     0.0,
        "threat_level":     "GREEN",
        "cascade_risk":     0.0,
        "nearby_services":  [],
        "traffic_data":     {},
        "scored_services":  [],
        "best_service":     None,
        "dispatch_reasoning": "",
        "dispatch_status":  "pending",
        "evacuation_zones": [],
        "alert_message":    "",
        "agent_log":        [],
        "is_resolved":      False,
    }

    prev_log_len = 0

    try:
        async for chunk in crisis_graph.astream(initial):
            for node_name, node_out in chunk.items():
                if node_name in ("__end__", "__start__"):
                    continue

                # ── node_start event ─────────────────────────────────────────
                await _send(session_id, {"type": "node_start", "node": node_name, "timestamp": _now()})

                # ── parse per-node output ────────────────────────────────────
                agent_log: list = node_out.get("agent_log", [])
                new_entries = agent_log[prev_log_len:]
                prev_log_len = len(agent_log)

                for entry in new_entries:
                    n = entry.get("node", "")

                    if n == "detect_crisis":
                        await _send(session_id, {
                            "type":         "threat_assessment",
                            "threat_score": node_out.get("threat_score", 0),
                            "threat_level": node_out.get("threat_level", "GREEN"),
                            "cascade_risk": node_out.get("cascade_risk", 0),
                            "severity":     node_out.get("severity", 0),
                            "crisis_type":  node_out.get("crisis_type", ""),
                        })

                    elif n == "gather_intel":
                        await _send(session_id, {
                            "type": "intel",
                            "data": entry.get("data", {}),
                        })

                    elif n == "score_services":
                        scored = node_out.get("scored_services", [])
                        await _send(session_id, {
                            "type":                 "scores",
                            "refined_threat_score": node_out.get("threat_score", 0),
                            "data": [
                                {
                                    "name":         s["name"],
                                    "type":         s["service_type"],
                                    "total":        s["scores"]["total"],
                                    "breakdown":    s["scores"],
                                    "distance_km":  s["distance_km"],
                                    "lat":          s["lat"],
                                    "lon":          s["lon"],
                                }
                                for s in scored[:6]
                            ],
                        })

                    elif n == "decide_dispatch":
                        best = node_out.get("best_service") or {}
                        await _send(session_id, {
                            "type":        "decision",
                            "best_service": best,
                            "dispatched_services": node_out.get("dispatched_services", [best]),
                            "reasoning":   node_out.get("dispatch_reasoning", ""),
                            "status":      node_out.get("dispatch_status", ""),
                        })

                    elif n == "alert_venue":
                        await _send(session_id, {
                            "type":    "evacuation",
                            "zones":   node_out.get("evacuation_zones", []),
                            "message": node_out.get("alert_message", ""),
                        })

                    # Always emit node_result summary
                    await _send(session_id, {
                        "type":    "node_result",
                        "node":    n,
                        "summary": entry.get("summary", ""),
                    })

        # ── resolved ─────────────────────────────────────────────────────────
        await _send(session_id, {
            "type":    "resolved",
            "summary": "Crisis response complete — all units notified.",
        })

        crisis_history.append({"session_id": session_id, "sensor_data": sensor_data, "timestamp": _now()})
        if len(crisis_history) > 50:
            crisis_history.pop(0)

    except Exception as exc:
        await _send(session_id, {"type": "error", "message": str(exc)})
        import traceback
        traceback.print_exc()


# ─────────────────────────────────────────────────────────────────────────────
#  HTTP Endpoints
# ─────────────────────────────────────────────────────────────────────────────

class CrisisEvent(BaseModel):
    session_id: Optional[str] = None
    sensor_data: dict
    venue_lat: float = 12.9716   # Bengaluru default
    venue_lon: float = 77.5946


@app.get("/")
async def root():
    return {"status": "Rakshak AI LangGraph Agent Online", "version": "2.0.0"}


@app.get("/api/health")
async def health():
    return {"status": "OK", "active_sessions": len(active_ws), "timestamp": _now()}


@app.post("/api/agent/process")
async def process_crisis(event: CrisisEvent):
    sid = event.session_id or str(uuid.uuid4())
    asyncio.create_task(run_agent(sid, event.sensor_data, event.venue_lat, event.venue_lon))
    return {"status": "processing", "session_id": sid}


@app.get("/api/history")
async def get_history():
    return {"history": crisis_history[-20:]}


# ─────────────────────────────────────────────────────────────────────────────
#  WebSocket Endpoint — frontend connects here for live agent stream
# ─────────────────────────────────────────────────────────────────────────────

@app.websocket("/ws/{session_id}")
async def ws_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    active_ws[session_id] = websocket

    await websocket.send_text(json.dumps({
        "type":       "connected",
        "session_id": session_id,
        "message":    "RAKSHAK AI NEURAL ENGINE ONLINE — AWAITING CRISIS DATA",
    }))

    try:
        while True:
            raw  = await websocket.receive_text()
            msg  = json.loads(raw)

            if msg.get("type") == "crisis_event":
                asyncio.create_task(run_agent(
                    session_id=session_id,
                    sensor_data=msg["data"],
                    venue_lat=msg.get("venue_lat", 12.9716),
                    venue_lon=msg.get("venue_lon", 77.5946),
                ))
    except WebSocketDisconnect:
        active_ws.pop(session_id, None)
