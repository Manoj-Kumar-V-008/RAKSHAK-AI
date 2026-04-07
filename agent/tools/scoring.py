import math

# ── Crisis type → service type weight mapping ─────────────────────────────────
TYPE_WEIGHTS: dict[str, dict[str, int]] = {
    "smoke":    {"fire_station": 20, "hospital": 10, "police": 5},
    "fire":     {"fire_station": 20, "hospital": 10, "police": 5},
    "health":   {"hospital": 20, "fire_station": 5,  "police": 5},
    "cardiac":  {"hospital": 20, "fire_station": 5,  "police": 5},
    "security": {"police": 20, "fire_station": 5,    "hospital": 5},
    "breach":   {"police": 20, "fire_station": 5,    "hospital": 5},
    "power":    {"fire_station": 20, "police": 10,   "hospital": 5},
    "water":    {"fire_station": 20, "police": 10,   "hospital": 5},
}

# ── Casualty factor per crisis type ───────────────────────────────────────────
CASUALTY_FACTORS: dict[str, float] = {
    "cardiac": 100, "health": 85, "fire": 80, "smoke": 70,
    "breach": 65, "security": 60, "water": 55, "power": 40,
}


def compute_cascade_risk(severity: int, crisis_type: str) -> float:
    """
    P(cascade) = 1 - e^(-λ)  where λ = severity / 50
    A severity-8 fire gives ~85% cascade probability.
    """
    lambda_val = severity / 50.0
    return round(1 - math.exp(-lambda_val), 3)


def compute_threat_score(
    sensor_value: float,
    crisis_type: str,
    available_services_ratio: float,
    cascade_risk: float,
) -> tuple[float, str]:
    """
    ThreatScore = (SensorAnomaly   × 0.35)
                + (CasualtyFactor  × 0.25)
                + (ProximityFactor × 0.20)
                + (CascadeRisk     × 0.15)
                + (ResourceDepl.   × 0.05)

    Returns (score 0-100, level GREEN/YELLOW/ORANGE/RED/CRITICAL)
    """
    sensor_score  = min(max(sensor_value, 0), 100)
    casualty      = CASUALTY_FACTORS.get(crisis_type, 50)
    proximity     = (1.0 - available_services_ratio) * 100
    cascade       = cascade_risk * 100
    resource_depl = (1.0 - available_services_ratio) * 100

    score = (
        sensor_score  * 0.35
        + casualty    * 0.25
        + proximity   * 0.20
        + cascade     * 0.15
        + resource_depl * 0.05
    )
    score = round(score, 1)

    if score <= 30:
        level = "GREEN"
    elif score <= 55:
        level = "YELLOW"
    elif score <= 75:
        level = "ORANGE"
    elif score <= 90:
        level = "RED"
    else:
        level = "CRITICAL"

    return score, level


def score_service(service: dict, crisis_type: str, traffic_info: dict) -> dict:
    """
    Score a single service on 4 factors (max 100 pts):
      Distance     30 pts  →  30 - dist_km * 6   (min 0)
      Traffic      25 pts  →  25 × (1 - congestion_ratio)
      Availability 25 pts  →  open=25, unknown=12, closed=0
      Type Match   20 pts  →  from TYPE_WEIGHTS table
    """
    dist_km = max(service.get("distance_km", 5.0), 0.0)
    distance_score = max(0.0, 30.0 - dist_km * 6.0)

    congestion     = traffic_info.get("congestion_ratio", 0.4)
    traffic_score  = 25.0 * (1.0 - congestion)

    is_open = service.get("is_open")
    if is_open is True:
        avail_score = 25.0
    elif is_open is False:
        avail_score = 0.0
    else:
        avail_score = 12.0   # unknown

    svc_type   = service.get("service_type", "")
    weights    = TYPE_WEIGHTS.get(crisis_type, {})
    type_score = float(weights.get(svc_type, 0))

    total = distance_score + traffic_score + avail_score + type_score

    return {
        **service,
        "scores": {
            "distance":     round(distance_score, 1),
            "traffic":      round(traffic_score,  1),
            "availability": round(avail_score,    1),
            "type_match":   round(type_score,     1),
            "total":        round(total,           1),
        },
    }
