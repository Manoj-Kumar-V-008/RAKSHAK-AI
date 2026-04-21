from ..state import CrisisState
from ..tools.overpass import fetch_nearby_services
from ..tools.traffic import fetch_traffic


async def gather_intel(state: CrisisState) -> dict:
    """
    Node 2 — GATHER: Fetches real nearby services from OpenStreetMap
    and live traffic data from TomTom.
    """
    lat = state.get("venue_lat", 12.9716)
    lon = state.get("venue_lon", 77.5946)
    crisis_type = state.get("crisis_type", "smoke")

    chain_of_thought = state.get("chain_of_thought", [])
    frontend_services = state.get("frontend_services", [])

    if frontend_services:
        chain_of_thought.append({
            "node": "gather_intel",
            "text": f"Using {len(frontend_services)} emergency services synced from command center map.",
            "factors": ["Frontend map data sync", "Pre-validated services"],
        })
        nearby = await fetch_nearby_services(lat, lon, crisis_type, frontend_services=frontend_services)
    else:
        # Add reasoning step
        chain_of_thought.append({
            "node": "gather_intel",
            "text": f"Querying OpenStreetMap Overpass API for emergency services within 8km of ({lat:.4f}°N, {lon:.4f}°E). Crisis type: {crisis_type.upper()}.",
            "factors": ["Real-world service discovery", "Overpass API query", f"Radius: 8km"],
        })

        # Fetch nearby services
        nearby = await fetch_nearby_services(lat, lon, crisis_type)

    chain_of_thought.append({
        "node": "gather_intel",
        "text": f"Found {len(nearby)} emergency services. Checking TomTom real-time traffic conditions for route analysis.",
        "factors": [f"{len(nearby)} services found", "Traffic API integration", "Route optimization"],
    })

    # Fetch traffic for the closest 5 services
    traffic_info = {}
    for svc in nearby[:5]:
        svc_lat = svc.get("lat", lat)
        svc_lon = svc.get("lon", lon)
        traf = await fetch_traffic(lat, lon, svc_lat, svc_lon)
        traffic_info[svc.get("id", "")] = traf

    chain_of_thought.append({
        "node": "gather_intel",
        "text": f"Intel gathering complete. {len(nearby)} services located, traffic analyzed for top {min(len(nearby), 5)} routes.",
        "factors": [f"Services: {len(nearby)}", f"Traffic routes: {len(traffic_info)}", "Data ready for scoring"],
    })

    log = {
        "node": "gather_intel",
        "summary": f"Located {len(nearby)} services and analyzed {len(traffic_info)} traffic routes.",
        "data": {
            "services_found": len(nearby),
            "traffic_checked": len(traffic_info),
        },
    }

    return {
        "nearby_services": nearby,
        "traffic_info": traffic_info,
        "chain_of_thought": chain_of_thought,
        "agent_log": state.get("agent_log", []) + [log],
    }
