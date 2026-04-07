import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AgentGraph from './AgentGraph';
import FacilityTwin from './FacilityTwin';
import CrisisSimulator from './CrisisSimulator';
import Sparkline from './Sparkline';
import useAutonomousAgent from '../hooks/useAutonomousAgent';

// ─── Bangalore Geofence ───
const BANGALORE_BOUNDS = {
  latMin: 12.83, latMax: 13.14,
  lngMin: 77.46, lngMax: 77.78,
};
const MG_ROAD_FALLBACK = { lat: 12.9716, lng: 77.5946 };

function isInBangalore(lat, lng) {
  return lat >= BANGALORE_BOUNDS.latMin && lat <= BANGALORE_BOUNDS.latMax &&
    lng >= BANGALORE_BOUNDS.lngMin && lng <= BANGALORE_BOUNDS.lngMax;
}

// ─── Dark Map Tiles (CartoDB Dark Matter) ───
const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

// ─── TomTom Live Traffic Flow ───
const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || '';
const TOMTOM_TRAFFIC_URL = `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`;

// ─── Emergency Service Definitions ───
const SERVICE_TYPES = {
  police: { label: 'POLICE STATION', emoji: '🚔', color: '#3B82F6', glowColor: 'rgba(59,130,246,0.5)', borderColor: 'rgba(59,130,246,0.3)', query: '["amenity"="police"]' },
  fire_station: { label: 'FIRE BRIGADE', emoji: '🚒', color: '#EF4444', glowColor: 'rgba(239,68,68,0.5)', borderColor: 'rgba(239,68,68,0.3)', query: '["amenity"="fire_station"]' },
  hospital: { label: 'HOSPITAL', emoji: '🏥', color: '#22C55E', glowColor: 'rgba(34,197,94,0.5)', borderColor: 'rgba(34,197,94,0.3)', query: '["amenity"="hospital"]' },
};

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchNearbyServices(lat, lng, radiusMeters = 5000) {
  const queries = Object.entries(SERVICE_TYPES).map(([, svc]) => {
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
        id: el.id, type: amenity,
        name: el.tags?.name || el.tags?.['name:en'] || SERVICE_TYPES[amenity].label,
        phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
        lat: elLat, lng: elLng,
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

// ─── Helper: generate initial sparkline data ───
const genSparkData = (min, max, len = 20) => Array.from({ length: len }, () => min + Math.random() * (max - min));
const pushSparkData = (arr, min, max) => [...arr.slice(1), min + Math.random() * (max - min)];

// ─── Mono font shorthand ───
const mono = "var(--font-mono, 'JetBrains Mono', monospace)";

/**
 * Step 3: Command Map — Premium Command Center Layout
 */
export default function CommandMap({ hospitalityType, userEmail }) {
  // ═══ Map State ═══
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
  const [activeFilter, setActiveFilter] = useState('all');
  const scanRadius = 5;

  // ═══ New Layout State ═══
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [neuralOpen, setNeuralOpen] = useState(false);
  const [devConsoleOpen, setDevConsoleOpen] = useState(false);
  const [facilityVisible, setFacilityVisible] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const SERVICES_PER_PAGE = 10;

  // ═══ Crisis State ═══
  const [crisisInfo, setCrisisInfo] = useState({ active: false, type: null });

  // Auto-clear crisis vignette after 15s if backend doesn't resolve it
  useEffect(() => {
    if (!crisisInfo.active) return;
    const timeout = setTimeout(() => {
      setCrisisInfo(prev => ({ ...prev, active: false, respondersActive: false }));
    }, 15000);
    return () => clearTimeout(timeout);
  }, [crisisInfo.active]);

  // ═══ Sparkline Metrics ═══
  const [metrics, setMetrics] = useState({
    criticalAlerts: { data: genSparkData(0, 15), current: 11, label: 'Critical Alert', icon: '⚠', color: '#F59E0B' },
    hospitalStatus: { data: genSparkData(20, 35), current: 0, label: 'Hospital Status', icon: '🏥', color: '#22C55E' },
    policeResources: { data: genSparkData(70, 100), current: 89, label: 'Police Resources', icon: '🚔', color: '#3B82F6' },
    securityAlert: { data: genSparkData(0, 12), current: 10, label: 'Security Alert', icon: '🛡', color: '#A855F7' },
    personnel: { data: genSparkData(8, 14), current: 11, label: 'Personnel', icon: '👥', color: '#6366F1' },
    neuralHealth: { data: genSparkData(85, 100), current: 98, label: 'Neural Health', icon: '🧠', color: '#06B6D4' },
  });

  // ═══ Autonomous Agent ═══
  const agentState = useAutonomousAgent({
    hospitalityType, services, mapCenter,
    onCrisisUpdate: (info) => {
      setCrisisInfo(prev => {
        if (!info.active && prev.active) return { ...prev, active: false, respondersActive: false };
        return { ...prev, ...info };
      });
      if (mapInstanceRef.current && services.length > 0) plotServices(services, mapInstanceRef.current, info);
    },
  });

  // ═══ Agent boot + periodic scans ═══
  const [agentBooted, setAgentBooted] = useState(false);
  useEffect(() => {
    if (agentBooted || !services?.length) return;
    setAgentBooted(true);
    const bootTimers = [
      setTimeout(() => agentState.addEntry('SYSTEM', `Command center initialized — ${hospitalityType?.label || 'Operations'} mode active.`), 300),
      setTimeout(() => agentState.addEntry('SYSTEM', `Geofence locked: Bangalore sector. ${services.length} emergency resources detected.`), 1200),
      setTimeout(() => { agentState.addEntry('INTEL', 'IoT sensor mesh connected... 47 nodes online. Anomaly detection armed.'); agentState.addComms('SENSOR MESH HANDSHAKE COMPLETE. 47/47 NODES ACTIVE.'); }, 2400),
      setTimeout(() => agentState.addEntry('SYSTEM', 'Gemini reasoning engine online. Awaiting sensor data or manual trigger.'), 3600),
    ];
    return () => bootTimers.forEach(clearTimeout);
  }, [services?.length, agentBooted]);

  useEffect(() => {
    if (!agentBooted) return;
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
    return () => clearInterval(scanInterval);
  }, [agentBooted, services.length]);

  // ═══ Auto-open neural drawer on crisis (only if not manually closed) ═══
  // Removed auto-open to prevent blocking the map

  // ═══ Update metrics periodically ═══
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        criticalAlerts: { ...prev.criticalAlerts, data: pushSparkData(prev.criticalAlerts.data, crisisInfo.active ? 10 : 0, crisisInfo.active ? 25 : 15), current: crisisInfo.active ? Math.floor(15 + Math.random() * 10) : Math.floor(8 + Math.random() * 6) },
        hospitalStatus: { ...prev.hospitalStatus, data: pushSparkData(prev.hospitalStatus.data, 20, 35), current: services.filter(s => s.type === 'hospital').length || prev.hospitalStatus.current },
        policeResources: { ...prev.policeResources, data: pushSparkData(prev.policeResources.data, 70, 100), current: services.filter(s => s.type === 'police').length || prev.policeResources.current },
        securityAlert: { ...prev.securityAlert, data: pushSparkData(prev.securityAlert.data, 0, crisisInfo.active ? 20 : 12), current: crisisInfo.active ? Math.floor(15 + Math.random() * 5) : 10 },
        personnel: { ...prev.personnel, data: pushSparkData(prev.personnel.data, 8, 14), current: 11 },
        neuralHealth: { ...prev.neuralHealth, data: pushSparkData(prev.neuralHealth.data, 85, 100), current: Math.floor(92 + Math.random() * 8) },
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [crisisInfo.active, services]);

  // ═══ Live clock ═══
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ═══ Service status (deterministic per service ID) ═══
  const svcStatuses = useMemo(() => {
    const map = {};
    services.forEach(svc => {
      const h = svc.id % 100;
      if (crisisInfo?.active && crisisInfo.alertedNodes?.includes(svc.id)) {
        map[svc.id] = { label: 'Dispatched', color: '#EF4444' };
      } else if (h < 3) {
        map[svc.id] = { label: 'Critical Overload', color: '#EF4444' };
      } else if (crisisInfo?.active && crisisInfo.type === svc.type && h < 8) {
        map[svc.id] = { label: 'Response Grade', color: '#F59E0B' };
      } else {
        map[svc.id] = { label: 'Available', color: '#22C55E' };
      }
    });
    return map;
  }, [services, crisisInfo?.active, crisisInfo?.alertedNodes, crisisInfo?.type]);

  // ═══ Nearest hospital for site status ═══
  const nearestHospital = useMemo(() => services.find(s => s.type === 'hospital'), [services]);

  // ═══ Map Marker Icon ═══
  const createServiceIcon = useCallback((svc, isAlerted = false) => {
    const L = window.L;
    const alertStyle = isAlerted ? `animation: marker-alert-pulse 1s ease-in-out infinite; --alert-color: ${svc.glowColor};` : '';
    return L.divIcon({
      className: '',
      html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:${isAlerted ? 'rgba(239,68,68,0.15)' : 'rgba(11,14,20,0.92)'};border:2px solid ${isAlerted ? '#EF4444' : svc.color};box-shadow:0 0 12px ${svc.glowColor};font-size:15px;backdrop-filter:blur(8px);cursor:pointer;transition:transform 0.2s;${alertStyle}">${svc.emoji}</div>`,
      iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20],
    });
  }, []);

  // ═══ Plot services on map ═══
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
        `<div style="font-family:${mono};color:#E8ECF4;background:rgba(11,14,20,0.95);padding:14px 16px;border:1px solid ${svc.borderColor};border-radius:12px;min-width:210px;box-shadow:0 8px 32px rgba(0,0,0,0.5);backdrop-filter:blur(20px);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:20px;">${svc.emoji}</span>
            <span style="color:${svc.color};font-weight:700;letter-spacing:1px;font-size:10px;text-transform:uppercase;">${svc.label}</span>
          </div>
          <div style="color:#E8ECF4;font-size:12px;font-weight:600;margin-bottom:4px;line-height:1.3;">${svc.name}</div>
          ${svc.phone ? `<div style="color:#8892A8;font-size:10px;margin-top:2px;">📞 ${svc.phone}</div>` : ''}
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
            <span style="color:#8892A8;font-size:9px;">DISTANCE </span>
            <span style="color:${svc.color};font-size:11px;font-weight:700;">${svc.distance.toFixed(2)} km</span>
          </div>
        </div>`,
        { className: 'leaflet-popup-dark', closeButton: false, offset: [0, -4] }
      );
      marker.addTo(markersLayerRef.current);

      if (isAlerted) {
        const fallbackLine = L.polyline([[svc.lat, svc.lng], [destLat, destLng]], {
          className: 'route-line-animated', color: svc.color, weight: 3, opacity: 0.6, dashArray: '4 8'
        }).addTo(routesLayerRef.current);
        activePoints.push([svc.lat, svc.lng]);

        fetch(`https://router.project-osrm.org/route/v1/driving/${svc.lng},${svc.lat};${destLng},${destLat}?geometries=geojson`)
          .then(res => res.json())
          .then(data => {
            if (data.code === 'Ok' && data.routes?.length > 0 && routesLayerRef.current?.hasLayer(fallbackLine)) {
              routesLayerRef.current.removeLayer(fallbackLine);
              const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
              L.polyline(coords, { className: 'route-line-animated', color: svc.color, weight: 4, opacity: 0.9, dashArray: '8 12', lineCap: 'round' }).addTo(routesLayerRef.current);
            }
          })
          .catch(err => console.warn('OSRM mapping failed:', err));
      }
    });

    if (crisis?.active && activePoints.length > 1) {
      setTimeout(() => {
        if (map) map.flyToBounds(L.latLngBounds(activePoints), { padding: [60, 60, 60, 60], duration: 1.5, maxZoom: 15 });
      }, 500);
    }
  }, [createServiceIcon, mapCenter]);

  // ═══ Scan services ═══
  const scanServices = useCallback(async (center, map) => {
    setLoadingServices(true);
    const result = await fetchNearbyServices(center.lat, center.lng, scanRadius * 1000);
    setServices(result);
    plotServices(result, map);
    setLoadingServices(false);
    setTimeout(() => { map.flyTo([center.lat, center.lng], 15, { duration: 1.4 }); }, 400);
  }, [scanRadius, plotServices]);

  const flyToUser = useCallback(() => {
    const loc = userLocation || mapCenter;
    if (mapInstanceRef.current && loc) mapInstanceRef.current.flyTo([loc.lat, loc.lng], 16, { duration: 1.2 });
  }, [userLocation, mapCenter]);

  // ═══ Map Initialization ═══
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || mapInstanceRef.current) return;
    if (mapRef.current._leaflet_id) return;

    const initMap = (center, zoom = 15) => {
      const map = L.map(mapRef.current, {
        center: [center.lat, center.lng], zoom, zoomControl: false, attributionControl: false,
        maxBounds: L.latLngBounds(L.latLng(BANGALORE_BOUNDS.latMin, BANGALORE_BOUNDS.lngMin), L.latLng(BANGALORE_BOUNDS.latMax, BANGALORE_BOUNDS.lngMax)),
        maxBoundsViscosity: 1.0, minZoom: 11, maxZoom: 18,
      });

      // Dark tiles
      L.tileLayer(DARK_TILE_URL, { attribution: DARK_TILE_ATTR, maxZoom: 19 }).addTo(map);

      // Traffic overlay
      if (TOMTOM_API_KEY && TOMTOM_API_KEY !== 'YOUR_API_KEY_HERE') {
        L.tileLayer(TOMTOM_TRAFFIC_URL, { maxZoom: 19, opacity: 0.7, zIndex: 1000 }).addTo(map);
      }

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // HQ marker
      const hqIcon = L.divIcon({
        className: '',
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
          <div style="width:22px;height:22px;border-radius:50%;background:#FF4D4D;border:3px solid rgba(255,77,77,0.4);box-shadow:0 0 18px rgba(255,77,77,0.6);animation:pulse-glow 2s ease-in-out infinite;"></div>
          <div style="position:absolute;top:-8px;left:-8px;width:38px;height:38px;border-radius:50%;border:2px solid rgba(255,77,77,0.15);animation:pulse-glow 2s ease-in-out infinite;"></div>
        </div>`,
        iconSize: [22, 22], iconAnchor: [11, 11],
      });
      L.marker([MG_ROAD_FALLBACK.lat, MG_ROAD_FALLBACK.lng], { icon: hqIcon }).addTo(map)
        .bindPopup(`<div style="font-family:${mono};font-size:11px;color:#E8ECF4;background:rgba(11,14,20,0.95);padding:12px 16px;border:1px solid rgba(255,77,77,0.3);border-radius:12px;min-width:180px;backdrop-filter:blur(20px);">
          <div style="color:#FF4D4D;font-weight:700;letter-spacing:1px;margin-bottom:4px;">⊕ COMMAND HQ</div>
          <div style="color:#8892A8;font-size:10px;">MG Road, Bangalore</div>
        </div>`, { className: 'leaflet-popup-dark', closeButton: false, offset: [0, -16] });

      // Scan radius
      L.circle([center.lat, center.lng], { radius: 5000, color: 'rgba(0,242,255,0.2)', fillColor: 'rgba(0,242,255,0.03)', fillOpacity: 1, weight: 1, dashArray: '8 4' }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
      scanServices(center, map);
      return map;
    };

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
          setUserLocation(loc); setMapCenter(loc); setGeoStatus('LOCKED — IN ZONE');
          const map = initMap(loc);
          const L = window.L;
          const userIcon = L.divIcon({
            className: '',
            html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
              <div style="width:24px;height:24px;border-radius:50%;background:#00F2FF;border:3px solid rgba(0,242,255,0.5);box-shadow:0 0 20px rgba(0,242,255,0.7);z-index:3;"></div>
              <div style="position:absolute;width:40px;height:40px;border-radius:50%;border:2px solid rgba(0,242,255,0.3);animation:pulse-glow 2s ease-in-out infinite;"></div>
              <div style="position:absolute;width:56px;height:56px;border-radius:50%;border:1.5px solid rgba(0,242,255,0.15);animation:pulse-glow 2s ease-in-out infinite;animation-delay:0.5s;"></div>
            </div>`,
            iconSize: [56, 56], iconAnchor: [28, 28],
          });
          L.marker([latitude, longitude], { icon: userIcon }).addTo(map)
            .bindPopup(`<div style="font-family:${mono};font-size:11px;color:#E8ECF4;background:rgba(11,14,20,0.95);padding:10px 14px;border:1px solid rgba(0,242,255,0.3);border-radius:10px;backdrop-filter:blur(20px);">
              <div style="color:#00F2FF;font-weight:600;letter-spacing:1px;margin-bottom:4px;">◉ YOUR POSITION</div>
              <div style="color:#4A5568;font-size:9px;">${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E</div>
            </div>`, { className: 'leaflet-popup-dark', closeButton: false, offset: [0, -12] });
        } else {
          setMapCenter(MG_ROAD_FALLBACK); setGeoStatus('OUT OF ZONE — FALLBACK'); initMap(MG_ROAD_FALLBACK);
        }
      },
      () => { setGeoStatus('GEO DENIED — FALLBACK'); setMapCenter(MG_ROAD_FALLBACK); initMap(MG_ROAD_FALLBACK); },
      { enableHighAccuracy: true, timeout: 8000 }
    );

    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, []);

  // ═══ Computed ═══
  const flyToService = (svc) => { if (mapInstanceRef.current) mapInstanceRef.current.flyTo([svc.lat, svc.lng], 16, { duration: 1 }); };
  const formatTime = (d) => d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (d) => d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });

  const filteredServices = activeFilter === 'all' ? services : services.filter((s) => s.type === activeFilter);
  const totalPages = Math.ceil(filteredServices.length / SERVICES_PER_PAGE) || 1;
  const paginatedServices = filteredServices.slice((currentPage - 1) * SERVICES_PER_PAGE, currentPage * SERVICES_PER_PAGE);

  const counts = {
    police: services.filter((s) => s.type === 'police').length,
    fire_station: services.filter((s) => s.type === 'fire_station').length,
    hospital: services.filter((s) => s.type === 'hospital').length,
    total: services.length,
  };

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(1); }, [activeFilter]);

  // ═══ Auto-scroll Live Logs ═══
  useEffect(() => {
    const el = document.getElementById('dev-console-auto-scroll');
    if (el) el.scrollTop = el.scrollHeight;
  }, [agentState.actionLog.length]);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="cmd-grid">

      {/* ═══ TOP BAR ═══ */}
      <header className="cmd-topbar">
        <div className="flex items-center gap-3">
          <img src="/rakshak-logo.png" alt="Rakshak AI" className="w-7 h-7 object-contain rounded-lg" style={{ filter: 'drop-shadow(0 0 8px rgba(0,242,255,0.3))' }} />
          <div>
            <p style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: 'var(--command-teal)', letterSpacing: 2, lineHeight: 1.1 }}>RAKSHAK AI</p>
            <p style={{ fontFamily: mono, fontSize: 7, color: 'var(--text-dim)', letterSpacing: 1.5 }}>CRISIS COMMAND CENTER</p>
          </div>
        </div>

        {/* Center stats */}
        <div className="flex items-center gap-4">
          {loadingServices ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--command-teal) transparent transparent transparent' }} />
              <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--command-teal)', letterSpacing: 1 }}>SCANNING...</span>
            </div>
          ) : (
            <>
              {[
                { emoji: '🚔', count: counts.police, color: '#3B82F6' },
                { emoji: '🚒', count: counts.fire_station, color: '#EF4444' },
                { emoji: '🏥', count: counts.hospital, color: '#22C55E' },
              ].map((item) => (
                <div key={item.emoji} className="flex items-center gap-1.5">
                  <span style={{ fontSize: 13 }}>{item.emoji}</span>
                  <span style={{ fontFamily: mono, fontSize: 12, color: item.color, fontWeight: 700 }}>{item.count}</span>
                </div>
              ))}
              <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />
              <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1 }}>{scanRadius}KM RADIUS</span>
            </>
          )}
        </div>

        {/* Right: system + live + time */}
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 1 }}>SYSTEM: <span style={{ color: '#22C55E' }}>SECURE ONLINE</span></span>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full pulse-glow" style={{ background: 'var(--command-teal)', boxShadow: '0 0 8px var(--command-teal)' }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--command-teal)', letterSpacing: 1, fontWeight: 600 }}>LIVE</span>
          </div>
          <div className="text-right">
            <p style={{ fontFamily: mono, fontSize: 11, color: 'var(--command-teal)', fontWeight: 600, lineHeight: 1.1, letterSpacing: 1 }}>{formatTime(currentTime)}</p>
            <p style={{ fontFamily: mono, fontSize: 7, color: 'var(--text-dim)', letterSpacing: 1 }}>{formatDate(currentTime)}</p>
          </div>
          {userEmail && <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', letterSpacing: 0.5, marginLeft: 4 }}>{userEmail}</span>}
        </div>
      </header>

      {/* ═══ LEFT SIDEBAR ═══ */}
      <aside className={`cmd-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {sidebarCollapsed ? (
          /* ── Collapsed Icon Strip ── */
          <div className="flex flex-col items-center gap-1.5 pt-3">
            <div className="cmd-collapsed-icon" onClick={() => setSidebarCollapsed(false)} title="Expand Sidebar">☰</div>
            <div className="cmd-divider" style={{ margin: '4px 0', width: 28 }} />
            <div className="cmd-collapsed-icon" onClick={() => setSidebarCollapsed(false)} title="Site Status">🏨</div>
            <div className="cmd-collapsed-icon" onClick={() => setSidebarCollapsed(false)} title="Alerts" style={{ position: 'relative' }}>
              🔔
              {crisisInfo.active && <div className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: '#EF4444', boxShadow: '0 0 4px #EF4444' }} />}
            </div>
            <div className="cmd-collapsed-icon" onClick={() => setSidebarCollapsed(false)} title="Services">🚔</div>
            <div className="cmd-collapsed-icon" onClick={() => setSidebarCollapsed(false)} title="Metrics">📊</div>
            <div className="cmd-collapsed-icon" onClick={() => setFacilityVisible(v => !v)} title="Facility Twin" style={{ color: facilityVisible ? 'var(--command-teal)' : undefined }}>🏗</div>
            <div style={{ flex: 1 }} />
            <div className="cmd-collapsed-icon" onClick={() => { setNeuralOpen(true); }} title="Neural Engine" style={{ color: neuralOpen ? '#06B6D4' : undefined }}>🧠</div>
            <div className="cmd-collapsed-icon" onClick={() => setDevConsoleOpen(v => !v)} title="Dev Console" style={{ color: devConsoleOpen ? '#EF4444' : undefined }}>⚡</div>
            <div style={{ height: 8 }} />
          </div>
        ) : (
          /* ── Expanded Sidebar ── */
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(0,242,255,0.06)', flexShrink: 0 }}>
              <div>
                <p style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1.2 }}>COMMAND OVERVIEW</p>
                <p style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1, marginTop: 1 }}>RAKSHAK AI · LIVE</p>
              </div>
              <button onClick={() => setSidebarCollapsed(true)} style={{ background: 'rgba(0,242,255,0.04)', border: '1px solid rgba(0,242,255,0.12)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: 'var(--command-teal)', fontSize: 11, transition: 'all 0.2s' }}>◀</button>
            </div>

            {/* Scrollable content */}
            <div className="cmd-sidebar-scroll">

              {/* ── Active Site Status ── */}
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(0,242,255,0.04)' }}>
                <p style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: 'var(--command-teal)', letterSpacing: 1.8, marginBottom: 10, textTransform: 'uppercase' }}>Active Site Status</p>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,242,255,0.06)', border: '1px solid rgba(0,242,255,0.1)' }}>
                    <span style={{ fontSize: 14 }}>🏨</span>
                  </div>
                  <div>
                    <p style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.4 }}>{hospitalityType?.label || 'Convention Center'}</p>
                    <p style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 0.5, marginTop: 1 }}>{hospitalityType?.sub || 'Operations'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: geoStatus.includes('LOCKED') ? '#22C55E' : '#F59E0B', boxShadow: `0 0 4px ${geoStatus.includes('LOCKED') ? '#22C55E' : '#F59E0B'}` }} />
                      <span style={{ fontFamily: mono, fontSize: 9, color: geoStatus.includes('LOCKED') ? '#22C55E' : 'var(--text-secondary)', letterSpacing: 0.8, fontWeight: 600 }}>GEO: {geoStatus}</span>
                    </div>
                  </div>
                </div>
                {nearestHospital && (
                  <div className="flex items-center gap-2.5 mt-2 pt-2" style={{ borderTop: '1px solid rgba(0,242,255,0.04)' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.1)' }}>
                      <span style={{ fontSize: 14 }}>🏥</span>
                    </div>
                    <div>
                      <p style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 0.3 }}>{nearestHospital.name}</p>
                      {nearestHospital.phone && <p style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-secondary)' }}>📞 {nearestHospital.phone}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Live Agent Logs ── */}
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(0,242,255,0.04)' }}>
                <p style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: 'var(--command-teal)', letterSpacing: 1.8, marginBottom: 10, textTransform: 'uppercase' }}>Live AI Agent Logs</p>
                <div className="flex flex-col gap-2" style={{ maxHeight: 220, overflowY: 'auto' }} id="dev-console-auto-scroll">
                  {agentState.actionLog.length === 0 ? (
                    <p style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', py: 4 }}>Awaiting input...</p>
                  ) : (
                    // Show only last 10 entries in the sidebar to prevent layout clutter
                    agentState.actionLog.slice(-10).map((log) => {
                      const colors = {
                        SYSTEM: '#00F2FF', DETECTION: '#F59E0B', ANALYSIS: '#F59E0B', 
                        DECISION: '#A855F7', DISPATCH: '#EF4444', RESOLVED: '#22C55E', 
                        INTEL: '#3B82F6', COMMS: '#06B6D4'
                      };
                      const color = colors[log.category] || 'var(--text-secondary)';
                      return (
                        <div key={log.id} style={{ display: 'flex', gap: 8, padding: '6px 8px', background: 'rgba(15,20,30,0.5)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: 8 }}>
                          <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', width: 45, flexShrink: 0, marginTop: 2 }}>
                            {agentState.formatTime(log.timestamp).split(' ')[0]}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontFamily: mono, fontSize: 8, color, fontWeight: 700, letterSpacing: 1 }}>{log.category}</span>
                            </div>
                            <p style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.4, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                              {log.message}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* ── Nearby Services Table ── */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: 'var(--command-teal)', letterSpacing: 1.8, textTransform: 'uppercase' }}>Nearby Services</p>
                </div>
                {/* Filters */}
                <div className="flex gap-1.5 mb-3">
                  {[
                    { key: 'all', label: 'ALL' },
                    { key: 'police', label: '🚔 POLICE' },
                    { key: 'hospital', label: '🏥 HOSPITAL' },
                  ].map((f) => (
                    <button key={f.key} className={`cmd-filter-tab ${activeFilter === f.key ? 'active' : ''}`} onClick={() => setActiveFilter(f.key)}>{f.label}</button>
                  ))}
                </div>
                {/* Table header */}
                <div className="cmd-svc-row" style={{ borderBottom: '1px solid rgba(0,242,255,0.06)', cursor: 'default' }}>
                  <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1.2, fontWeight: 700 }}>STATUS</span>
                  <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1.2, fontWeight: 700 }}>NAME</span>
                  <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1.2, fontWeight: 700 }}>DIST</span>
                  <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1.2, fontWeight: 700 }}>ETA</span>
                </div>
                {/* Rows */}
                {loadingServices ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--command-teal) transparent transparent transparent' }} />
                  </div>
                ) : paginatedServices.length === 0 ? (
                  <p className="py-6 text-center" style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-dim)' }}>No services found</p>
                ) : (
                  paginatedServices.map((svc) => {
                    const status = svcStatuses[svc.id] || { label: 'Available', color: '#22C55E' };
                    const eta = (svc.distance * 1.5).toFixed(0);
                    return (
                      <div key={svc.id} className="cmd-svc-row" onClick={() => flyToService(svc)}>
                        <span style={{ fontFamily: mono, fontSize: 8, color: status.color, fontWeight: 600, letterSpacing: 0.3 }}>{status.label}</span>
                        <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ marginRight: 4 }}>{svc.emoji}</span>{svc.name}
                        </span>
                        <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600 }}>{svc.distance.toFixed(1)}km</span>
                        <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-secondary)' }}>{eta}m</span>
                      </div>
                    );
                  })
                )}
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid rgba(0,242,255,0.04)' }}>
                    <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>Pg · {currentPage} / {totalPages}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(0,242,255,0.1)', background: 'transparent', cursor: 'pointer', color: 'var(--command-teal)', fontFamily: mono, fontSize: 10, opacity: currentPage <= 1 ? 0.3 : 1 }}>‹</button>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(0,242,255,0.1)', background: 'transparent', cursor: 'pointer', color: 'var(--command-teal)', fontFamily: mono, fontSize: 10, opacity: currentPage >= totalPages ? 0.3 : 1 }}>›</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Neural Engine Button (pinned bottom) */}
            <button
              onClick={() => setNeuralOpen(!neuralOpen)}
              className="flex items-center gap-2.5 mx-3 mb-3 px-4 py-2.5 rounded-xl"
              style={{
                flexShrink: 0,
                background: neuralOpen ? 'rgba(6,182,212,0.08)' : 'rgba(15,20,30,0.5)',
                border: `1px solid ${neuralOpen ? 'rgba(6,182,212,0.25)' : 'rgba(255,255,255,0.04)'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: 16 }}>🧠</span>
              <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: neuralOpen ? '#06B6D4' : 'var(--text-secondary)', letterSpacing: 1, flex: 1, textAlign: 'left' }}>NEURAL ANALYTICS</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--text-dim)' }}>{neuralOpen ? '✕' : '→'}</span>
            </button>
          </>
        )}
      </aside>

      {/* ═══ MAP AREA ═══ */}
      <main className="cmd-map-area">
        <div ref={mapRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />

        {/* Map loading */}
        {!mapReady && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-dark p-8 text-center" style={{ borderRadius: 16 }}>
              <div className="w-10 h-10 border-2 rounded-full animate-spin mb-4 mx-auto" style={{ borderColor: 'var(--command-teal) transparent transparent transparent' }} />
              <p style={{ fontFamily: mono, color: 'var(--command-teal)', fontSize: 12, letterSpacing: 2 }}>LOADING MAP INTERFACE...</p>
              <p style={{ fontFamily: mono, color: 'var(--text-dim)', fontSize: 9, marginTop: 6, letterSpacing: 1 }}>Initializing dark reconnaissance layers</p>
            </div>
          </div>
        )}

        {/* Facility Twin Overlay */}
        <AnimatePresence>
          {facilityVisible && (
            <motion.div
              className="cmd-facility-overlay"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              {/* Close button */}
              <button
                onClick={() => setFacilityVisible(false)}
                style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,242,255,0.1)', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', color: 'var(--text-dim)', fontFamily: mono, fontSize: 10 }}
              >✕</button>
              <FacilityTwin crisisInfo={crisisInfo} evacuationZone={agentState.evacuationZone} alertMessage={agentState.alertMessage} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Facility toggle when hidden */}
        {!facilityVisible && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setFacilityVisible(true)}
            className="absolute bottom-4 right-4"
            style={{ zIndex: 30, padding: '6px 12px', borderRadius: 8, background: 'rgba(8,10,16,0.9)', border: '1px solid rgba(0,242,255,0.1)', cursor: 'pointer', fontFamily: mono, fontSize: 8, color: 'var(--command-teal)', letterSpacing: 1 }}
          >🏗 FACILITY TWIN</motion.button>
        )}

        {/* Emergency Vignette */}
        <AnimatePresence>
          {crisisInfo.active && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: 999, boxShadow: 'inset 0 0 120px rgba(239,68,68,0.15)', animation: 'emergency-vignette 2s ease-in-out infinite' }}
            />
          )}
        </AnimatePresence>
      </main>

      {/* ═══ NEURAL ENGINE DRAWER ═══ */}
      <AnimatePresence>
        {neuralOpen && (
          <motion.div
            className="cmd-neural-drawer"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4" style={{ height: 36, flexShrink: 0, borderBottom: '1px solid rgba(0,242,255,0.06)', background: 'rgba(0,0,0,0.4)' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: crisisInfo.active ? '#EF4444' : '#22C55E', boxShadow: `0 0 6px ${crisisInfo.active ? '#EF4444' : '#22C55E'}` }} />
                <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1.5 }}>NEURAL ENGINE</span>
              </div>
              <button onClick={() => setNeuralOpen(false)} style={{ background: 'none', border: '1px solid rgba(0,242,255,0.1)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', color: 'var(--text-dim)', fontFamily: mono, fontSize: 10 }}>✕ CLOSE</button>
            </div>
            {/* Agent graph fills remaining space */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <AgentGraph agentState={agentState} crisisInfo={crisisInfo} services={services} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ BOTTOM BAR ═══ */}
      <footer className="cmd-bottombar">
        <button
          className={`cmd-bottom-btn ${devConsoleOpen ? 'active' : ''}`}
          onClick={() => setDevConsoleOpen(!devConsoleOpen)}
        >
          <span style={{ fontSize: 10 }}>⚡</span>
          <span>{devConsoleOpen ? '✕ CLOSE CONSOLE' : '← DEV CONSOLE'}</span>
        </button>

        <div style={{ flex: 1 }} />

        {/* Operator */}
        <button className="cmd-bottom-btn" onClick={flyToUser} title="Fly to your location">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22C55E', boxShadow: '0 0 4px #22C55E' }} />
          <span>{userEmail || 'OPERATOR'}</span>
        </button>

        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />
        <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>VERSION 2.5</span>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />
        <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>SECURITY LEVEL 4 [DATA ENCRYPTED]</span>
      </footer>

      {/* ═══ CRISIS SIMULATOR ═══ */}
      <CrisisSimulator
        isOpen={devConsoleOpen}
        onTrigger={(sensorData) => {
          setNeuralOpen(true);
          setTimeout(() => agentState.processCrisis(sensorData), 100);
        }}
        isProcessing={agentState.isProcessing}
      />
    </motion.div>
  );
}
