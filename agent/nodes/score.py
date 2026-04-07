"""
Node 3 — score_services
Applies the 4-factor points system and refines the threat score.
"""
from ..state import CrisisState
from ..tools.scoring import score_service, compute_threat_score


async def score_services(state: CrisisState) -> dict:
    services    = state.get("nearby_services", [])
    traffic_d   = state.get("traffic_data", {})
    crisis_type = state["crisis_type"]
    sensor      = state["sensor_data"]

    # Score every service
    scored = []
    for svc in services:
        traffic_info = traffic_d.get(svc["id"], {"congestion_ratio": 0.4})
        scored.append(score_service(svc, crisis_type, traffic_info))

    scored.sort(key=lambda x: x["scores"]["total"], reverse=True)

    # Refine threat score now that we know real service availability
    available = sum(1 for s in services if s.get("is_open") is not False)
    avail_ratio = available / len(services) if services else 0.5

    anomaly_score = float(sensor.get("value", 80))
    threat_score, threat_level = compute_threat_score(
        sensor_value=anomaly_score,
        crisis_type=crisis_type,
        available_services_ratio=avail_ratio,
        cascade_risk=state.get("cascade_risk", 0.3),
    )

    best_name  = scored[0]["name"] if scored else "N/A"
    best_total = scored[0]["scores"]["total"] if scored else 0

    log = {
        "node":    "score_services",
        "summary": f"Scored {len(scored)} services. Best: {best_name} ({best_total} pts). Refined ThreatScore: {threat_score} ({threat_level})",
        "data": {
            "scores": [
                {
                    "name":      s["name"],
                    "type":      s["service_type"],
                    "total":     s["scores"]["total"],
                    "distance":  s["scores"]["distance"],
                    "traffic":   s["scores"]["traffic"],
                    "avail":     s["scores"]["availability"],
                    "type_match": s["scores"]["type_match"],
                    "dist_km":   s["distance_km"],
                    "lat":       s["lat"],
                    "lon":       s["lon"],
                }
                for s in scored[:6]
            ]
        },
    }

    return {
        "scored_services": scored,
        "threat_score":    threat_score,
        "threat_level":    threat_level,
        "agent_log":       state.get("agent_log", []) + [log],
    }
