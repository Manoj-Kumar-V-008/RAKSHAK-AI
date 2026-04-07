"""
Node 4 — decide_dispatch
Gemini reviews scored services and picks the best dispatch target.
"""
import json
import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

from ..state import CrisisState


def _get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.getenv("GEMINI_API_KEY", ""),
        temperature=0.1,
    )


async def decide_dispatch(state: CrisisState) -> dict:
    scored      = state.get("scored_services", [])
    crisis_type = state["crisis_type"]
    severity    = state["severity"]
    threat_lvl  = state["threat_level"]
    threat_sc   = state["threat_score"]
    cascade     = state.get("cascade_risk", 0.0)

    if not scored:
        log = {"node": "decide_dispatch", "summary": "No scored services available — dispatch failed."}
        return {
            "best_service":      None,
            "dispatch_reasoning": "No services found in the area.",
            "dispatch_status":   "failed",
            "agent_log":         state.get("agent_log", []) + [log],
        }

    top_candidates = scored[:10]
    top_str = json.dumps(
        [
            {
                "name": s["name"],
                "type": s["service_type"],
                "distance_km": s["distance_km"],
                "total_score": s["scores"]["total"],
                "breakdown": s["scores"],
            }
            for s in top_candidates
        ],
        indent=2,
    )

    prompt = f"""You are RAKSHAK AI making a critical emergency dispatch decision.
Crisis: {crisis_type.upper()}
Severity: {severity}/10
Threat Level: {threat_lvl} (Score: {threat_sc}/100)
Cascade Risk: {cascade:.1%}

Top scored emergency services (higher score = better):
{top_str}

Choose ALL required services logically. 
For HIGH severity crises in India, standard operational protocols require dispatching ALL THREE emergency services (Fire Brigade, Police, and Hospital).
Select at least one of EVERY required service type (e.g. 1 Fire Station, 1 Police Station, and 1 Hospital) from the list below to guarantee full coverage of the crisis. Ensure you only select from the exact names provided.
Explain your reasoning (2-3 sentences).
Return ONLY raw JSON:
{{
  "chosen_service_names": ["<exact name 1>", "<exact name 2>"],
  "reasoning": "<2-3 sentence dispatch rationale covering why these units are needed, their scores, and ETAs>",
  "eta_estimate_mins": <integer max ETA>
}}"""

    try:
        resp    = _get_llm().invoke([HumanMessage(content=prompt)])
        content = resp.content.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        decision = json.loads(content)
    except Exception:
        decision = {
            "chosen_service_names": [top_candidates[0]["name"]],
            "reasoning": f"Default fallback dispatch for {crisis_type}.",
            "eta_estimate_mins": int(top_candidates[0]["distance_km"] * 2),
        }

    chosen_names = decision.get("chosen_service_names", [])
    if not chosen_names and len(top_candidates) > 0:
        chosen_names = [top_candidates[0]["name"]]

    dispatched_services = []
    for s in top_candidates:
        if s["name"] in chosen_names:
            dispatched_services.append(s)
            
    # Fallback if names didn't match perfectly
    if not dispatched_services and top_candidates:
        dispatched_services = [top_candidates[0]]

    best = dispatched_services[0]

    log = {
        "node":    "decide_dispatch",
        "summary": f"Dispatching: {', '.join(s['name'] for s in dispatched_services)}. Max ETA: ~{decision.get('eta_estimate_mins', '?')} min",
        "data":    {**decision, "dispatched_services": dispatched_services},
    }

    return {
        "best_service":       best,
        "dispatched_services": dispatched_services,
        "dispatch_reasoning": decision.get("reasoning", ""),
        "dispatch_status":    "dispatched",
        "agent_log":          state.get("agent_log", []) + [log],
    }
