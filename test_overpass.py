import httpx
import asyncio
import json

async def test_overpass():
    lat = 13.0600 # Approx coordinates near Sahakara Nagar, Bangalore
    lon = 77.5900
    radius_m = 5000

    queries = [
        f'node["amenity"="police"](around:{radius_m},{lat},{lon});way["amenity"="police"](around:{radius_m},{lat},{lon});',
        f'node["amenity"="fire_station"](around:{radius_m},{lat},{lon});way["amenity"="fire_station"](around:{radius_m},{lat},{lon});',
        f'node["amenity"="hospital"](around:{radius_m},{lat},{lon});way["amenity"="hospital"](around:{radius_m},{lat},{lon});'
    ]
    query = f"[out:json][timeout:15];({''.join(queries)});out center body;"
    print("Executing query:", query)

    endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
        "https://z.overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]

    for url in endpoints:
        print(f"Testing {url} ...")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, data={"data": query})
                print("  Status code:", resp.status_code)
                if resp.status_code == 200:
                    data = resp.json()
                    print("  Number of elements:", len(data.get("elements", [])))
                    if len(data.get("elements", [])) > 0:
                        break
                else:
                    print(f"  Raw response [{resp.status_code}]:", resp.text[:100])
        except Exception as e:
            print("  Failed:", type(e).__name__, e)

asyncio.run(test_overpass())
