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
import sys
import traceback
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Path setup ────────────────────────────────────────────────────────────────
# main.py lives in backend-python/  →  BACKEND_DIR = backend-python/
# agent package lives in backend-python/agent/
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
AGENT_DIR = BACKEND_DIR / "agent"

# Ensure the backend-python dir is on sys.path so "agent" is importable
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Load env files: project root first, then backend, then agent dir
load_dotenv(PROJECT_ROOT / ".env", override=False)
load_dotenv(BACKEND_DIR / ".env", override=False)
load_dotenv(AGENT_DIR / ".env", override=False)

# ── Agent imports — wrapped in try/except so the app ALWAYS starts ───────────
# If the agent fails to import, the health endpoint will still report the error
# instead of the whole app crashing and Render returning an opaque 404.
_agent_import_error: str | None = None
crisis_graph = None
alert_venue = None
get_ai_status = None

try:
    from agent.llm import get_ai_status as _get_ai_status   # noqa: E402
    from agent.nodes.alert import alert_venue as _alert_venue  # noqa: E402
    from agent.agent import crisis_graph as _crisis_graph      # noqa: E402

    get_ai_status = _get_ai_status
    alert_venue = _alert_venue
    crisis_graph = _crisis_graph
    print("[RAKSHAK AI] ✅ Agent imports successful")
except Exception as _exc:
    _agent_import_error = f"{type(_exc).__name__}: {_exc}"
    print(f"[RAKSHAK AI] ❌ Agent import failed: {_agent_import_error}")
    traceback.print_exc()

# ── Active WebSocket sessions ────────────────────────────────────────────────
active_ws: dict[str, WebSocket] = {}

# ── In-memory crisis history ─────────────────────────────────────────────────
crisis_history: list[dict] = []
pending_confirmations: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if _agent_import_error:
        print(f"[RAKSHAK AI] ⚠️  Agent NOT loaded: {_agent_import_error}")
        print("[RAKSHAK AI] Health endpoint is available for diagnostics.")
    else:
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


def _append_history(session_id: str, sensor_data: dict) -> None:
    crisis_history.append({"session_id": session_id, "sensor_data": sensor_data, "timestamp": _now()})
    if len(crisis_history) > 50:
        crisis_history.pop(0)


async def resume_confirmation(session_id: str, approved: bool) -> None:
    pending_state = pending_confirmations.pop(session_id, None)
    if not pending_state:
        await _send(session_id, {"type": "error", "message": "No pending confirmation found for this session."})
        return

    sensor_data = pending_state.get("sensor_data", {})

    if not approved:
        await _send(session_id, {
            "type": "confirmation_rejected",
            "message": "Dispatch rejected by operator. Agent returned to monitoring.",
        })
        _append_history(session_id, sensor_data)
        return

    if not alert_venue:
        await _send(session_id, {"type": "error", "message": f"Agent not loaded: {_agent_import_error}"})
        return

    try:
        approved_state = dict(pending_state)
        approved_state["confirmation_status"] = "approved"
        approved_state["dispatch_status"] = "approved"

        await _send(session_id, {"type": "node_start", "node": "alert_venue", "timestamp": _now()})
        node_out = await alert_venue(approved_state)
        approved_state.update(node_out)

        if "chain_of_thought" in node_out:
            await _send(session_id, {
                "type": "chain_of_thought",
                "data": node_out["chain_of_thought"],
            })

        await _send(session_id, {
            "type": "evacuation",
            "zones": node_out.get("evacuation_zones", []),
            "message": node_out.get("alert_message", ""),
        })

        latest_log = node_out.get("agent_log", [])
        if latest_log:
            await _send(session_id, {
                "type": "node_result",
                "node": "alert_venue",
                "summary": latest_log[-1].get("summary", ""),
            })

        await _send(session_id, {
            "type": "resolved",
            "summary": "Crisis response complete - all units notified.",
        })
        _append_history(session_id, sensor_data)
    except Exception as exc:
        await _send(session_id, {"type": "error", "message": str(exc)})


# ─────────────────────────────────────────────────────────────────────────────
#  Core agent runner — streams every node result to the client
# ─────────────────────────────────────────────────────────────────────────────

async def run_agent(session_id: str, sensor_data: dict, venue_lat: float, venue_lon: float) -> None:
    if not crisis_graph:
        await _send(session_id, {
            "type": "error",
            "message": f"Agent not loaded: {_agent_import_error}",
        })
        return

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
        "traffic_info":     {},
        "scored_services":  [],
        "dispatched_services": [],
        "rejected_services": [],
        "best_service":     None,
        "dispatch_reasoning": "",
        "dispatch_status":  "pending",
        "confirmation_required": False,
        "confirmation_status": "auto_approved",
        "evacuation_zones": [],
        "alert_message":    "",
        "emergency_contacts": [],
        "sms_results":      [],
        "call_results":     [],
        "chain_of_thought": [],
        "agent_log":        [],
        "is_resolved":      False,
    }

    prev_log_len = 0
    latest_state = dict(initial)

    try:
        async for chunk in crisis_graph.astream(initial):
            for node_name, node_out in chunk.items():
                if node_name in ("__end__", "__start__"):
                    continue

                latest_state.update(node_out)

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
                                    "id":           s.get("id"),
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
                            "confirmation_required": node_out.get("confirmation_required", False),
                            "confirmation_status": node_out.get("confirmation_status", "auto_approved"),
                            "rejected_services": node_out.get("rejected_services", []),
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

                if "chain_of_thought" in node_out:
                    await _send(session_id, {
                        "type": "chain_of_thought",
                        "data": node_out["chain_of_thought"]
                    })

        # ── resolved ─────────────────────────────────────────────────────────
        if latest_state.get("confirmation_required") and latest_state.get("confirmation_status") == "pending":
            pending_confirmations[session_id] = dict(latest_state)
            await _send(session_id, {
                "type": "awaiting_confirmation",
                "message": "Human approval required before dispatch and alerts proceed.",
            })
        else:
            pending_confirmations.pop(session_id, None)
            await _send(session_id, {
                "type":    "resolved",
                "summary": "Crisis response complete — all units notified.",
            })

        if not (latest_state.get("confirmation_required") and latest_state.get("confirmation_status") == "pending"):
            _append_history(session_id, sensor_data)

    except Exception as exc:
        await _send(session_id, {"type": "error", "message": str(exc)})
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
    return {
        "status": "Rakshak AI LangGraph Agent Online",
        "version": "2.0.0",
        "agent_loaded": crisis_graph is not None,
        "agent_error": _agent_import_error,
    }


@app.get("/api/health")
async def health():
    ai_status = get_ai_status() if get_ai_status else {"error": _agent_import_error}
    return {
        "status": "OK" if crisis_graph else "DEGRADED",
        "agent_loaded": crisis_graph is not None,
        "agent_error": _agent_import_error,
        "active_sessions": len(active_ws),
        "pending_confirmations": len(pending_confirmations),
        "timestamp": _now(),
        "python_version": sys.version,
        "ai": ai_status,
    }


@app.post("/api/agent/process")
async def process_crisis(event: CrisisEvent):
    if not crisis_graph:
        return {"status": "error", "message": f"Agent not loaded: {_agent_import_error}"}
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
            elif msg.get("type") == "dispatch_confirmation":
                asyncio.create_task(resume_confirmation(
                    session_id=session_id,
                    approved=bool(msg.get("approved")),
                ))
    except WebSocketDisconnect:
        active_ws.pop(session_id, None)
