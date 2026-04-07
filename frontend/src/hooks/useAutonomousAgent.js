import { useState, useCallback, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

// ─── Status & Category enums (unchanged) ────────────────────────────────────
export const STATUS = {
  NOMINAL:     { label: 'NOMINAL',          color: '#22C55E', glow: '0 0 12px rgba(34,197,94,0.4)' },
  MONITORING:  { label: 'MONITORING',       color: '#3B82F6', glow: '0 0 12px rgba(59,130,246,0.4)' },
  ANALYZING:   { label: 'AI ANALYZING...', color: '#F59E0B', glow: '0 0 14px rgba(245,158,11,0.5)' },
  CRISIS:      { label: 'CRISIS DETECTED',  color: '#EF4444', glow: '0 0 16px rgba(239,68,68,0.6)' },
  DISPATCHING: { label: 'DISPATCHING',      color: '#A855F7', glow: '0 0 14px rgba(168,85,247,0.5)' },
  RESOLVED:    { label: 'RESOLVED',         color: '#22C55E', glow: '0 0 12px rgba(34,197,94,0.4)' },
};

// 5-tier threat system matching the Python math engine
export const THREAT_LEVELS = {
  GREEN:    { label: 'GREEN',    color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   score_range: '0–30'   },
  YELLOW:   { label: 'YELLOW',   color: '#EAB308', bg: 'rgba(234,179,8,0.12)',   score_range: '31–55'  },
  ORANGE:   { label: 'ORANGE',   color: '#F97316', bg: 'rgba(249,115,22,0.12)',  score_range: '56–75'  },
  RED:      { label: 'RED',      color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   score_range: '76–90'  },
  CRITICAL: { label: 'CRITICAL', color: '#DC2626', bg: 'rgba(220,38,38,0.16)',   score_range: '91–100' },
};

export const CATEGORIES = {
  SYSTEM:    { label: 'SYSTEM',    color: '#00F2FF', bg: 'rgba(0,242,255,0.08)',   border: 'rgba(0,242,255,0.2)' },
  DETECTION: { label: 'DETECTION', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  ANALYSIS:  { label: 'ANALYSIS',  color: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)' },
  DECISION:  { label: 'DECISION',  color: '#A855F7', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)' },
  DISPATCH:  { label: 'DISPATCH',  color: '#EF4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)' },
  RESOLVED:  { label: 'RESOLVED',  color: '#22C55E', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)' },
  INTEL:     { label: 'INTEL',     color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
  COMMS:     { label: 'COMMS',     color: '#06B6D4', bg: 'rgba(6,182,212,0.06)',  border: 'rgba(6,182,212,0.15)' },
};

const PYTHON_WS_URL = import.meta.env.VITE_PYTHON_AGENT_WS_URL || 'ws://localhost:8000';
const NODE_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://rakshak-backend-wbuz.onrender.com';

export default function useAutonomousAgent({ hospitalityType, services, mapCenter, onCrisisUpdate }) {
  const [systemStatus, setSystemStatus]     = useState(STATUS.NOMINAL);
  const [actionLog, setActionLog]           = useState([]);
  const [commsLog, setCommsLog]             = useState([]);
  const [evacuationZone, setEvacuationZone] = useState(null);
  const [alertMessage, setAlertMessage]     = useState(null);
  const [threatLevel, setThreatLevel]       = useState(0);         // numeric 0-100
  const [threatTier, setThreatTier]         = useState('GREEN');   // GREEN/YELLOW/ORANGE/RED/CRITICAL
  const [isProcessing, setIsProcessing]     = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState([]);
  const [scanCount, setScanCount]           = useState(0);
  const [activeNode, setActiveNode]         = useState(null);      // which LangGraph node is running
  const [serviceScores, setServiceScores]   = useState([]);        // scored services from Python
  const [cascadeRisk, setCascadeRisk]       = useState(0);         // cascade probability

  const pythonWsRef = useRef(null);
  const sessionIdRef = useRef(null);

  const formatTime = (d) =>
    d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const addEntry = useCallback((category, message, meta = null) => {
    setActionLog((prev) => {
      const entry = { id: Date.now() + Math.random(), timestamp: new Date(), category, message, meta };
      return [...prev, entry].slice(-60);
    });
  }, []);

  const addComms = useCallback((line) => {
    setCommsLog((prev) => [...prev, { id: Date.now() + Math.random(), timestamp: new Date(), text: line }].slice(-30));
  }, []);

  const incrementScan = useCallback(() => setScanCount((p) => p + 1), []);

  const triggerEvacuation = useCallback((zone, message) => {
    setEvacuationZone(zone);
    setAlertMessage(message);
    addEntry('DISPATCH', `🚨 Alerting occupants in ${zone}`);
  }, [addEntry]);

  // ── Python LangGraph WebSocket ───────────────────────────────────────────
  function handlePythonMessage(msg) {
    switch (msg.type) {
      case 'connected':
        addComms('✅ PYTHON LANGGRAPH AGENT NEURAL LINK ESTABLISHED.');
        break;

      case 'agent_start':
        setIsProcessing(true);
        setSystemStatus(STATUS.ANALYZING);
        setActiveNode('detect_crisis');
        addComms('🧠 LANGGRAPH AGENT ACTIVATED — RUNNING 5-NODE CRISIS PIPELINE...');
        break;

      case 'node_start':
        setActiveNode(msg.node);
        addComms(`▶ NODE [${msg.node.toUpperCase().replace('_', ' ')}] EXECUTING...`);
        break;

      case 'threat_assessment':
        setThreatLevel(msg.threat_score ?? 0);
        setThreatTier(msg.threat_level ?? 'GREEN');
        setCascadeRisk(msg.cascade_risk ?? 0);
        addEntry('ANALYSIS', `🎯 ThreatScore: ${msg.threat_score}/100 (${msg.threat_level}) | Cascade Risk: ${(msg.cascade_risk * 100).toFixed(1)}% | Severity: ${msg.severity}/10`);
        if ((msg.threat_score ?? 0) > 55) {
          setSystemStatus(STATUS.CRISIS);
        }
        break;

      case 'intel':
        addEntry('INTEL', `📡 Overpass API: Found ${msg.data?.services_found ?? 0} real emergency services nearby. Traffic checked for ${msg.data?.traffic_checked ?? 0}.`);
        break;

      case 'scores': {
        const scores = msg.data ?? [];
        setServiceScores(scores);
        addEntry('ANALYSIS', `📊 Service Scoring Complete. Best: ${scores[0]?.name ?? 'N/A'} (${scores[0]?.total ?? 0} pts). Refined ThreatScore: ${msg.refined_threat_score}`);
        break;
      }

      case 'decision': {
        const dispatched = msg.dispatched_services || [msg.best_service || {}];
        setSystemStatus(STATUS.DISPATCHING);
        
        const progress = dispatched.map(svc => ({
          name:     svc.name ?? 'Unit',
          type:     svc.service_type ?? svc.type ?? 'responder',
          progress: 100,
          done:     true,
          reason:   msg.reasoning ?? 'Agent dispatched based on score analysis.',
          score:    svc.scores?.total,
          distance: svc.distance_km,
        }));
        setDispatchProgress(progress);
        
        const names = dispatched.map(s => s.name).join(', ');
        addEntry('DISPATCH', `✅ DISPATCH CONFIRMED: ${names} — ${msg.reasoning ?? ''}`);

        // Update map
        const types = [...new Set(dispatched.map(s => s.service_type ?? s.type))].filter(Boolean);
        const primaryService = dispatched[0] || {};
        onCrisisUpdate?.({
          active:          true,
          types:           types.length > 0 ? types : ['hospital'],
          alertedNodes:    dispatched.map(s => s.id),
          sensorData:      null,
          services:        dispatched,
          respondersActive: true,
          bestService:     primaryService,
        });
        break;
      }

      case 'evacuation':
        if (msg.zones?.length > 0) {
          triggerEvacuation(msg.zones[0], msg.message);
          addEntry('DISPATCH', `🚨 Evacuation triggered: ${msg.zones.join(', ')}`);
        }
        break;

      case 'node_result':
        addEntry('ANALYSIS', `✔ [${(msg.node ?? '').toUpperCase().replace(/_/g, ' ')}] ${msg.summary ?? ''}`);
        break;

      case 'resolved':
        setSystemStatus(STATUS.RESOLVED);
        setThreatLevel(15);
        setIsProcessing(false);
        setActiveNode(null);
        addEntry('RESOLVED', `✅ ${msg.summary ?? 'Crisis fully handled by LangGraph agent.'}`);
        addComms('ALL UNITS NOTIFIED. LANGGRAPH AGENT RETURNING TO MONITOR STATE.');
        setTimeout(() => {
          setSystemStatus(STATUS.NOMINAL);
          setThreatLevel(0);
          setThreatTier('GREEN');
          setDispatchProgress([]);
          setEvacuationZone(null);
          setAlertMessage(null);
          setServiceScores([]);
          setCascadeRisk(0);
          onCrisisUpdate?.({ active: false, type: null });
        }, 10000);
        break;

      case 'error':
        addEntry('SYSTEM', `⚠️ Agent error: ${msg.message}`);
        setIsProcessing(false);
        setActiveNode(null);
        break;
    }
  }

  // ── Connect to Python WebSocket ───────────────────────────────────────────
  useEffect(() => {
    const sid = `ui-${Date.now()}`;
    sessionIdRef.current = sid;

    let ws;
    let reconnectTimer;

    function connect() {
      try {
        ws = new WebSocket(`${PYTHON_WS_URL}/ws/${sid}`);
        pythonWsRef.current = ws;

        ws.onopen  = () => addComms('🔗 Python LangGraph agent WebSocket connected.');
        ws.onmessage = (ev) => {
          try { handlePythonMessage(JSON.parse(ev.data)); } catch (_) {}
        };
        ws.onclose = () => {
          addComms('⚡ Python agent WS disconnected — will retry...');
          reconnectTimer = setTimeout(connect, 4000);
        };
        ws.onerror = () => {};   // handled by onclose
      } catch (_) {}
    }

    connect();

    // ── Socket.IO → Node.js (kept for audit log compatibility) ──────────────
    const socket = io(NODE_BACKEND_URL, { transports: ['websocket', 'polling'] });
    socket.on('connect',    () => addComms('📡 Node.js relay Socket.IO uplink active.'));
    socket.on('audit_log',  (entry) => setActionLog((p) => [...p, entry].slice(-60)));
    socket.on('disconnect', () => {});

    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
      socket.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── processCrisis — send event to Python agent via WS ────────────────────
  const processCrisis = useCallback(async (sensorData) => {
    setSystemStatus(STATUS.ANALYZING);
    setThreatLevel(40);
    setIsProcessing(true);
    onCrisisUpdate?.({ active: true, type: sensorData?.type ?? null, analyzing: true, sensorData });
    addComms('📤 FORWARDING SENSOR PAYLOAD TO LANGGRAPH AGENT...');
    addEntry('DETECTION', `Anomaly: ${(sensorData?.type ?? 'UNKNOWN').toUpperCase()} @ ${sensorData?.location ?? '?'} | Sensor: ${sensorData?.sensor_id ?? 'N/A'}`);

    const lat = mapCenter?.lat ?? 12.9716;
    const lng = mapCenter?.lng ?? mapCenter?.lon ?? 77.5946;

    const ws = pythonWsRef.current;

    if (ws && ws.readyState === WebSocket.OPEN) {
      // ── PRIMARY: send to Python LangGraph agent ───────────────────────────
      ws.send(JSON.stringify({ type: 'crisis_event', data: sensorData, venue_lat: lat, venue_lon: lng }));
      addComms('✅ CRISIS EVENT SENT TO LANGGRAPH NEURAL ENGINE.');

    } else {
      // ── FALLBACK: local simulation when Python agent is offline ───────────
      addComms('⚠️ PYTHON AGENT OFFLINE — ACTIVATING LOCAL SIMULATION FALLBACK.');
      _runLocalFallback(sensorData, lat, lng);
    }
  }, [mapCenter, onCrisisUpdate, addComms, addEntry]); // eslint-disable-line react-hooks/exhaustive-deps

  function _runLocalFallback(sensorData, _lat, _lng) {
    const crisisType = sensorData?.type ?? 'smoke';
    const typeMap    = { smoke: 'fire_station', fire: 'fire_station', health: 'hospital', cardiac: 'hospital', security: 'police', breach: 'police', power: 'fire_station', water: 'fire_station' };
    const targetType = typeMap[crisisType] ?? 'police';

    setTimeout(() => { addEntry('ANALYSIS', `Gemini fallback: ${crisisType} at ${sensorData?.location}. Threat assessment...`); setThreatLevel(70); }, 1500);
    setTimeout(() => { setSystemStatus(STATUS.CRISIS); setThreatLevel(88); addEntry('DECISION', `Dispatching ${targetType.replace('_', ' ')} units.`); }, 3500);
    setTimeout(() => {
      setSystemStatus(STATUS.DISPATCHING);
      const matched = services?.filter(s => s.type === targetType).slice(0, 2) ?? [];
      setDispatchProgress(matched.map(s => ({ name: s.name, type: s.type, progress: 100, done: true, reason: `Closest unit — ${s.distance?.toFixed(1)}km`, score: null })));
      if (sensorData?.location) triggerEvacuation('main-area', `Emergency: ${crisisType} at ${sensorData.location}`);
      onCrisisUpdate?.({ active: true, type: targetType, alertedNodes: matched.map(s => s.id), sensorData, services: matched, respondersActive: true });
    }, 5500);
    setTimeout(() => {
      setSystemStatus(STATUS.RESOLVED); setThreatLevel(10); setIsProcessing(false);
      addEntry('RESOLVED', 'Local fallback response complete.');
      setTimeout(() => { setSystemStatus(STATUS.NOMINAL); setThreatLevel(0); setDispatchProgress([]); setEvacuationZone(null); setAlertMessage(null); onCrisisUpdate?.({ active: false, type: null }); }, 8000);
    }, 12000);
  }

  return {
    systemStatus,
    actionLog,
    commsLog,
    threatLevel,
    threatTier,
    cascadeRisk,
    isProcessing,
    dispatchProgress,
    scanCount,
    evacuationZone,
    alertMessage,
    activeNode,
    serviceScores,
    processCrisis,
    addEntry,
    addComms,
    incrementScan,
    formatTime,
  };
}
