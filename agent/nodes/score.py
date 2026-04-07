from ..state import CrisisState
from ..tools.scoring import score_service, compute_threat_score, compute_cascade_risk


def score_services(state: CrisisState) -> dict:
    """
    Node 3 — SCORE: Evaluates nearby services using the 4-factor scoring
    algorithm and refines the overall threat assessment.
    """
    nearby = state.get("nearby_services", [])
    crisis_type = state.get("crisis_type", "smoke")
    severity = state.get("severity", 5)
    traffic_info = state.get("traffic_info", {})
    sensor = state.get("sensor_data", {})

    chain_of_thought = state.get("chain_of_thought", [])

    chain_of_thought.append({
        "node": "score_services",
        "text": f"Applying 4-factor scoring: Distance (30pts) × Traffic (25pts) × Availability (25pts) × Type Match (20pts). Evaluating {len(nearby)} services.",
        "factors": ["Distance: 30 - (km × 6)", "Traffic: 25 × (1 - congestion)", "Availability: 25/12/0", "Type match: 0-20 from weights table"],
    })

    # Score each service
    scored = []
    for svc in nearby:
        svc_traffic = traffic_info.get(svc.get("id", ""), {"congestion_ratio": 0.4})
        scored_svc = score_service(svc, crisis_type, svc_traffic)
        scored.append(scored_svc)

    # Sort by total score descending
    scored.sort(key=lambda s: s.get("scores", {}).get("total", 0), reverse=True)

    # Compute threat metrics
    available_ratio = min(len(scored) / 10, 1.0) if scored else 0
    cascade_risk = compute_cascade_risk(severity, crisis_type)
    sensor_value = sensor.get("value", 50)
    threat_score, threat_level = compute_threat_score(
        sensor_value, crisis_type, available_ratio, cascade_risk
    )

    # Add top-3 to chain of thought
    if scored:
        top3_text = "; ".join(
            f"{s.get('name', '?')} ({s.get('service_type', '?')}, {s.get('scores', {}).get('total', 0)}pts, {s.get('distance_km', '?')}km)"
            for s in scored[:3]
        )
        chain_of_thought.append({
            "node": "score_services",
            "text": f"Top 3 services: {top3_text}",
            "factors": [f"#{i+1}: {s.get('name', '?')} — {s.get('scores', {}).get('total', 0)}pts" for i, s in enumerate(scored[:3])],
            "score": scored[0].get("scores", {}).get("total", 0) if scored else 0,
        })

    chain_of_thought.append({
        "node": "score_services",
        "text": f"Threat assessment refined: Score {threat_score}/100 ({threat_level}). Cascade risk: {cascade_risk*100:.1f}%. Service availability: {available_ratio*100:.0f}%.",
        "factors": [f"Threat: {threat_score}/100", f"Level: {threat_level}", f"Cascade: {cascade_risk*100:.1f}%"],
    })

    return {
        "scored_services": scored,
        "threat_score": threat_score,
        "threat_level": threat_level,
        "cascade_risk": cascade_risk,
        "refined_threat_score": threat_score,
        "chain_of_thought": chain_of_thought,
    }
