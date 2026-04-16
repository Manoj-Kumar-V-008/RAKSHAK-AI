import math
import os
import httpx

TOMTOM_KEY = os.getenv("TOMTOM_API_KEY", "")


async def fetch_traffic(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
) -> dict:
    """
    Get congestion data via TomTom Routing API.
    Falls back to mathematically-derived estimate on failure.
    """
    if TOMTOM_KEY:
        try:
            url = (
                f"https://api.tomtom.com/routing/1/calculateRoute/"
                f"{origin_lat},{origin_lon}:{dest_lat},{dest_lon}/json"
            )
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, params={"key": TOMTOM_KEY, "traffic": "true", "travelMode": "car"})
                resp.raise_for_status()
                summary = resp.json()["routes"][0]["summary"]

            travel_time   = summary["travelTimeInSeconds"]
            no_traffic    = summary.get("noTrafficTravelTimeInSeconds", travel_time)
            delay         = max(travel_time - no_traffic, 0)
            congestion    = min(delay / max(no_traffic, 1), 1.0)

            return {
                "congestion_ratio": round(congestion, 3),
                "delay_minutes":    round(delay / 60, 1),
                "travel_time_s":    travel_time,
            }
        except Exception:
            pass

    # ── Intelligent fallback using straight-line distance ─────────────────────
    dist_km       = _haversine(origin_lat, origin_lon, dest_lat, dest_lon)
    congestion    = min(dist_km * 0.04, 0.75)           # closer = less congestion
    travel_time_s = int(dist_km * 90 * (1 + congestion))

    return {
        "congestion_ratio": round(congestion, 3),
        "delay_minutes":    round((travel_time_s - dist_km * 90) / 60, 1),
        "travel_time_s":    travel_time_s,
    }


def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))
