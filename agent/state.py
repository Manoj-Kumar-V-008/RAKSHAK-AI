from typing import TypedDict, Optional


class CrisisState(TypedDict):
    # ── Input ──────────────────────────────────────
    session_id: str
    sensor_data: dict
    venue_lat: float
    venue_lon: float

    # ── Detection ──────────────────────────────────
    crisis_type: str
    severity: int          # 1-10
    location_name: str

    # ── Threat Math ────────────────────────────────
    threat_score: float    # 0-100
    threat_level: str      # GREEN / YELLOW / ORANGE / RED / CRITICAL
    cascade_risk: float    # 0-1

    # ── Intel ──────────────────────────────────────
    nearby_services: list
    traffic_data: dict     # service_id -> {congestion_ratio, delay_minutes}

    # ── Scoring ────────────────────────────────────
    scored_services: list  # sorted by total score desc

    # ── Decision ───────────────────────────────────
    best_service: Optional[dict]
    dispatched_services: list[dict]
    dispatch_reasoning: str
    dispatch_status: str   # pending / dispatched / failed

    # ── Alert ──────────────────────────────────────
    evacuation_zones: list
    alert_message: str

    # ── Meta ───────────────────────────────────────
    agent_log: list        # [{node, summary, data}]
    is_resolved: bool
