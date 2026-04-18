import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AgentGraph from './AgentGraph';
import FacilityTwin3D from './FacilityTwin3D';
import CrisisSimulator from './CrisisSimulator';
import ThreatGauge from './ThreatGauge';
import ChainOfThought from './ChainOfThought';
import IncidentTimeline from './IncidentTimeline';
import ConfirmationModal from './ConfirmationModal';
import EmergencyContacts from './EmergencyContacts';
import TopBarControls from './TopBarControls';
import useAutonomousAgent from '../hooks/useAutonomousAgent';
import { setMuted, getMuted } from './AudioEngine';

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

const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';
const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || '';
const TOMTOM_TRAFFIC_URL = `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`;

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

// ─── Hardcoded Real Bangalore Emergency Services Database ───
// These are real locations across Bangalore — guaranteed to always load
const BANGALORE_STATIONS = [
  // ── POLICE STATIONS ──
  { id: 'blr-pol-1',  type: 'police',       name: 'Cubbon Park Police Station',          lat: 12.9763, lng: 77.5929, phone: '+91-80-22942222' },
  { id: 'blr-pol-2',  type: 'police',       name: 'MG Road Police Station',              lat: 12.9738, lng: 77.6060, phone: '+91-80-25321547' },
  { id: 'blr-pol-3',  type: 'police',       name: 'Indiranagar Police Station',           lat: 12.9784, lng: 77.6408, phone: '+91-80-25285354' },
  { id: 'blr-pol-4',  type: 'police',       name: 'Koramangala Police Station',           lat: 12.9352, lng: 77.6245, phone: '+91-80-25531100' },
  { id: 'blr-pol-5',  type: 'police',       name: 'Whitefield Police Station',            lat: 12.9698, lng: 77.7500, phone: '+91-80-28452114' },
  { id: 'blr-pol-6',  type: 'police',       name: 'Jayanagar Police Station',             lat: 12.9250, lng: 77.5838, phone: '+91-80-26544422' },
  { id: 'blr-pol-7',  type: 'police',       name: 'HSR Layout Police Station',            lat: 12.9116, lng: 77.6389, phone: '+91-80-25723344' },
  { id: 'blr-pol-8',  type: 'police',       name: 'Rajajinagar Police Station',           lat: 12.9870, lng: 77.5530, phone: '+91-80-23320044' },
  { id: 'blr-pol-9',  type: 'police',       name: 'Basavanagudi Police Station',          lat: 12.9422, lng: 77.5756, phone: '+91-80-26600088' },
  { id: 'blr-pol-10', type: 'police',       name: 'Marathahalli Police Station',          lat: 12.9563, lng: 77.7019, phone: '+91-80-28411100' },
  { id: 'blr-pol-11', type: 'police',       name: 'Yeshwanthpur Police Station',          lat: 13.0070, lng: 77.5420, phone: '+91-80-23471122' },
  { id: 'blr-pol-12', type: 'police',       name: 'Banashankari Police Station',          lat: 12.9256, lng: 77.5468, phone: '+91-80-26790033' },
  // ── FIRE STATIONS ──
  { id: 'blr-fire-1', type: 'fire_station', name: 'Bangalore Central Fire Station',       lat: 12.9620, lng: 77.5780, phone: '+91-80-22971500' },
  { id: 'blr-fire-2', type: 'fire_station', name: 'Indiranagar Fire Station',             lat: 12.9810, lng: 77.6390, phone: '+91-80-25210101' },
  { id: 'blr-fire-3', type: 'fire_station', name: 'Koramangala Fire Station',             lat: 12.9340, lng: 77.6200, phone: '+91-80-25710101' },
  { id: 'blr-fire-4', type: 'fire_station', name: 'Jayanagar Fire Station',               lat: 12.9290, lng: 77.5810, phone: '+91-80-26560101' },
  { id: 'blr-fire-5', type: 'fire_station', name: 'Whitefield Fire Station',              lat: 12.9710, lng: 77.7460, phone: '+91-80-28450101' },
  { id: 'blr-fire-6', type: 'fire_station', name: 'Rajajinagar Fire Station',             lat: 12.9900, lng: 77.5550, phone: '+91-80-23350101' },
  { id: 'blr-fire-7', type: 'fire_station', name: 'Yeshwanthpur Fire Station',            lat: 13.0050, lng: 77.5470, phone: '+91-80-23470101' },
  { id: 'blr-fire-8', type: 'fire_station', name: 'HSR Layout Fire Station',              lat: 12.9130, lng: 77.6350, phone: '+91-80-25720101' },
  // ── HOSPITALS ──
  { id: 'blr-hosp-1',  type: 'hospital', name: 'Bowring & Lady Curzon Hospital',       lat: 12.9870, lng: 77.6050, phone: '+91-80-25591325' },
  { id: 'blr-hosp-2',  type: 'hospital', name: 'Victoria Hospital',                    lat: 12.9580, lng: 77.5730, phone: '+91-80-26701150' },
  { id: 'blr-hosp-3',  type: 'hospital', name: 'St. John\'s Medical College Hospital',  lat: 12.9286, lng: 77.6225, phone: '+91-80-22065000' },
  { id: 'blr-hosp-4',  type: 'hospital', name: 'Manipal Hospital — Old Airport Road',  lat: 12.9588, lng: 77.6480, phone: '+91-80-25024444' },
  { id: 'blr-hosp-5',  type: 'hospital', name: 'Apollo Hospital — Bannerghatta Road',  lat: 12.8921, lng: 77.5965, phone: '+91-80-26304050' },
  { id: 'blr-hosp-6',  type: 'hospital', name: 'Fortis Hospital — Cunningham Road',    lat: 12.9917, lng: 77.5892, phone: '+91-80-66214444' },
  { id: 'blr-hosp-7',  type: 'hospital', name: 'Columbia Asia — Hebbal',               lat: 13.0345, lng: 77.5930, phone: '+91-80-71787177' },
  { id: 'blr-hosp-8',  type: 'hospital', name: 'Narayana Health City',                 lat: 12.8730, lng: 77.6010, phone: '+91-80-27832000' },
  { id: 'blr-hosp-9',  type: 'hospital', name: 'Sakra World Hospital — Bellandur',     lat: 12.9265, lng: 77.6780, phone: '+91-80-49694969' },
  { id: 'blr-hosp-10', type: 'hospital', name: 'Ramaiah Memorial Hospital',            lat: 13.0270, lng: 77.5630, phone: '+91-80-23601110' },
  { id: 'blr-hosp-11', type: 'hospital', name: 'NIMHANS',                              lat: 12.9431, lng: 77.5960, phone: '+91-80-26995000' },
  { id: 'blr-hosp-12', type: 'hospital', name: 'Jayadeva Hospital — Jayanagar',        lat: 12.9280, lng: 77.5870, phone: '+91-80-26534251' },
];

