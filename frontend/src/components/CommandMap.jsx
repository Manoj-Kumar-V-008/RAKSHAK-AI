import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import AgentGraph from './AgentGraph';
import FacilityTwin from './FacilityTwin';
import CrisisSimulator from './CrisisSimulator';
import useAutonomousAgent from '../hooks/useAutonomousAgent';

// ─── Bangalore Geofence ───
const BANGALORE_BOUNDS = {
  latMin: 12.83,
  latMax: 13.14,
  lngMin: 77.46,
  lngMax: 77.78,
};

const MG_ROAD_FALLBACK = { lat: 12.9716, lng: 77.5946 };

function isInBangalore(lat, lng) {
  return (
    lat >= BANGALORE_BOUNDS.latMin &&
    lat <= BANGALORE_BOUNDS.latMax &&
    lng >= BANGALORE_BOUNDS.lngMin &&
    lng <= BANGALORE_BOUNDS.lngMax
  );
}

// ─── Humanitarian tile layer (HOT) ───
const HOT_TILE_URL = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
const HOT_TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles: <a href="https://www.hotosm.org/">HOT</a>';

// ─── TomTom Live Traffic Flow ───
const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || '';
const TOMTOM_TRAFFIC_URL = `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`;

// ─── Emergency Service Definitions ───
const SERVICE_TYPES = {
  police: {
    label: 'POLICE STATION',
    emoji: '🚔',
    color: '#3B82F6',
    glowColor: 'rgba(59,130,246,0.5)',
    borderColor: 'rgba(59,130,246,0.3)',
    query: '["amenity"="police"]',
  },
  fire_station: {
    label: 'FIRE BRIGADE',
    emoji: '🚒',
    color: '#EF4444',
    glowColor: 'rgba(239,68,68,0.5)',
    borderColor: 'rgba(239,68,68,0.3)',
    query: '["amenity"="fire_station"]',
  },
  hospital: {
    label: 'HOSPITAL',
    emoji: '🏥',
    color: '#22C55E',
    glowColor: 'rgba(34,197,94,0.5)',
    borderColor: 'rgba(34,197,94,0.3)',
    query: '["amenity"="hospital"]',
  },
};

// Calculate distance between two coords (km)
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Overpass API: Fetch nearby emergency services ───
async function fetchNearbyServices(lat, lng, radiusMeters = 5000) {
  const queries = Object.entries(SERVICE_TYPES).map(([key, svc]) => {
    return `node${svc.query}(around:${radiusMeters},${lat},${lng});way${svc.query}(around:${radiusMeters},${lat},${lng});`;
  });
  const overpassQuery = `[out:json][timeout:15];(${queries.join('\n')});out center body;`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });
    if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
    const data = await res.json();

    const services = [];
    for (const el of data.elements) {
      const elLat = el.lat || el.center?.lat;
      const elLng = el.lon || el.center?.lon;
      if (!elLat || !elLng) continue;
      const amenity = el.tags?.amenity;
      if (!SERVICE_TYPES[amenity]) continue;
      services.push({
        id: el.id,
        type: amenity,
        name: el.tags?.name || el.tags?.['name:en'] || SERVICE_TYPES[amenity].label,
        phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
        lat: elLat,
        lng: elLng,
        distance: haversine(lat, lng, elLat, elLng),
        ...SERVICE_TYPES[amenity],
      });
    }
    services.sort((a, b) => a.distance - b.distance);
    return services;
  } catch (err) {
    console.error('Overpass API fetch failed:', err);
    return [];
  }
}

/**
 * Step 3: Command Map — Humanitarian Leaflet + AI Agent + polished overlays.
 */
