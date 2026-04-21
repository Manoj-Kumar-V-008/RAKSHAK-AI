from typing import TypedDict


class CrisisState(TypedDict, total=False):
    """Shared state for the LangGraph crisis-response pipeline."""

    # ── Raw sensor input ──
    sensor_data: dict
    venue_lat: float
    venue_lon: float
    session_id: str
    location_name: str

    # ── Detection ──
    crisis_type: str          # e.g. "smoke", "health", "security"
    severity: int             # 1-10
    gemini_analysis: str      # raw model response text (legacy field name)
    chain_of_thought: list    # NEW: step-by-step reasoning from each node

    # ── Threat math ──
    threat_score: float       # 0-100
    threat_level: str         # GREEN / YELLOW / ORANGE / RED / CRITICAL
    cascade_risk: float       # 0.0 - 1.0

    # ── Intel ──
    frontend_services: list   # NEW: passed from frontend
    nearby_services: list     # raw Overpass results
    traffic_info: dict        # TomTom traffic summary

    # ── Scoring ──
    scored_services: list     # services with points breakdown
    refined_threat_score: float

    # ── Decision ──
    best_service: dict | None
    dispatched_services: list # selected services to dispatch
    dispatch_reasoning: str   # reasoning for dispatch decision
    dispatch_status: str
    rejected_services: list   # NEW: services rejected + reasons

    # ── Human-in-the-loop ──
    confirmation_required: bool  # NEW: whether to pause for operator approval
    confirmation_status: str     # NEW: "pending" | "approved" | "rejected"

    # ── Alerting ──
    evacuation_zones: list
    alert_message: str
    emergency_contacts: list  # NEW: [{name, phone}]
    sms_results: list         # NEW: SMS delivery results
    call_results: list        # NEW: voice call results
    agent_log: list
    is_resolved: bool
