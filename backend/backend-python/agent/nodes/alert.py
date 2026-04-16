"""
Node 5 — alert_venue
Determines evacuation zones and constructs alert messaging.
"""
from ..state import CrisisState

# Fine-grained location → zones mapping
LOCATION_ZONES: dict[str, list[str]] = {
    "Kitchen, Floor 2":        ["kitchen", "floor-2", "dining-area"],
    "Lobby Level 1":           ["lobby", "ground-floor", "main-entrance"],
    "East Gate, Sector B":     ["east-wing", "sector-b", "perimeter"],
    "Sector C, Main Grid":     ["sector-c", "main-corridor", "utility-wing"],
    "Basement B2, Utility":    ["basement", "b2", "utility-zone"],
}

CRISIS_ALERTS: dict[str, str] = {
    "smoke":    "⚠️ SMOKE DETECTED — Evacuate immediately via nearest exit. Do NOT use elevators.",
    "fire":     "🔥 FIRE ALERT — Emergency evacuation in progress. Proceed to assembly point NOW.",
    "health":   "🚑 MEDICAL EMERGENCY — Clear the area for paramedic access.",
    "cardiac":  "🚨 CARDIAC ARREST — Do not move the patient. Paramedics are en route.",
    "security": "🚨 SECURITY ALERT — Shelter in place. Lock doors. Follow staff instructions.",
    "breach":   "🔒 PERIMETER BREACH — Lockdown initiated. Do NOT exit. Await clearance.",
    "power":    "⚡ POWER FAILURE — Remain calm. Emergency lighting active. Avoid machinery.",
    "water":    "💧 FLOOD WARNING — Move to upper floors immediately. Seal ground-floor exits.",
}

# Additional adjacent zones based on severity
ADJACENT_ZONES: dict[str, dict[int, list[str]]] = {
    "fire":  {8: ["main-corridor"], 9: ["emergency-exits", "roof-assembly"]},
    "smoke": {8: ["main-corridor"], 9: ["emergency-exits"]},
    "water": {7: ["ground-floor"],  9: ["basement"]},
}


async def alert_venue(state: CrisisState) -> dict:
    location    = state.get("location_name", "")
    crisis_type = state.get("crisis_type", "smoke")
    severity    = state.get("severity", 7)

    # Base zones from location
    zones = list(LOCATION_ZONES.get(location, [location.lower().replace(" ", "-").replace(",", "")]))

    # Escalate zones based on severity
    adj = ADJACENT_ZONES.get(crisis_type, {})
    for threshold, extra_zones in sorted(adj.items()):
        if severity >= threshold:
            for z in extra_zones:
                if z not in zones:
                    zones.append(z)

    # Ensure at least one zone
    if not zones:
        zones = ["main-area"]

    alert_msg = CRISIS_ALERTS.get(
        crisis_type,
        f"🚨 EMERGENCY ALERT: {crisis_type.upper()} — Follow emergency protocol immediately.",
    )

    chain_of_thought = state.get("chain_of_thought", [])
    chain_of_thought.append({
        "node": "alert_venue",
        "text": "Evacuation plan finalized and venue alert messaging prepared.",
        "factors": [
            f"Human approval status: {state.get('confirmation_status', 'auto_approved')}",
            f"Zones: {', '.join(zones)}",
            f"Severity: {severity}/10",
        ],
    })

    log = {
        "node":    "alert_venue",
        "summary": f"Evacuating {len(zones)} zone(s): {', '.join(zones)}",
        "data":    {"zones": zones, "message": alert_msg, "severity": severity},
    }

    return {
        "evacuation_zones": zones,
        "alert_message":    alert_msg,
        "chain_of_thought": chain_of_thought,
        "is_resolved":      True,
        "agent_log":        state.get("agent_log", []) + [log],
    }