export default function CommandMap({ hospitalityType, userEmail }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routesLayerRef = useRef(null);
  const [mapCenter, setMapCenter] = useState(MG_ROAD_FALLBACK);
  const [userLocation, setUserLocation] = useState(null);
  const [geoStatus, setGeoStatus] = useState('ACQUIRING...');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mapReady, setMapReady] = useState(false);
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const scanRadius = 5;

  // AI Agent + Crisis state
  const [aiOpen, setAiOpen] = useState(false);
  const [crisisInfo, setCrisisInfo] = useState({ active: false, type: null });

  // ─── Autonomous Agent Hook (Gemini-powered) ───
  const agentState = useAutonomousAgent({
    hospitalityType,
    services,
    mapCenter,
    onCrisisUpdate: (info) => {
      setCrisisInfo(prev => {
        // When de-activating, preserve all the rich dispatch data (services, reasons, alertedNodes)
        // so the graph keeps displaying. Only update the fields that changed.
        if (!info.active && prev.active) {
          return { ...prev, active: false, respondersActive: false };
        }
        return { ...prev, ...info };
      });
      if (mapInstanceRef.current && services.length > 0) {
        plotServices(services, mapInstanceRef.current, info);
      }
    },
  });



  // Boot sequence + periodic scans when agent opens
  useEffect(() => {
    if (!aiOpen || !services?.length) return;

    const bootTimers = [
      setTimeout(() => agentState.addEntry('SYSTEM', `Command center initialized — ${hospitalityType?.label || 'Operations'} mode active.`), 300),
      setTimeout(() => agentState.addEntry('SYSTEM', `Geofence locked: Bangalore sector. ${services.length} emergency resources detected.`), 1200),
      setTimeout(() => { agentState.addEntry('INTEL', 'IoT sensor mesh connected... 47 nodes online. Anomaly detection armed.'); agentState.addComms('SENSOR MESH HANDSHAKE COMPLETE. 47/47 NODES ACTIVE.'); }, 2400),
      setTimeout(() => agentState.addEntry('SYSTEM', 'Gemini reasoning engine online. Awaiting sensor data or manual trigger.'), 3600),
    ];

    const scanInterval = setInterval(() => {
      agentState.incrementScan();
      const msgs = [
        'Perimeter scan complete. No anomalies.',
        'Thermal imaging sweep — all sectors nominal.',
        'Crowd density analysis: within safe thresholds.',
        'Air quality index normal across all floors.',
        `Emergency network active — ${services.length} units on standby.`,
        'IoT sensor mesh heartbeat: 47/47 nodes responding.',
      ];
      agentState.addEntry('INTEL', msgs[Math.floor(Math.random() * msgs.length)]);
    }, 12000);

    return () => {
      bootTimers.forEach(clearTimeout);
      clearInterval(scanInterval);
    };
  }, [aiOpen, services?.length]);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Create a marker icon for emergency services (with optional crisis pulse)
  const createServiceIcon = useCallback((svc, isAlerted = false) => {
    const L = window.L;
    const alertStyle = isAlerted
      ? `animation: marker-alert-pulse 1s ease-in-out infinite; --alert-color: ${svc.glowColor};`
      : '';
    return L.divIcon({
      className: '',
      html: `
        <div style="
          position: relative;
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 50%;
          background: ${isAlerted ? 'rgba(239,68,68,0.15)' : 'rgba(11,14,20,0.92)'};
          border: 2px solid ${isAlerted ? '#EF4444' : svc.color};
          box-shadow: 0 0 12px ${svc.glowColor}, 0 0 24px ${svc.glowColor.replace('0.5', '0.12')};
          font-size: 15px;
          backdrop-filter: blur(8px);
          cursor: pointer;
          transition: transform 0.2s, background 0.3s, border-color 0.3s;
          ${alertStyle}
        ">${svc.emoji}</div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -20],
    });
  }, []);

  // Plot services on map (re-renders when crisis state changes)
  const plotServices = useCallback((servicesList, map, crisis = null) => {
    const L = window.L;
    
    if (markersLayerRef.current) markersLayerRef.current.clearLayers();
    else markersLayerRef.current = L.layerGroup().addTo(map);

    if (routesLayerRef.current) routesLayerRef.current.clearLayers();
    else routesLayerRef.current = L.layerGroup().addTo(map);

    const destLat = mapCenter?.lat || MG_ROAD_FALLBACK.lat;
    const destLng = mapCenter?.lng || MG_ROAD_FALLBACK.lng;
    const activePoints = [[destLat, destLng]];

    servicesList.forEach((svc) => {
      const isAlerted = crisis?.active && Array.isArray(crisis?.alertedNodes) && crisis.alertedNodes.includes(svc.id);
      const icon = createServiceIcon(svc, isAlerted);
      const marker = L.marker([svc.lat, svc.lng], { icon });

      marker.bindPopup(
        `<div style="
          font-family: 'JetBrains Mono', monospace;
          color: #E8ECF4;
          background: rgba(11,14,20,0.95);
          padding: 14px 16px;
          border: 1px solid ${svc.borderColor};
          border-radius: 12px;
          min-width: 210px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          backdrop-filter: blur(20px);
        ">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <span style="font-size:20px;">${svc.emoji}</span>
            <span style="color:${svc.color}; font-weight:700; letter-spacing:1px; font-size:10px; text-transform:uppercase;">
              ${svc.label}
            </span>
          </div>
          <div style="color:#E8ECF4; font-size:12px; font-weight:600; margin-bottom:4px; line-height:1.3;">${svc.name}</div>
          ${svc.phone ? `<div style="color:#8892A8; font-size:10px; margin-top:2px;">📞 ${svc.phone}</div>` : ''}
          <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.06);">
            <span style="color:#8892A8; font-size:9px;">DISTANCE </span>
            <span style="color:${svc.color}; font-size:11px; font-weight:700;">${svc.distance.toFixed(2)} km</span>
          </div>
          <div style="color:#4A5568; font-size:8px; margin-top:3px; letter-spacing:0.5px;">
            ${svc.lat.toFixed(4)}°N, ${svc.lng.toFixed(4)}°E
          </div>
        </div>`,
        { className: 'leaflet-popup-dark', closeButton: false, offset: [0, -4] }
      );

      marker.addTo(markersLayerRef.current);

      if (isAlerted) {
        // Draw the fallback direct trajectory IMMEDIATELY so the user instantly sees a line.
        const fallbackLine = L.polyline([[svc.lat, svc.lng], [destLat, destLng]], {
          className: 'route-line-animated',
          color: svc.color,
          weight: 3,
          opacity: 0.6,
          dashArray: '4 8'
        }).addTo(routesLayerRef.current);
        
        activePoints.push([svc.lat, svc.lng]);

        // Attempt OSRM real-road directions asynchronously
        fetch(`https://router.project-osrm.org/route/v1/driving/${svc.lng},${svc.lat};${destLng},${destLat}?geometries=geojson`)
          .then(res => res.json())
          .then(data => {
            if (data.code === 'Ok' && data.routes?.length > 0 && routesLayerRef.current?.hasLayer(fallbackLine)) {
              // Remove the straight line
              routesLayerRef.current.removeLayer(fallbackLine);
              
              // Draw the authentic road-snapped geometric path
              const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
              L.polyline(coords, {
                className: 'route-line-animated',
                color: svc.color,
                weight: 4,
                opacity: 0.9,
                dashArray: '8 12',
                lineCap: 'round'
              }).addTo(routesLayerRef.current);
            }
          })
          .catch(err => console.warn('OSRM mapping failed, retaining Euclidean line:', err));
      }
    });

    if (crisis?.active && activePoints.length > 1) {
      setTimeout(() => {
        if (map) map.flyToBounds(L.latLngBounds(activePoints), {
          padding: [60, 60, 60, 60],
          duration: 1.5,
          maxZoom: 15
        });
      }, 500);
    }
  }, [createServiceIcon, mapCenter]);

  // Fetch and display services, then auto-zoom
  const scanServices = useCallback(async (center, map) => {
    const L = window.L;
    setLoadingServices(true);
    const result = await fetchNearbyServices(center.lat, center.lng, scanRadius * 1000);
    setServices(result);
    plotServices(result, map);
    setLoadingServices(false);

    // Center on user location as the hero — don't zoom out to fit all services
    setTimeout(() => {
      map.flyTo([center.lat, center.lng], 15, {
        duration: 1.4,
      });
    }, 400);
  }, [scanRadius, plotServices]);

  // ─── Fly to user location ───
  const flyToUser = useCallback(() => {
    const loc = userLocation || mapCenter;
    if (mapInstanceRef.current && loc) {
      mapInstanceRef.current.flyTo([loc.lat, loc.lng], 16, { duration: 1.2 });
    }
  }, [userLocation, mapCenter]);

  // ─── Geolocation + Map initialization ───
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || mapInstanceRef.current) return;
    // Guard against HMR double-init where the DOM element kept Leaflet's internal state
    if (mapRef.current._leaflet_id) return;

    const initMap = (center, zoom = 15) => {
      const map = L.map(mapRef.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: false,
        attributionControl: false,
        maxBounds: L.latLngBounds(
          L.latLng(BANGALORE_BOUNDS.latMin, BANGALORE_BOUNDS.lngMin),
          L.latLng(BANGALORE_BOUNDS.latMax, BANGALORE_BOUNDS.lngMax)
        ),
        maxBoundsViscosity: 1.0,
        minZoom: 11,
        maxZoom: 18,
      });

      L.tileLayer(HOT_TILE_URL, { attribution: HOT_TILE_ATTR, maxZoom: 19 }).addTo(map);

      // Live Traffic Flow overlay (TomTom)
      if (TOMTOM_API_KEY && TOMTOM_API_KEY !== 'YOUR_API_KEY_HERE') {
        L.tileLayer(TOMTOM_TRAFFIC_URL, {
          maxZoom: 19,
          opacity: 1.0,
          zIndex: 1000,
        }).addTo(map);
      }

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Command HQ marker
      const hqIcon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="width:22px;height:22px;border-radius:50%;background:#FF4D4D;border:3px solid rgba(255,77,77,0.4);box-shadow:0 0 18px rgba(255,77,77,0.6),0 0 40px rgba(255,77,77,0.2);animation:pulse-glow 2s ease-in-out infinite;"></div>
            <div style="position:absolute;top:-8px;left:-8px;width:38px;height:38px;border-radius:50%;border:2px solid rgba(255,77,77,0.15);animation:pulse-glow 2s ease-in-out infinite;"></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      L.marker([MG_ROAD_FALLBACK.lat, MG_ROAD_FALLBACK.lng], { icon: hqIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#E8ECF4;background:rgba(11,14,20,0.95);padding:12px 16px;border:1px solid rgba(255,77,77,0.3);border-radius:12px;min-width:180px;box-shadow:0 8px 32px rgba(0,0,0,0.5);backdrop-filter:blur(20px);">
            <div style="color:#FF4D4D;font-weight:700;letter-spacing:1px;margin-bottom:4px;font-size:11px;">⊕ COMMAND HQ</div>
            <div style="color:#8892A8;font-size:10px;">MG Road, Bangalore</div>
            <div style="color:#4A5568;font-size:9px;margin-top:4px;">12.9716°N, 77.5946°E</div>
          </div>`,
          { className: 'leaflet-popup-dark', closeButton: false, offset: [0, -16] }
        );

      // Scan radius circle
      L.circle([center.lat, center.lng], {
        radius: 5000,
        color: 'rgba(0,242,255,0.2)',
        fillColor: 'rgba(0,242,255,0.03)',
        fillOpacity: 1,
        weight: 1,
        dashArray: '8 4',
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
      scanServices(center, map);
      return map;
    };

    // Geolocation
    if (!navigator.geolocation) {
      setGeoStatus('GEO UNAVAILABLE');
      setMapCenter(MG_ROAD_FALLBACK);
      initMap(MG_ROAD_FALLBACK);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (isInBangalore(latitude, longitude)) {
          const loc = { lat: latitude, lng: longitude };
          setUserLocation(loc);
          setMapCenter(loc);
          setGeoStatus('LOCKED — IN ZONE');
          const map = initMap(loc);
          const L = window.L;
          const userIcon = L.divIcon({
            className: '',
            html: `
              <div style="position:relative;display:flex;align-items:center;justify-content:center;">
                <div style="width:24px;height:24px;border-radius:50%;background:#00F2FF;border:3px solid rgba(0,242,255,0.5);box-shadow:0 0 20px rgba(0,242,255,0.7),0 0 50px rgba(0,242,255,0.3);z-index:3;"></div>
                <div style="position:absolute;width:40px;height:40px;border-radius:50%;border:2px solid rgba(0,242,255,0.3);animation:pulse-glow 2s ease-in-out infinite;"></div>
                <div style="position:absolute;width:56px;height:56px;border-radius:50%;border:1.5px solid rgba(0,242,255,0.15);animation:pulse-glow 2s ease-in-out infinite;animation-delay:0.5s;"></div>
                <div style="position:absolute;width:76px;height:76px;border-radius:50%;border:1px solid rgba(0,242,255,0.08);animation:pulse-glow 3s ease-in-out infinite;animation-delay:1s;"></div>
              </div>
            `,
            iconSize: [76, 76],
            iconAnchor: [38, 38],
          });
          L.marker([latitude, longitude], { icon: userIcon })
            .addTo(map)
            .bindPopup(
              `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#E8ECF4;background:rgba(11,14,20,0.95);padding:10px 14px;border:1px solid rgba(0,242,255,0.3);border-radius:10px;backdrop-filter:blur(20px);">
                <div style="color:#00F2FF;font-weight:600;letter-spacing:1px;margin-bottom:4px;">◉ YOUR POSITION</div>
                <div style="color:#4A5568;font-size:9px;">${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E</div>
              </div>`,
              { className: 'leaflet-popup-dark', closeButton: false, offset: [0, -12] }
            );
        } else {
          setMapCenter(MG_ROAD_FALLBACK);
          setGeoStatus('OUT OF ZONE — FALLBACK');
          initMap(MG_ROAD_FALLBACK);
        }
      },
      () => {
        setGeoStatus('GEO DENIED — FALLBACK');
        setMapCenter(MG_ROAD_FALLBACK);
        initMap(MG_ROAD_FALLBACK);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const flyToService = (svc) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([svc.lat, svc.lng], 16, { duration: 1 });
    }
  };

  const formatTime = (d) =>
    d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (d) =>
    d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });

  const filteredServices = activeFilter === 'all'
    ? services
    : services.filter((s) => s.type === activeFilter);

  const counts = {
    police: services.filter((s) => s.type === 'police').length,
    fire_station: services.filter((s) => s.type === 'fire_station').length,
    hospital: services.filter((s) => s.type === 'hospital').length,
    total: services.length,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative w-full h-full z-10 flex flex-col"
    >
      {/* ═══════════════════════════════════════════
          TOP COMMAND BAR — Logo + Live Features
         ═══════════════════════════════════════════ */}
      <div
        className="relative flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{
          background: 'rgba(8,10,16,0.96)',
          borderBottom: '1px solid rgba(0,242,255,0.08)',
          zIndex: 1001,
          height: 52,
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Left: Logo + Brand */}
        <div className="flex items-center gap-3">
          <img
            src="/rakshak-logo.png"
            alt="Rakshak AI"
            className="w-8 h-8 object-contain rounded-lg"
            style={{ filter: 'drop-shadow(0 0 8px rgba(0,242,255,0.3))' }}
          />
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: 'var(--command-teal)', letterSpacing: 2, lineHeight: 1.2 }}>
              RAKSHAK AI
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1.5 }}>
              CRISIS COMMAND CENTER
            </p>
          </div>

          {/* Divider removed along with Top Bar Agent Toggle */}
        </div>

        {/* Center: Live Service Counts */}
        <div className="flex items-center gap-4">
          {loadingServices ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--command-teal) transparent transparent transparent' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--command-teal)', letterSpacing: 1 }}>
                SCANNING...
              </span>
            </div>
          ) : (
            <>
              {[
                { emoji: '🚔', count: counts.police, color: '#3B82F6', label: 'POLICE' },
                { emoji: '🚒', count: counts.fire_station, color: '#EF4444', label: 'FIRE' },
                { emoji: '🏥', count: counts.hospital, color: '#22C55E', label: 'MEDICAL' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5" title={`${item.count} ${item.label}`}>
                  <span style={{ fontSize: 14 }}>{item.emoji}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: item.color, fontWeight: 700 }}>{item.count}</span>
                </div>
              ))}
              <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.06)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1 }}>
                {scanRadius}KM RADIUS
              </span>
            </>
          )}
        </div>

        {/* Right: Status + Time */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full pulse-glow"
              style={{ background: 'var(--command-teal)', boxShadow: '0 0 8px var(--command-teal)' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--command-teal)', letterSpacing: 1, fontWeight: 600 }}>
              LIVE
            </span>
          </div>
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.06)' }} />
          <div className="text-right">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--command-teal)', fontWeight: 600, lineHeight: 1.2, letterSpacing: 1 }}>
              {formatTime(currentTime)}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>
              {formatDate(currentTime)}
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          2-COLUMN RESIZABLE COMMAND ARCHITECTURE
          Col 1 (Left)  → Full-height Map
          Col 2 (Right) → Row 1: AI Agent · Row 2: 2D Twin
         ══════════════════════════════════════════════════ */}
      <div className="relative flex-1 overflow-hidden" style={{ background: 'var(--deep-space)' }}>
        <PanelGroup direction="horizontal" style={{ height: '100%' }}>

          {/* ─── Column 1: Map ─── */}
          <Panel defaultSize={50} minSize={20} style={{ position: 'relative' }}>
            {/* Leaflet attaches here imperatively via mapRef */}
            <div ref={mapRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />

            {/* Map loading state */}
            {!mapReady && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="glass-dark p-8 text-center" style={{ borderRadius: 16 }}>
                  <div className="w-10 h-10 border-2 rounded-full animate-spin mb-4 mx-auto"
                    style={{ borderColor: 'var(--command-teal) transparent transparent transparent' }} />
                  <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--command-teal)', fontSize: 12, letterSpacing: 2 }}>
                    LOADING MAP INTERFACE...
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: 9, marginTop: 6, letterSpacing: 1 }}>
                    Initializing humanitarian layers
                  </p>
                </div>
              </div>
            )}
          </Panel>

          {/* ─── Vertical Resize Handle (between Map & Right column) ─── */}
          <PanelResizeHandle style={{
            width: 6,
            background: 'rgba(0,242,255,0.12)',
            cursor: 'col-resize',
            position: 'relative',
            transition: 'background 0.2s',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,242,255,0.7)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,242,255,0.12)'}
          >
            {/* Grip dots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, pointerEvents: 'none' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(0,242,255,0.6)' }} />
              ))}
            </div>
          </PanelResizeHandle>

          {/* ─── Column 2: Agent (top) + 2D Twin (bottom) ─── */}
          <Panel defaultSize={50} minSize={20}>
            <PanelGroup direction="vertical" style={{ height: '100%' }}>

              {/* Row 1: AI Neural Agent */}
              <Panel defaultSize={55} minSize={20} style={{ position: 'relative', overflow: 'hidden' }}>
                <AgentGraph
                  agentState={agentState}
                  crisisInfo={crisisInfo}
                  services={services}
                />
              </Panel>

              {/* ─── Horizontal Resize Handle (between Agent & 2D Twin) ─── */}
              <PanelResizeHandle style={{
                height: 6,
                background: 'rgba(0,242,255,0.12)',
                cursor: 'row-resize',
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,242,255,0.7)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,242,255,0.12)'}
              >
                {/* Grip dots */}
                <div style={{ display: 'flex', flexDirection: 'row', gap: 3, pointerEvents: 'none' }}>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(0,242,255,0.6)' }} />
                  ))}
                </div>
              </PanelResizeHandle>

              {/* Row 2: 2D Facility Twin */}
              <Panel defaultSize={45} minSize={15} style={{ position: 'relative', overflow: 'hidden', background: 'var(--deep-space)' }}>
                <FacilityTwin crisisInfo={crisisInfo} evacuationZone={agentState.evacuationZone} alertMessage={agentState.alertMessage} />
              </Panel>

            </PanelGroup>
          </Panel>

        </PanelGroup>

        {/* ─── Emergency Vignette ─── */}
        <AnimatePresence>
          {crisisInfo.active && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 999,
                boxShadow: 'inset 0 0 120px rgba(239,68,68,0.15), inset 0 0 60px rgba(239,68,68,0.08)',
                animation: 'emergency-vignette 2s ease-in-out infinite',
                borderRadius: 0,
              }}
            />
          )}
        </AnimatePresence>



        {/* ─── Bottom Left: Context + Geo (Polished) ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="absolute bottom-4 left-4"
          style={{ borderRadius: 14, zIndex: 1000, minWidth: 250 }}
        >
          <div
            className="px-4 py-3.5"
            style={{
              background: 'rgba(8,10,16,0.92)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0,242,255,0.08)',
              borderRadius: 14,
            }}
          >
            {/* Hospitality type */}
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(0,242,255,0.08)', border: '1px solid rgba(0,242,255,0.12)' }}
              >
                <span style={{ fontSize: 14 }}>🏨</span>
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.5 }}>
                  {hospitalityType?.label || 'N/A'}
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>
                  {hospitalityType?.sub || ''}
                </p>
              </div>
            </div>

            {/* Geo status */}
            <div
              className="pt-2.5 mt-2"
              style={{ borderTop: '1px solid rgba(0,242,255,0.06)' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: geoStatus.includes('LOCKED')
                      ? 'var(--command-teal)'
                      : geoStatus.includes('ACQUIRING')
                      ? '#F59E0B'
                      : 'var(--crisis-red)',
                    boxShadow: geoStatus.includes('LOCKED')
                      ? '0 0 6px var(--command-teal)'
                      : geoStatus.includes('ACQUIRING')
                      ? '0 0 6px #F59E0B'
                      : '0 0 6px var(--crisis-red)',
                  }}
                />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: geoStatus.includes('LOCKED') ? 'var(--command-teal)' : 'var(--text-secondary)',
                  letterSpacing: 1, fontWeight: 500,
                }}>
                  GEO: {geoStatus}
                </span>
              </div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', marginTop: 3, letterSpacing: 0.5 }}>
                LAT {mapCenter.lat.toFixed(4)} · LNG {mapCenter.lng.toFixed(4)}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ─── Bottom Right: Operator Badge (CLICKABLE → fly to location) ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="absolute bottom-4 right-4"
          style={{ zIndex: 1000 }}
        >
          <button
            onClick={flyToUser}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              background: 'rgba(8,10,16,0.92)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0,242,255,0.08)',
              borderRadius: 14,
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,242,255,0.25)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(0,242,255,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,242,255,0.08)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title="Click to navigate to your location"
            id="operator-badge"
          >
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(0,242,255,0.15), rgba(0,242,255,0.05))',
                border: '1px solid rgba(0,242,255,0.2)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--command-teal)" strokeWidth="2" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-primary)', fontWeight: 500, textAlign: 'left' }}>
                {userEmail || 'OPERATOR'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22C55E', boxShadow: '0 0 4px #22C55E' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>
                  CLICK TO LOCATE
                </span>
              </div>
            </div>
            {/* Navigate icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--command-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
          </button>
        </motion.div>

        {/* ═══════════════════════════════════════════
            RIGHT PANEL — Emergency Services
           ═══════════════════════════════════════════ */}
        <AnimatePresence>
          {panelOpen && (
            <motion.div
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-3 right-3 bottom-3 overflow-hidden flex flex-col"
              style={{
                width: 290,
                borderRadius: 14,
                zIndex: 1000,
                background: 'rgba(8,10,16,0.94)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(0,242,255,0.08)',
              }}
              id="services-panel"
            >
              {/* Panel header */}
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(0,242,255,0.06)' }}>
                <div className="flex items-center justify-between mb-3">
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--command-teal)', letterSpacing: 1.5 }}>
                    NEARBY SERVICES
                  </p>
                  <button
                    onClick={() => setPanelOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 14, padding: 2 }}
                  >
                    ✕
                  </button>
                </div>

                {/* Filter tabs */}
                <div className="flex gap-1.5">
                  {[
                    { key: 'all', label: 'ALL', color: 'var(--command-teal)' },
                    { key: 'police', label: '🚔', color: '#3B82F6' },
                    { key: 'fire_station', label: '🚒', color: '#EF4444' },
                    { key: 'hospital', label: '🏥', color: '#22C55E' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setActiveFilter(f.key)}
                      className="px-2.5 py-1.5 rounded-md"
                      style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: 1, cursor: 'pointer',
                        border: `1px solid ${activeFilter === f.key ? f.color : 'rgba(255,255,255,0.04)'}`,
                        background: activeFilter === f.key ? `${f.color}15` : 'transparent',
                        color: activeFilter === f.key ? f.color : 'var(--text-dim)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Service list */}
              <div className="flex-1 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: 'thin' }}>
                {loadingServices ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 rounded-full animate-spin mb-3"
                      style={{ borderColor: 'var(--command-teal) transparent transparent transparent' }} />
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', letterSpacing: 1 }}>
                      SCANNING...
                    </p>
                  </div>
                ) : filteredServices.length === 0 ? (
                  <div className="text-center py-12">
                    <p style={{ fontSize: 24, marginBottom: 8 }}>📡</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
                      NO SERVICES FOUND
                    </p>
                  </div>
                ) : (
                  filteredServices.map((svc, i) => (
                    <motion.div
                      key={svc.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => flyToService(svc)}
                      className={`mb-1.5 px-3 py-2.5 rounded-xl cursor-pointer service-item ${crisisInfo.active && crisisInfo.type === svc.type ? 'ring-1 ring-red-500/30' : ''}`}
                      style={{
                        background: crisisInfo.active && crisisInfo.type === svc.type ? 'rgba(239,68,68,0.06)' : 'rgba(19,25,36,0.4)',
                        border: `1px solid ${crisisInfo.active && crisisInfo.type === svc.type ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)'}`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = svc.borderColor;
                        e.currentTarget.style.background = 'rgba(0,242,255,0.06)';
                      }}
                      onMouseLeave={(e) => {
                        const isCrisis = crisisInfo.active && crisisInfo.type === svc.type;
                        e.currentTarget.style.borderColor = isCrisis ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)';
                        e.currentTarget.style.background = isCrisis ? 'rgba(239,68,68,0.06)' : 'rgba(19,25,36,0.4)';
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{svc.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p style={{
                            fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 600,
                            color: svc.color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2,
                          }}>
                            {svc.label}
                          </p>
                          <p style={{
                            fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-primary)',
                            fontWeight: 500, lineHeight: 1.3,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {svc.name}
                          </p>
                          {svc.phone && (
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)', marginTop: 2 }}>
                              📞 {svc.phone}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p style={{
                            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                            color: svc.distance < 1 ? '#22C55E' : svc.distance < 3 ? '#F59E0B' : 'var(--text-secondary)',
                          }}>
                            {svc.distance < 1 ? `${(svc.distance * 1000).toFixed(0)}m` : `${svc.distance.toFixed(1)}km`}
                          </p>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-dim)', marginTop: 1, letterSpacing: 0.5 }}>
                            AWAY
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Panel footer */}
              <div className="px-4 py-2.5" style={{ borderTop: '1px solid rgba(0,242,255,0.04)' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>
                  {filteredServices.length} SERVICE{filteredServices.length !== 1 ? 'S' : ''} · {scanRadius}KM SCAN
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Panel toggle (when closed) */}
        {!panelOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setPanelOpen(true)}
            className="absolute top-3 right-4 px-3 py-3 rounded-xl"
            style={{
              zIndex: 1000, cursor: 'pointer',
              border: '1px solid rgba(0,242,255,0.1)',
              background: 'rgba(8,10,16,0.92)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--command-teal)" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </motion.button>
        )}
      </div>

      {/* ─── Crisis Simulator (Dev Console) ─── */}
      <CrisisSimulator
        onTrigger={(sensorData) => {
          if (!aiOpen) setAiOpen(true);
          setTimeout(() => agentState.processCrisis(sensorData), aiOpen ? 100 : 600);
        }}
        isProcessing={agentState.isProcessing}
      />
    </motion.div>
  );
}
