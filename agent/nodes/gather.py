"""
Node 2 — gather_intel
Fetches real nearby services from Overpass API + traffic from TomTom.
"""
import asyncio

from ..state import CrisisState
from ..tools.overpass import fetch_nearby_services
from ..tools.traffic import fetch_traffic


async def gather_intel(state: CrisisState) -> dict:
    lat         = state.get("venue_lat", 12.9716)
    lon         = state.get("venue_lon", 77.5946)
    crisis_type = state["crisis_type"]

    # 1. Fetch real services from OpenStreetMap
    services = await fetch_nearby_services(lat, lon, crisis_type)

    # 2. Fetch traffic for top-10 services in parallel
    top10       = services[:10]
    traffic_data: dict[str, dict] = {}

    async def _get_traffic(svc: dict) -> None:
        info = await fetch_traffic(lat, lon, svc["lat"], svc["lon"])
        traffic_data[svc["id"]] = info

    await asyncio.gather(*[_get_traffic(s) for s in top10], return_exceptions=True)

    log = {
        "node":    "gather_intel",
        "summary": f"Found {len(services)} nearby emergency services. Traffic checked for {len(traffic_data)}.",
        "data":    {"services_found": len(services), "traffic_checked": len(traffic_data)},
    }

    return {
        "nearby_services": services,
        "traffic_data":    traffic_data,
        "agent_log":       state.get("agent_log", []) + [log],
    }
