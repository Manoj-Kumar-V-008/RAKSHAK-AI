import math
import httpx

# ── Crisis type → OSM amenity mapping ────────────────────────────────────────
CRISIS_AMENITIES: dict[str, list[str]] = {
    "smoke":    ["fire_station", "hospital", "police"],
    "fire":     ["fire_station", "hospital", "police"],
    "health":   ["hospital", "fire_station", "police"],
    "cardiac":  ["hospital", "police"],
    "security": ["police", "fire_station", "hospital"],
    "breach":   ["police", "hospital"],
    "power":    ["fire_station", "police"],
    "water":    ["fire_station", "police"],
}

AMENITY_TO_TYPE: dict[str, str] = {
    "hospital":     "hospital",
    "fire_station": "fire_station",
    "police":       "police",
    "clinic":       "hospital",
    "doctors":      "hospital",
}


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


async def fetch_nearby_services(lat: float, lon: float, crisis_type: str, radius_m: int = 8000, frontend_services: list = None) -> list[dict]:
    """Query OpenStreetMap Overpass API for real nearby emergency services."""
    amenities = CRISIS_AMENITIES.get(crisis_type, ["hospital", "fire_station", "police"])

    if frontend_services:
        filtered = []
        for s in frontend_services:
            svc_type = AMENITY_TO_TYPE.get(s.get("type", ""), s.get("type", ""))
            if svc_type in amenities:
                normalized = dict(s)
                normalized["service_type"] = svc_type
                normalized["distance_km"] = s.get("distance_km", s.get("distance", 5.0))
                normalized["id"] = str(s.get("id"))
                normalized["lon"] = s.get("lon", s.get("lng"))
                filtered.append(normalized)
        
        filtered.sort(key=lambda x: x.get("distance_km", 999))
        
        # Ensure diversity in the top results
        diverse_services = []
        counts = {}
        for s in filtered:
            t = s["service_type"]
            if counts.get(t, 0) < 5:
                diverse_services.append(s)
                counts[t] = counts.get(t, 0) + 1
                
        for s in filtered:
            if len(diverse_services) >= 15:
                break
            if s not in diverse_services:
                diverse_services.append(s)
                
        diverse_services.sort(key=lambda x: x.get("distance_km", 999))
        return diverse_services[:15]

    amenity_filter = "|".join(amenities)

    query = f"""
[out:json][timeout:20];
(
  node["amenity"~"{amenity_filter}"](around:{radius_m},{lat},{lon});
  way["amenity"~"{amenity_filter}"](around:{radius_m},{lat},{lon});
);
out center;
"""
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post("https://overpass-api.de/api/interpreter", data={"data": query})
            resp.raise_for_status()
            elements = resp.json().get("elements", [])

        services = []
        for el in elements:
            el_lat = el.get("lat") or (el.get("center") or {}).get("lat")
            el_lon = el.get("lon") or (el.get("center") or {}).get("lon")
            if not el_lat or not el_lon:
                continue
            tags    = el.get("tags", {})
            amenity = tags.get("amenity", "")
            name    = tags.get("name") or tags.get("name:en") or f"Emergency {amenity.replace('_', ' ').title()}"
            dist    = _haversine(lat, lon, el_lat, el_lon)

            # Emergency services (fire/police) are always open
            is_open = True if amenity in ("fire_station", "police") else None

            services.append({
                "id":           str(el.get("id")),
                "name":         name,
                "service_type": AMENITY_TO_TYPE.get(amenity, amenity),
                "lat":          el_lat,
                "lon":          el_lon,
                "distance_km":  round(dist, 2),
                "is_open":      is_open,
                "phone":        tags.get("phone") or tags.get("contact:phone"),
                "address":      tags.get("addr:street", ""),
            })

        services.sort(key=lambda x: x["distance_km"])
        
        # Ensure diversity in the top results
        diverse_services = []
        counts = {}
        # First pass: try to get up to 5 of each requested type
        for s in services:
            t = s["service_type"]
            if counts.get(t, 0) < 5:
                diverse_services.append(s)
                counts[t] = counts.get(t, 0) + 1
                
        # Fill the rest up to 15 total if we need more
        for s in services:
            if len(diverse_services) >= 15:
                break
            if s not in diverse_services:
                diverse_services.append(s)

        diverse_services.sort(key=lambda x: x["distance_km"])
        return diverse_services[:15]

    except Exception:
        return _synthetic_fallback(lat, lon, crisis_type)


def _synthetic_fallback(lat: float, lon: float, crisis_type: str) -> list[dict]:
    """Realistic synthetic services when Overpass is unavailable."""
    amenities = CRISIS_AMENITIES.get(crisis_type, ["hospital", "fire_station", "police"])
    names = {
        "hospital":     ["City General Hospital", "Apollo Medical Center", "District Hospital"],
        "fire_station": ["Central Fire Station", "Zone-2 Fire Brigade", "Emergency Fire Unit"],
        "police":       ["City Police HQ", "Sector Police Station", "Armed Response Unit"],
    }
    services = []
    for i, amenity in enumerate((amenities * 4)[:10]):
        angle  = i * 0.7
        radius = 0.01 * (i + 1)
        s_lat  = lat + radius * math.cos(angle)
        s_lon  = lon + radius * math.sin(angle)
        dist   = _haversine(lat, lon, s_lat, s_lon)
        pool   = names.get(amenity, ["Emergency Unit"])
        services.append({
            "id":           f"syn-{i}",
            "name":         pool[i % len(pool)],
            "service_type": AMENITY_TO_TYPE.get(amenity, amenity),
            "lat":          s_lat,
            "lon":          s_lon,
            "distance_km":  round(dist, 2),
            "is_open":      True,
            "phone":        None,
            "address":      "Synthetic data",
        })
    services.sort(key=lambda x: x["distance_km"])
    return services