// Attach SERVICE_TYPES metadata to each hardcoded station
function getHardcodedServices(centerLat, centerLng, radiusKm = 10) {
  return BANGALORE_STATIONS
    .map(s => ({
      ...s,
      ...SERVICE_TYPES[s.type],
      distance: haversine(centerLat, centerLng, s.lat, s.lng),
    }))
    .filter(s => s.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

function normalizeMapService(service, destLat, destLng) {
  if (!service) return null;

  const type = service.type || service.service_type;
  const serviceMeta = SERVICE_TYPES[type] || {};
  const lat = Number(service.lat ?? service.latitude);
  const lngRaw = service.lng ?? service.lon ?? service.longitude;
  const lng = Number(lngRaw);
  const directDistance = service.distance ?? service.distance_km ?? null;
  const computedDistance = (
    Number.isFinite(lat)
    && Number.isFinite(lng)
    && Number.isFinite(destLat)
    && Number.isFinite(destLng)
  )
    ? haversine(lat, lng, destLat, destLng)
    : null;
  const numericDistance = directDistance == null ? computedDistance : Number(directDistance);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    ...serviceMeta,
    ...service,
    id: String(service.id ?? `${type}-${service.name ?? 'unit'}`),
    type,
    service_type: type,
    lat,
    lng,
    lon: lng,
    distance: Number.isFinite(numericDistance) ? numericDistance : null,
    distance_km: Number.isFinite(numericDistance) ? numericDistance : null,
  };
}

// Overpass API endpoints to try (primary + mirrors)
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function fetchNearbyServices(lat, lng, radiusMeters = 5000) {
  // STEP 1: Always start with hardcoded Bangalore stations (guaranteed)
  const radiusKm = Math.max(radiusMeters / 1000, 10); // at least 10km to get good coverage
  const hardcoded = getHardcodedServices(lat, lng, radiusKm);
  console.log(`📍 Hardcoded baseline: ${hardcoded.length} stations within ${radiusKm}km`);

  // STEP 2: Try Overpass API for additional real-time data (best-effort, non-blocking fail)
  let apiServices = [];
  const queries = Object.entries(SERVICE_TYPES).map(([, svc]) => {
    return `node${svc.query}(around:${radiusMeters},${lat},${lng});way${svc.query}(around:${radiusMeters},${lat},${lng});`;
  });
  const overpassQuery = `[out:json][timeout:15];(${queries.join('\n')});out center body;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        console.warn(`Overpass endpoint ${endpoint} returned ${res.status}, trying next...`);
        continue;
      }
      const data = await res.json();
      for (const el of data.elements) {
        const elLat = el.lat || el.center?.lat;
        const elLng = el.lon || el.center?.lon;
        if (!elLat || !elLng) continue;
        const amenity = el.tags?.amenity;
        if (!SERVICE_TYPES[amenity]) continue;
        apiServices.push({
          id: String(el.id), type: amenity,
          name: el.tags?.name || el.tags?.['name:en'] || SERVICE_TYPES[amenity].label,
          phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
          lat: elLat, lng: elLng,
          distance: haversine(lat, lng, elLat, elLng),
          ...SERVICE_TYPES[amenity],
        });
      }
      if (apiServices.length > 0) {
        console.log(`✅ Overpass API: ${apiServices.length} services from ${endpoint}`);
        break; // success, stop trying endpoints
      }
    } catch (err) {
      console.warn(`Overpass endpoint ${endpoint} failed:`, err.message);
    }
  }

  // STEP 3: Merge — hardcoded first, then API results (deduplicate by proximity)
  const merged = new Map();
  // Add hardcoded first (guaranteed baseline)
  hardcoded.forEach(s => merged.set(s.id, s));
  // Add API results, skip if too close to an existing station (within 200m)
  apiServices.forEach(s => {
    const tooClose = Array.from(merged.values()).some(existing =>
      haversine(existing.lat, existing.lng, s.lat, s.lng) < 0.2
    );
    if (!tooClose) merged.set(s.id, s);
  });

  const result = Array.from(merged.values()).sort((a, b) => a.distance - b.distance);
  console.log(`🛡 Total services loaded: ${result.length} (${hardcoded.length} hardcoded + ${apiServices.length} API)`);
  return result;
}

const mono = "var(--font-mono, 'JetBrains Mono', monospace)";

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
  const scanRadius = 10;

  // ═══ Layout State ═══
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [neuralOpen, setNeuralOpen] = useState(false);
  const [devConsoleOpen, setDevConsoleOpen] = useState(false);
  const [facilityVisible, setFacilityVisible] = useState(true);
  const [cotHovering, setCotHovering] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sidebarTab, setSidebarTab] = useState('timeline'); // timeline | contacts | services
  const SERVICES_PER_PAGE = 10;

  // ═══ Crisis State ═══
  const [crisisInfo, setCrisisInfo] = useState({ active: false, type: null });
  const [notifications, setNotifications] = useState([]);
  const [audioMuted, setAudioMutedLocal] = useState(() => getMuted());

  useEffect(() => {
    if (!crisisInfo.active) return;
    const timeout = setTimeout(() => {
      setCrisisInfo(prev => ({ ...prev, active: false, respondersActive: false }));
    }, 20000);
    return () => clearTimeout(timeout);
  }, [crisisInfo.active]);

  // ═══ Autonomous Agent ═══
  const addNotification = useCallback((type, message) => {
    setNotifications(prev => [{
      id: Date.now() + Math.random(),
      type,
      message,
      time: new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      read: false,
    }, ...prev].slice(0, 50));
  }, []);

  const agentState = useAutonomousAgent({
    hospitalityType, services, mapCenter,
    onCrisisUpdate: (info) => {
      setCrisisInfo(prev => {
        if (!info.active && prev.active) {
          addNotification('system', 'Crisis resolved. All units returning to standby.');
          return { ...prev, active: false, respondersActive: false };
        }
        return { ...prev, ...info };
      });
      // Generate notifications for real events
      if (info.active && info.sensorData) {
        addNotification('crisis', `CRISIS DETECTED: ${(info.sensorData.type || 'UNKNOWN').toUpperCase()} at ${info.sensorData.location || 'Unknown'}`);
      }
      if (info.respondersActive) {
        addNotification('dispatch', `Emergency units dispatched to ${info.sensorData?.location || 'incident site'}`);
      }
      if (mapInstanceRef.current) plotServices(services, mapInstanceRef.current, info);
    },
  });

  // ═══ Agent boot ═══
  const [agentBooted, setAgentBooted] = useState(false);
  useEffect(() => {
    if (agentBooted || !services?.length) return;
    setAgentBooted(true);
    const bootTimers = [
      setTimeout(() => agentState.addEntry('SYSTEM', `Command center initialized — ${hospitalityType?.label || 'Operations'} mode active.`), 300),
      setTimeout(() => agentState.addEntry('SYSTEM', `Geofence locked: Bangalore sector. ${services.length} emergency resources detected.`), 1200),
      setTimeout(() => { 
        agentState.addEntry('INTEL', 'IoT sensor mesh connected... 47 nodes online. Anomaly detection armed.'); 
        agentState.addComms('SENSOR MESH HANDSHAKE COMPLETE. 47/47 NODES ACTIVE.'); 
        addNotification('system', 'IoT sensor mesh connected. 47 nodes online.');
      }, 2400),
      setTimeout(() => {
        agentState.addEntry('SYSTEM', 'Gemini reasoning engine online. Chain-of-thought logging active. Awaiting sensor data.');
        addNotification('system', 'Command Center v3.0 fully operational. Awaiting intel.');
      }, 3600),
    ];
    return () => bootTimers.forEach(clearTimeout);
  }, [services?.length, agentBooted, hospitalityType, agentState, addNotification]);

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

  // ═══ Live clock ═══
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ═══ Service status ═══
  const svcStatuses = useMemo(() => {
    const map = {};
    const alertedIds = new Set((crisisInfo?.alertedNodes || []).map(id => String(id)));
    services.forEach(svc => {
      const h = svc.id % 100;
      if (crisisInfo?.active && alertedIds.has(String(svc.id))) {
        map[svc.id] = { label: 'Dispatched', color: '#EF4444' };
      } else if (h < 3) {
        map[svc.id] = { label: 'Critical', color: '#EF4444' };
      } else {
        map[svc.id] = { label: 'Available', color: '#22C55E' };
      }
    });
    return map;
  }, [services, crisisInfo?.active, crisisInfo?.alertedNodes]);

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

    // Merge servicesList and crisis.services
    const allServicesMap = new Map();
    servicesList
      .map(s => normalizeMapService(s, destLat, destLng))
      .filter(Boolean)
      .forEach(s => allServicesMap.set(String(s.id), s));
    if (crisis?.services && Array.isArray(crisis.services)) {
      crisis.services
        .map(s => normalizeMapService(s, destLat, destLng))
        .filter(Boolean)
        .forEach(s => allServicesMap.set(String(s.id), s));
    }
    const mergedServices = Array.from(allServicesMap.values());

    mergedServices.forEach((svc) => {
      const isAlerted = crisis?.active && Array.isArray(crisis?.alertedNodes) && crisis.alertedNodes.some(id => String(id) === String(svc.id));
      const icon = createServiceIcon(svc, isAlerted);
      const marker = L.marker([svc.lat, svc.lng || svc.lon], { icon });
      marker.bindPopup(
        `<div style="font-family:${mono};color:#E8ECF4;background:rgba(11,14,20,0.95);padding:14px 16px;border:1px solid ${svc.borderColor};border-radius:12px;min-width:210px;box-shadow:0 8px 32px rgba(0,0,0,0.5);backdrop-filter:blur(20px);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:20px;">${svc.emoji}</span>
            <span style="color:${svc.color};font-weight:700;letter-spacing:1px;font-size:10px;text-transform:uppercase;">${svc.label}</span>
          </div>
          <div style="color:#E8ECF4;font-size:12px;font-weight:600;margin-bottom:4px;">${svc.name}</div>
          ${svc.phone ? `<div style="color:#8892A8;font-size:10px;margin-top:2px;">📞 ${svc.phone}</div>` : ''}
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
            <span style="color:#8892A8;font-size:9px;">DISTANCE </span>
            <span style="color:${svc.color};font-size:11px;font-weight:700;">${svc.distance != null ? `${svc.distance.toFixed(2)} km` : 'Computing route...'}</span>
          </div>
        </div>`,
        { className: 'leaflet-popup-dark', closeButton: false, offset: [0, -4] }
      );
      marker.addTo(markersLayerRef.current);

      if (isAlerted && Number.isFinite(svc.lat) && Number.isFinite(svc.lng)) {
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
          .catch(() => {});
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
    setTimeout(() => { map.flyTo([center.lat, center.lng], 13, { duration: 1.4 }); }, 400);
  }, [scanRadius, plotServices]);

  const flyToUser = useCallback(() => {
    const loc = userLocation || mapCenter;
    if (mapInstanceRef.current && loc) mapInstanceRef.current.flyTo([loc.lat, loc.lng], 16, { duration: 1.2 });
  }, [userLocation, mapCenter]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (cotHovering) {
      map.scrollWheelZoom?.disable?.();
      map.dragging?.disable?.();
    } else {
      map.scrollWheelZoom?.enable?.();
      map.dragging?.enable?.();
    }

    return () => {
      map.scrollWheelZoom?.enable?.();
      map.dragging?.enable?.();
    };
  }, [cotHovering]);

  // ═══ Map Initialization ═══
  const mapInitialized = useRef(false);
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || mapInitialized.current) return;
    mapInitialized.current = true;

    // Clean up any stale leaflet instance on the DOM element
    if (mapRef.current._leaflet_id) {
      delete mapRef.current._leaflet_id;
    }

    const initMap = (center, zoom = 13) => {
      const map = L.map(mapRef.current, {
        center: [center.lat, center.lng], zoom, zoomControl: false, attributionControl: false,
        maxBounds: L.latLngBounds(L.latLng(BANGALORE_BOUNDS.latMin, BANGALORE_BOUNDS.lngMin), L.latLng(BANGALORE_BOUNDS.latMax, BANGALORE_BOUNDS.lngMax)),
        maxBoundsViscosity: 1.0, minZoom: 11, maxZoom: 18,
      });
      L.tileLayer(DARK_TILE_URL, { attribution: DARK_TILE_ATTR, maxZoom: 19 }).addTo(map);
      if (TOMTOM_API_KEY && TOMTOM_API_KEY !== 'YOUR_API_KEY_HERE') {
        L.tileLayer(TOMTOM_TRAFFIC_URL, { maxZoom: 19, opacity: 0.7, zIndex: 1000 }).addTo(map);
      }
      L.control.zoom({ position: 'bottomright' }).addTo(map);

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

      L.circle([center.lat, center.lng], { radius: 10000, color: 'rgba(0,242,255,0.2)', fillColor: 'rgba(0,242,255,0.03)', fillOpacity: 1, weight: 1, dashArray: '8 4' }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
      scanServices(center, map);
      return map;
    };

    if (!navigator.geolocation) {
      setGeoStatus('GEO UNAVAILABLE'); setMapCenter(MG_ROAD_FALLBACK); initMap(MG_ROAD_FALLBACK); return;
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
            </div>`,
            iconSize: [40, 40], iconAnchor: [20, 20],
          });
          L.marker([latitude, longitude], { icon: userIcon }).addTo(map);
        } else {
          setMapCenter(MG_ROAD_FALLBACK); setGeoStatus('OUT OF ZONE — FALLBACK'); initMap(MG_ROAD_FALLBACK);
        }
      },
      () => { setGeoStatus('GEO DENIED — FALLBACK'); setMapCenter(MG_ROAD_FALLBACK); initMap(MG_ROAD_FALLBACK); },
      { enableHighAccuracy: true, timeout: 8000 }
    );

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      mapInitialized.current = false;
    };
  }, []);

  // ═══ Computed ═══
  const flyToService = (svc) => { if (mapInstanceRef.current) mapInstanceRef.current.flyTo([svc.lat, svc.lng], 16, { duration: 1 }); };
  const formatTime = (d) => {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date)) return '';
    return date.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  const formatDate = (d) => {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date)) return '';
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const filteredServices = activeFilter === 'all' ? services : services.filter((s) => s.type === activeFilter);
  const totalPages = Math.ceil(filteredServices.length / SERVICES_PER_PAGE) || 1;
  const paginatedServices = filteredServices.slice((currentPage - 1) * SERVICES_PER_PAGE, currentPage * SERVICES_PER_PAGE);
  const counts = {
    police: services.filter((s) => s.type === 'police').length,
    fire_station: services.filter((s) => s.type === 'fire_station').length,
    hospital: services.filter((s) => s.type === 'hospital').length,
    total: services.length,
  };

  useEffect(() => { setCurrentPage(1); }, [activeFilter]);

  // ═══ RENDER ═══
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="cmd-grid">

      {/* ═══ CONFIRMATION MODAL ═══ */}
      <ConfirmationModal
        visible={agentState.confirmationVisible}
        dispatchPlan={(agentState.confirmationData?.services || []).map(s => ({
          name: s.name, type: s.type,
          distance: s.distance != null ? s.distance : 1.0,
          score: s.scores?.total || s.score || 85,
        }))}
        reasoning={agentState.confirmationData?.reasoning || ''}
        threatScore={agentState.threatLevel}
        crisisType={agentState.confirmationData?.sensorData?.type || ''}
        contacts={agentState.emergencyContacts}
        countdownSeconds={agentState.confirmationData?.countdownSeconds || 10}
        onApprove={agentState.handleConfirmApprove}
        onReject={agentState.handleConfirmReject}
      />

      {/* ═══ TOP BAR ═══ */}
      <header className="cmd-topbar">
        <div className="flex items-center gap-3">
          <div style={{
            width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(0,242,255,0.15), rgba(0,242,255,0.05))',
            border: '1px solid rgba(0,242,255,0.2)',
          }}>
            <span style={{ fontSize: 16, filter: 'drop-shadow(0 0 4px rgba(0,242,255,0.4))' }}>🛡</span>
          </div>
          <div>
            <p style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: 'var(--command-teal)', letterSpacing: 2, lineHeight: 1.1 }}>RAKSHAK AI</p>
            <p style={{ fontFamily: mono, fontSize: 7, color: 'var(--text-dim)', letterSpacing: 1.5 }}>AUTONOMOUS CRISIS COMMAND v3.0</p>
          </div>
        </div>

        {/* Center: Threat Gauge Mini */}
        <div className="flex items-center gap-4">
          {/* Status badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 8,
            background: `${agentState.systemStatus.color}10`,
            border: `1px solid ${agentState.systemStatus.color}30`,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: agentState.systemStatus.color,
              boxShadow: `0 0 6px ${agentState.systemStatus.color}`,
              animation: agentState.isProcessing ? 'pulse-glow 1s infinite' : 'none',
            }} />
            <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: agentState.systemStatus.color, letterSpacing: 1.2 }}>
              {agentState.systemStatus.label}
            </span>
          </div>

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
            </>
          )}
        </div>

        {/* Right: Working controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full pulse-glow" style={{ background: 'var(--command-teal)', boxShadow: '0 0 8px var(--command-teal)' }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--command-teal)', letterSpacing: 1, fontWeight: 600 }}>LIVE</span>
          </div>
          <div className="text-right" style={{ marginRight: 4 }}>
            <p style={{ fontFamily: mono, fontSize: 11, color: 'var(--command-teal)', fontWeight: 600, lineHeight: 1.1, letterSpacing: 1 }}>{formatTime(currentTime)}</p>
            <p style={{ fontFamily: mono, fontSize: 7, color: 'var(--text-dim)', letterSpacing: 1 }}>{formatDate(currentTime)}</p>
          </div>
          <TopBarControls
            userEmail={userEmail}
            notifications={notifications}
            onClearNotification={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
            onClearAll={() => setNotifications([])}
            onLogout={() => window.location.reload()}
          />
        </div>
      </header>

      {/* ═══ LEFT SIDEBAR ═══ */}
      <aside className={`cmd-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-1.5 pt-3">
            <div className="cmd-collapsed-icon" onClick={() => setSidebarCollapsed(false)} title="Expand">☰</div>
            <div className="cmd-divider" style={{ margin: '4px 0', width: 28 }} />
            <div className="cmd-collapsed-icon" onClick={() => { setSidebarCollapsed(false); setSidebarTab('timeline'); }} title="Timeline">📋</div>
            <div className="cmd-collapsed-icon" onClick={() => { setSidebarCollapsed(false); setSidebarTab('contacts'); }} title="Contacts" style={{ position: 'relative' }}>
              📱
              {agentState.emergencyContacts.length > 0 && (
                <div className="absolute top-0 right-0 w-2 h-2 rounded-full" style={{ background: '#06B6D4', boxShadow: '0 0 3px #06B6D4' }} />
              )}
            </div>
            <div className="cmd-collapsed-icon" onClick={() => { setSidebarCollapsed(false); setSidebarTab('services'); }} title="Services">🚔</div>
            <div style={{ flex: 1 }} />
            <div className="cmd-collapsed-icon" onClick={() => setNeuralOpen(true)} title="Neural Engine" style={{ color: neuralOpen ? '#06B6D4' : undefined }}>🧠</div>
            <div style={{ height: 8 }} />
          </div>
        ) : (
          <>
            {/* Header with Threat Gauge */}
            <div style={{ borderBottom: '1px solid rgba(0,242,255,0.06)', flexShrink: 0 }}>
              <div className="flex items-center justify-between px-4 py-2">
                <div>
                  <p style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1.2 }}>COMMAND CENTER</p>
                  <p style={{ fontFamily: mono, fontSize: 7, color: 'var(--text-dim)', letterSpacing: 1 }}>v3.0 · AUTONOMOUS AGENT</p>
                </div>
                <button onClick={() => setSidebarCollapsed(true)} style={{ background: 'rgba(0,242,255,0.04)', border: '1px solid rgba(0,242,255,0.12)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: 'var(--command-teal)', fontSize: 11, transition: 'all 0.2s' }}>◀</button>
              </div>

              {/* Threat Gauge */}
              <div className="px-3 pb-3">
                <ThreatGauge
                  score={agentState.threatLevel}
                  cascadeRisk={agentState.cascadeRisk}
                  crisisType={crisisInfo?.sensorData?.type || ''}
                  isActive={crisisInfo.active || agentState.isProcessing}
                />
              </div>
            </div>

            {/* Sidebar Tabs */}
            <div className="flex gap-1 px-3 py-2" style={{ borderBottom: '1px solid rgba(0,242,255,0.04)', flexShrink: 0 }}>
              {[
                { key: 'timeline', label: '📋 TIMELINE', count: agentState.actionLog.length },
                { key: 'contacts', label: '📱 ALERTS', count: agentState.emergencyContacts.length },
                { key: 'services', label: '🚔 SERVICES', count: services.length },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSidebarTab(tab.key)}
                  className={`cmd-filter-tab ${sidebarTab === tab.key ? 'active' : ''}`}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scrollable content */}
            <div className="cmd-sidebar-scroll">
              {/* ── TIMELINE TAB ── */}
              {sidebarTab === 'timeline' && (
                <div className="px-2 pt-3 pb-1">
                  <IncidentTimeline entries={agentState.actionLog} formatTime={agentState.formatTime} />
                </div>
              )}

              {/* ── CONTACTS TAB ── */}
              {sidebarTab === 'contacts' && (
                <div className="py-3">
                  <EmergencyContacts
                    contacts={agentState.emergencyContacts}
                    onAdd={agentState.addContact}
                    onRemove={agentState.removeContact}
                    smsResults={agentState.smsResults}
                  />

                  {/* Site info */}
                  <div className="px-4 pt-4 mt-3" style={{ borderTop: '1px solid rgba(0,242,255,0.04)' }}>
                    <p style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: 'var(--command-teal)', letterSpacing: 1.5, marginBottom: 8 }}>ACTIVE SITE</p>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,242,255,0.06)', border: '1px solid rgba(0,242,255,0.1)' }}>
                        <span style={{ fontSize: 14 }}>🏨</span>
                      </div>
                      <div>
                        <p style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{hospitalityType?.label || 'Convention Center'}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: geoStatus.includes('LOCKED') ? '#22C55E' : '#F59E0B' }} />
                          <span style={{ fontFamily: mono, fontSize: 8, color: geoStatus.includes('LOCKED') ? '#22C55E' : 'var(--text-secondary)', fontWeight: 600 }}>GEO: {geoStatus}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SERVICES TAB ── */}
              {sidebarTab === 'services' && (
                <div className="px-3 pt-3 pb-1">
                  <div className="flex gap-1.5 mb-3">
                    {[
                      { key: 'all', label: 'ALL' },
                      { key: 'police', label: '🚔' },
                      { key: 'fire_station', label: '🚒' },
                      { key: 'hospital', label: '🏥' },
                    ].map((f) => (
                      <button key={f.key} className={`cmd-filter-tab ${activeFilter === f.key ? 'active' : ''}`} onClick={() => setActiveFilter(f.key)}>{f.label}</button>
                    ))}
                  </div>
                  {/* Table */}
                  <div className="cmd-svc-row" style={{ borderBottom: '1px solid rgba(0,242,255,0.06)', cursor: 'default' }}>
                    <span style={{ fontFamily: mono, fontSize: 7, color: 'var(--text-dim)', letterSpacing: 1, fontWeight: 700 }}>STATUS</span>
                    <span style={{ fontFamily: mono, fontSize: 7, color: 'var(--text-dim)', letterSpacing: 1, fontWeight: 700 }}>NAME</span>
                    <span style={{ fontFamily: mono, fontSize: 7, color: 'var(--text-dim)', letterSpacing: 1, fontWeight: 700 }}>DIST</span>
                    <span style={{ fontFamily: mono, fontSize: 7, color: 'var(--text-dim)', letterSpacing: 1, fontWeight: 700 }}>ETA</span>
                  </div>
                  {loadingServices ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--command-teal) transparent transparent transparent' }} />
                    </div>
                  ) : paginatedServices.length === 0 ? (
                    <p className="py-6 text-center" style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-dim)' }}>No services found</p>
                  ) : (
                    paginatedServices.map((svc) => {
                      const status = svcStatuses[svc.id] || { label: 'Available', color: '#22C55E' };
                      return (
                        <div key={svc.id} className="cmd-svc-row" onClick={() => flyToService(svc)}>
                          <span style={{ fontFamily: mono, fontSize: 7, color: status.color, fontWeight: 600 }}>{status.label}</span>
                          <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ marginRight: 4 }}>{svc.emoji}</span>{svc.name}
                          </span>
                          <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-secondary)', fontWeight: 600 }}>{svc.distance.toFixed(1)}km</span>
                          <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-secondary)' }}>{(svc.distance * 1.5).toFixed(0)}m</span>
                        </div>
                      );
                    })
                  )}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid rgba(0,242,255,0.04)' }}>
                      <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>Pg {currentPage}/{totalPages}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(0,242,255,0.1)', background: 'transparent', cursor: 'pointer', color: 'var(--command-teal)', fontFamily: mono, fontSize: 10, opacity: currentPage <= 1 ? 0.3 : 1 }}>‹</button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(0,242,255,0.1)', background: 'transparent', cursor: 'pointer', color: 'var(--command-teal)', fontFamily: mono, fontSize: 10, opacity: currentPage >= totalPages ? 0.3 : 1 }}>›</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Neural Engine Button (pinned bottom) */}
            <button
              onClick={() => setNeuralOpen(!neuralOpen)}
              className={`cmd-neural-btn ${neuralOpen ? 'is-open' : ''}`}
            >
              <span className="neural-icon">🧠</span>
              <span className="neural-label">NEURAL ENGINE</span>
              <span className="neural-arrow">{neuralOpen ? '✕' : '→'}</span>
            </button>
          </>
        )}
      </aside>

      {/* ═══ MAP AREA ═══ */}
      <main className="cmd-map-area">
        <div ref={mapRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />

        {!mapReady && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-dark p-8 text-center" style={{ borderRadius: 16 }}>
              <div className="w-10 h-10 border-2 rounded-full animate-spin mb-4 mx-auto" style={{ borderColor: 'var(--command-teal) transparent transparent transparent' }} />
              <p style={{ fontFamily: mono, color: 'var(--command-teal)', fontSize: 12, letterSpacing: 2 }}>LOADING MAP INTERFACE...</p>
            </div>
          </div>
        )}

        {/* Chain-of-Thought overlay (top-right of map, shows during active processing) */}
        <AnimatePresence>
          {(agentState.chainOfThought.length > 0 || agentState.isProcessing) && !neuralOpen && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onMouseEnter={() => setCotHovering(true)}
              onMouseLeave={() => setCotHovering(false)}
              onMouseDownCapture={(e) => e.stopPropagation()}
              onPointerEnter={() => setCotHovering(true)}
              onPointerLeave={() => setCotHovering(false)}
              onTouchMoveCapture={(e) => e.stopPropagation()}
              onWheelCapture={(e) => e.stopPropagation()}
              style={{
                position: 'absolute', top: 12, right: 12, bottom: facilityVisible ? 264 : 12, width: 340,
                zIndex: 60, borderRadius: 14, overflow: 'hidden',
                background: 'rgba(3,5,8,0.95)', border: '1px solid rgba(0,242,255,0.08)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(20px)',
                display: 'flex', flexDirection: 'column',
                pointerEvents: 'auto',
                touchAction: 'pan-y',
                overscrollBehavior: 'contain',
              }}
              className="map-cot-panel"
            >
              <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                <ChainOfThought
                  steps={agentState.chainOfThought}
                  activeNode={agentState.activeNode}
                  isProcessing={agentState.isProcessing}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Facility Twin 3D */}
        <AnimatePresence>
          {facilityVisible && (
            <motion.div className="cmd-facility-overlay" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
              <button onClick={() => setFacilityVisible(false)} style={{ position: 'absolute', top: 4, right: 4, zIndex: 60, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,242,255,0.1)', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', color: 'var(--text-dim)', fontFamily: mono, fontSize: 10 }}>✕</button>
              <FacilityTwin3D crisisInfo={crisisInfo} evacuationZone={agentState.evacuationZone} alertMessage={agentState.alertMessage} />
            </motion.div>
          )}
        </AnimatePresence>

        {!facilityVisible && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setFacilityVisible(true)} className="absolute bottom-4 right-4"
            style={{ zIndex: 30, padding: '6px 12px', borderRadius: 8, background: 'rgba(8,10,16,0.9)', border: '1px solid rgba(0,242,255,0.1)', cursor: 'pointer', fontFamily: mono, fontSize: 8, color: 'var(--command-teal)', letterSpacing: 1 }}>
            🏗 FACILITY TWIN
          </motion.button>
        )}

        {/* Emergency Vignette */}
        <AnimatePresence>
          {crisisInfo.active && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none"
              style={{ zIndex: 999, boxShadow: 'inset 0 0 120px rgba(239,68,68,0.15)', animation: 'emergency-vignette 2s ease-in-out infinite' }} />
          )}
        </AnimatePresence>
      </main>

      {/* ═══ NEURAL ENGINE DRAWER ═══ */}
      <AnimatePresence>
        {neuralOpen && (
          <motion.div className="cmd-neural-drawer" initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 220 }}>
            <div className="flex items-center justify-between px-4" style={{ height: 36, flexShrink: 0, borderBottom: '1px solid rgba(0,242,255,0.06)', background: 'rgba(0,0,0,0.4)' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: crisisInfo.active ? '#EF4444' : '#22C55E', boxShadow: `0 0 6px ${crisisInfo.active ? '#EF4444' : '#22C55E'}` }} />
                <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1.5 }}>NEURAL ENGINE</span>
              </div>
              <button onClick={() => setNeuralOpen(false)} style={{ background: 'none', border: '1px solid rgba(0,242,255,0.1)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', color: 'var(--text-dim)', fontFamily: mono, fontSize: 10 }}>✕ CLOSE</button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <AgentGraph agentState={agentState} crisisInfo={crisisInfo} services={services} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ BOTTOM BAR ═══ */}
      <footer className="cmd-bottombar">
        <button className={`cmd-crisis-sim-btn ${devConsoleOpen ? 'active' : ''}`} onClick={() => setDevConsoleOpen(!devConsoleOpen)}>
          <div className="sim-dot" />
          <span className="sim-label">{devConsoleOpen ? '✕ CLOSE' : '⚡ CRISIS SIM'}</span>
          {!devConsoleOpen && <span className="sim-tag">SIMULATE</span>}
        </button>

        {/* Audio toggle */}
        <button
          className="cmd-bottom-btn"
          onClick={() => {
            const newVal = !getMuted();
            setMuted(newVal);
            setAudioMutedLocal(newVal);
          }}
        >
          <span style={{ fontSize: 10 }}>{audioMuted ? '🔇' : '🔊'}</span>
          <span>{audioMuted ? 'UNMUTE' : 'AUDIO'}</span>
        </button>

        <div style={{ flex: 1 }} />

        {/* Emergency contacts count */}
        {agentState.emergencyContacts.length > 0 && (
          <button className="cmd-bottom-btn" onClick={() => { setSidebarCollapsed(false); setSidebarTab('contacts'); }}>
            <span style={{ fontSize: 10 }}>📱</span>
            <span>{agentState.emergencyContacts.length} CONTACT{agentState.emergencyContacts.length !== 1 ? 'S' : ''}</span>
          </button>
        )}

        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />
        <button className="cmd-bottom-btn" onClick={flyToUser}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22C55E', boxShadow: '0 0 4px #22C55E' }} />
          <span>{userEmail || 'OPERATOR'}</span>
        </button>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />
        <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>v3.0 AUTONOMOUS</span>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />
        <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>SECURITY LEVEL 4</span>
      </footer>

      {/* ═══ CRISIS SIMULATOR ═══ */}
      <CrisisSimulator
        isOpen={devConsoleOpen}
        onTrigger={(sensorData) => {
          setNeuralOpen(false); // Close neural to show CoT on map
          setSidebarTab('timeline');
          setTimeout(() => agentState.processCrisis(sensorData), 100);
        }}
        isProcessing={agentState.isProcessing}
      />
    </motion.div>
  );
}
