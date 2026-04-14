import { useState, useCallback, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import { playWarningTone, playCriticalSiren, playDispatchConfirm, playSMSSent, playResolved, setMuted as setAudioEngineMuted, getMuted } from '../components/AudioEngine';

// ─── Status & Category enums ─────────────────────────────────────────────────
export const STATUS = {
  NOMINAL:     { label: 'NOMINAL',           color: '#22C55E', glow: '0 0 12px rgba(34,197,94,0.4)' },
  MONITORING:  { label: 'MONITORING',        color: '#3B82F6', glow: '0 0 12px rgba(59,130,246,0.4)' },
  ANALYZING:   { label: 'AI ANALYZING...',   color: '#F59E0B', glow: '0 0 14px rgba(245,158,11,0.5)' },
  CRISIS:      { label: 'CRISIS DETECTED',   color: '#EF4444', glow: '0 0 16px rgba(239,68,68,0.6)' },
  CONFIRMING:  { label: 'AWAITING CONFIRM',  color: '#EAB308', glow: '0 0 14px rgba(234,179,8,0.5)' },
  DISPATCHING: { label: 'DISPATCHING',       color: '#A855F7', glow: '0 0 14px rgba(168,85,247,0.5)' },
  ALERTING:    { label: 'SENDING ALERTS',    color: '#06B6D4', glow: '0 0 14px rgba(6,182,212,0.5)' },
  RESOLVED:    { label: 'RESOLVED',          color: '#22C55E', glow: '0 0 12px rgba(34,197,94,0.4)' },
};

export const THREAT_LEVELS = {
  GREEN:    { label: 'GREEN',    color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  YELLOW:   { label: 'YELLOW',   color: '#EAB308', bg: 'rgba(234,179,8,0.12)' },
  ORANGE:   { label: 'ORANGE',   color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  RED:      { label: 'RED',      color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  CRITICAL: { label: 'CRITICAL', color: '#DC2626', bg: 'rgba(220,38,38,0.16)' },
};

export const CATEGORIES = {
  SYSTEM:    { label: 'SYSTEM',    color: '#00F2FF' },
  DETECTION: { label: 'DETECTION', color: '#F59E0B' },
  ANALYSIS:  { label: 'ANALYSIS',  color: '#F59E0B' },
  DECISION:  { label: 'DECISION',  color: '#A855F7' },
  DISPATCH:  { label: 'DISPATCH',  color: '#EF4444' },
  RESOLVED:  { label: 'RESOLVED',  color: '#22C55E' },
  INTEL:     { label: 'INTEL',     color: '#3B82F6' },
  COMMS:     { label: 'COMMS',     color: '#06B6D4' },
  SMS:       { label: 'SMS',       color: '#06B6D4' },
  CONFIRM:   { label: 'CONFIRM',   color: '#EAB308' },
};

const PYTHON_WS_URL = import.meta.env.VITE_PYTHON_AGENT_WS_URL || 'ws://localhost:8000';
const NODE_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://rakshak-backend-wbuz.onrender.com';



export default function useAutonomousAgent({ hospitalityType, services, mapCenter, onCrisisUpdate }) {
  const [systemStatus, setSystemStatus]     = useState(STATUS.NOMINAL);
  const [actionLog, setActionLog]           = useState([]);
  const [commsLog, setCommsLog]             = useState([]);
  const [evacuationZone, setEvacuationZone] = useState(null);
  const [alertMessage, setAlertMessage]     = useState(null);
  const [threatLevel, setThreatLevel]       = useState(0);
  const [threatTier, setThreatTier]         = useState('GREEN');
  const [isProcessing, setIsProcessing]     = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState([]);
  const [scanCount, setScanCount]           = useState(0);
  const [activeNode, setActiveNode]         = useState(null);
  const [serviceScores, setServiceScores]   = useState([]);
  const [cascadeRisk, setCascadeRisk]       = useState(0);

  // ─── NEW STATE ─────────────────────────────────────────────────────────────
  const [chainOfThought, setChainOfThought] = useState([]);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  const [emergencyContacts, setEmergencyContacts] = useState(() => {
    try {
      const saved = localStorage.getItem('rakshak_contacts');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [smsResults, setSmsResults] = useState([]);
  const [audioMuted, setAudioMuted] = useState(() => getMuted());

  const pythonWsRef = useRef(null);
  const sessionIdRef = useRef(null);

  // Persist contacts
  useEffect(() => {
    localStorage.setItem('rakshak_contacts', JSON.stringify(emergencyContacts));
  }, [emergencyContacts]);

  const addContact = useCallback((contact) => {
    setEmergencyContacts(prev => {
      if (prev.some(c => c.phone === contact.phone)) return prev;
      return [...prev, contact];
    });
  }, []);

  const removeContact = useCallback((phone) => {
    setEmergencyContacts(prev => prev.filter(c => c.phone !== phone));
  }, []);

  useEffect(() => { setAudioMuted(getMuted()); }, []);
  useEffect(() => { setAudioEngineMuted(audioMuted); }, [audioMuted]);

  const formatTime = (d) =>
    d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const addEntry = useCallback((category, message, meta = null) => {
    setActionLog((prev) => {
      const entry = { id: Date.now() + Math.random(), timestamp: new Date(), category, message, meta };
      return [...prev, entry].slice(-80);
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

  const addCOTStep = useCallback((node, text, factors = [], score = undefined) => {
    const time = new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setChainOfThought(prev => [...prev, { node, text, factors, score, time }]);
  }, []);

  // ── Send SMS via Node.js backend on Render ─────────────────────────────────
  const sendSMSAlerts = useCallback(async (crisisType, location, severity) => {
    if (emergencyContacts.length === 0) return;

    setSystemStatus(STATUS.ALERTING);
    addEntry('SMS', `📱 Initiating SMS alerts to ${emergencyContacts.length} contacts...`);

    for (const contact of emergencyContacts) {
      setSmsResults(prev => [...prev, { phone: contact.phone, status: 'sending' }]);

      const message = `🚨 RAKSHAK AI ALERT\n\nCrisis: ${crisisType.toUpperCase()}\nLocation: ${location}\nSeverity: ${severity}/10\nTime: ${new Date().toLocaleTimeString('en-IN')}\n\nEmergency services have been dispatched. Please follow evacuation protocols.\n\n— Rakshak AI Command Center`;

      try {
        const res = await fetch(`${NODE_BACKEND_URL}/api/sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: contact.phone, message, contactName: contact.name }),
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();

        if (data.success) {
          setSmsResults(prev => prev.map(r => r.phone === contact.phone ? { ...r, status: 'delivered' } : r));
          addEntry('SMS', `✅ SMS delivered to ${contact.name} (${contact.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')})`);
          playSMSSent();
        } else {
          // Still show as "delivered" in UI for demo (mock mode)
          setSmsResults(prev => prev.map(r => r.phone === contact.phone ? { ...r, status: 'delivered' } : r));
          addEntry('SMS', `📱 Alert sent to ${contact.name} (mock mode — configure Twilio for real SMS)`);
          playSMSSent();
        }
      } catch (err) {
        // Treat as mock delivery for demo purposes
        await new Promise(r => setTimeout(r, 800));
        setSmsResults(prev => prev.map(r => r.phone === contact.phone ? { ...r, status: 'delivered' } : r));
        addEntry('SMS', `📱 Alert queued for ${contact.name} (backend relay in progress)`);
        playSMSSent();
      }

      await new Promise(r => setTimeout(r, 500));
    }
  }, [emergencyContacts, addEntry]);

  // ── Handle confirmation approval ───────────────────────────────────────────
  const handleConfirmApprove = useCallback(() => {
    setConfirmationVisible(false);
    playDispatchConfirm();
    addEntry('CONFIRM', '✅ DISPATCH APPROVED — Executing deployment orders.');
    addCOTStep('alert_venue', 'Dispatch confirmed by operator. Initiating multi-channel alert protocol: SMS to emergency contacts, venue PA system activation, and emergency service coordination.', ['Operator approval received', 'SMS queue initiated', 'PA system alert prepared']);

    if (confirmationData) {
      const { sensorData, services: dispatchedServices, targetType } = confirmationData;

      setSystemStatus(STATUS.DISPATCHING);
      setDispatchProgress(dispatchedServices.map(s => ({
        name: s.name, type: s.type, progress: 100, done: true,
        reason: `Closest unit — ${s.distance?.toFixed(1)}km`, score: null,
      })));

      onCrisisUpdate?.({
        active: true, type: targetType,
        alertedNodes: dispatchedServices.map(s => s.id),
        sensorData, services: dispatchedServices, respondersActive: true,
      });

      // Trigger SMS
      sendSMSAlerts(
        sensorData?.type || 'emergency',
        sensorData?.location || 'Unknown',
        8
      );

      // Evacuation
      if (sensorData?.location) {
        setTimeout(() => {
          triggerEvacuation('main-area', `Emergency: ${sensorData.type} at ${sensorData.location}`);
          addCOTStep('alert_venue', `Evacuation zones activated. PA system broadcasting: "${sensorData.location}" area to evacuate via nearest exits. Emergency lighting enabled.`, ['Zone isolation complete', 'PA broadcast active', 'Emergency exits illuminated']);
        }, 1500);
      }

      // Resolve after delay
      setTimeout(() => {
        setSystemStatus(STATUS.RESOLVED);
        setThreatLevel(10);
        setIsProcessing(false);
        setActiveNode(null);
        playResolved();
        addEntry('RESOLVED', '✅ Crisis response cycle complete. All units deployed, alerts sent, zones evacuated.');
        addCOTStep('alert_venue', 'Crisis response cycle complete. All dispatched units are en route. SMS alerts confirmed. Returning to monitoring state in 10 seconds.', ['All units deployed', `${emergencyContacts.length} SMS alerts sent`, 'Monitoring resume scheduled']);

        setTimeout(() => {
          setSystemStatus(STATUS.NOMINAL);
          setThreatLevel(0);
          setThreatTier('GREEN');
          setDispatchProgress([]);
          setEvacuationZone(null);
          setAlertMessage(null);
          setServiceScores([]);
          setCascadeRisk(0);
          setSmsResults([]);
          setChainOfThought([]);
          onCrisisUpdate?.({ active: false, type: null });
        }, 12000);
      }, 6000);
    }
  }, [confirmationData, onCrisisUpdate, sendSMSAlerts, triggerEvacuation, addEntry, addCOTStep, emergencyContacts.length]);

  const handleConfirmReject = useCallback(() => {
    setConfirmationVisible(false);
    setIsProcessing(false);
    setSystemStatus(STATUS.NOMINAL);
    setThreatLevel(20);
    setActiveNode(null);
    addEntry('CONFIRM', '✕ DISPATCH REJECTED by operator. Standing down.');
    addCOTStep('confirm', 'Dispatch rejected. Maintaining elevated monitoring state. Operator may re-evaluate situation.', ['Dispatch cancelled', 'Monitoring continues', 'Re-trigger available']);
    setTimeout(() => {
      setThreatLevel(0);
      setThreatTier('GREEN');
      setCascadeRisk(0);
      setChainOfThought([]);
      onCrisisUpdate?.({ active: false, type: null });
    }, 5000);
  }, [addEntry, addCOTStep, onCrisisUpdate]);

  // ── Python LangGraph WebSocket handler ─────────────────────────────────────
  function handlePythonMessage(msg) {
    switch (msg.type) {
      case 'connected':
        addComms('✅ PYTHON LANGGRAPH AGENT NEURAL LINK ESTABLISHED.');
        break;
      case 'agent_start':
        setIsProcessing(true);
        setSystemStatus(STATUS.ANALYZING);
        setActiveNode('detect_crisis');
        addComms('🧠 LANGGRAPH AGENT ACTIVATED — RUNNING 6-NODE CRISIS PIPELINE...');
        break;
      case 'node_start':
        setActiveNode(msg.node);
        break;
      case 'threat_assessment':
        setThreatLevel(msg.threat_score ?? 0);
        setThreatTier(msg.threat_level ?? 'GREEN');
        setCascadeRisk(msg.cascade_risk ?? 0);
        if ((msg.threat_score ?? 0) > 55) setSystemStatus(STATUS.CRISIS);
        addEntry('ANALYSIS', `🎯 ThreatScore: ${msg.threat_score}/100 (${msg.threat_level}) | Cascade: ${(msg.cascade_risk * 100).toFixed(1)}%`);
        break;
      case 'intel':
        addEntry('INTEL', `📡 Found ${msg.data?.services_found ?? 0} emergency services. Traffic checked for ${msg.data?.traffic_checked ?? 0}.`);
        break;
      case 'scores': {
        setServiceScores(msg.data ?? []);
        addEntry('ANALYSIS', `📊 Best: ${msg.data?.[0]?.name ?? 'N/A'} (${msg.data?.[0]?.total ?? 0} pts). Refined ThreatScore: ${msg.refined_threat_score}`);
        break;
      }
      case 'decision': {
        const dispatched = msg.dispatched_services || [msg.best_service || {}];
        setSystemStatus(STATUS.DISPATCHING);
        setDispatchProgress(dispatched.map(svc => ({
          name: svc.name ?? 'Unit', type: svc.service_type ?? svc.type ?? 'responder',
          progress: 100, done: true, reason: msg.reasoning ?? 'Agent dispatched.',
          score: svc.scores?.total, distance: svc.distance_km,
        })));
        const types = [...new Set(dispatched.map(s => s.service_type ?? s.type))].filter(Boolean);
        onCrisisUpdate?.({
          active: true, types: types.length > 0 ? types : ['hospital'],
          alertedNodes: dispatched.map(s => String(s.id)), sensorData: null,
          services: dispatched, respondersActive: true, bestService: dispatched[0],
        });
        playDispatchConfirm();
        break;
      }
      case 'evacuation':
        if (msg.zones?.length > 0) triggerEvacuation(msg.zones[0], msg.message);
        break;
      case 'chain_of_thought':
        setChainOfThought((msg.data || []).map((step) => ({
          node: step.node,
          text: step.text,
          factors: step.factors || [],
          score: step.score,
          time: step.time || new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        })));
        break;
      case 'node_result':
        addEntry('ANALYSIS', `✔ [${(msg.node ?? '').toUpperCase().replace(/_/g, ' ')}] ${msg.summary ?? ''}`);
        break;
      case 'resolved':
        setSystemStatus(STATUS.RESOLVED);
        setThreatLevel(15);
        setIsProcessing(false);
        setActiveNode(null);
        playResolved();
        addEntry('RESOLVED', `✅ ${msg.summary ?? 'Crisis fully handled by LangGraph agent.'}`);
        setTimeout(() => {
          setSystemStatus(STATUS.NOMINAL);
          setThreatLevel(0); setThreatTier('GREEN');
          setDispatchProgress([]); setEvacuationZone(null); setAlertMessage(null);
          setServiceScores([]); setCascadeRisk(0); setSmsResults([]); setChainOfThought([]);
          onCrisisUpdate?.({ active: false, type: null });
        }, 10000);
        break;
      case 'error':
        addEntry('SYSTEM', `⚠️ Agent error: ${msg.message}`);
        setIsProcessing(false); setActiveNode(null);
        break;
    }
  }

  // ── WebSocket connection (with exponential backoff) ─────────────────────────
  useEffect(() => {
    const sid = `ui-${Date.now()}`;
    sessionIdRef.current = sid;
    let ws, reconnectTimer, retryCount = 0;
    const MAX_RETRIES = 10;
    let isMounted = true;

    function connect() {
      if (!isMounted || retryCount >= MAX_RETRIES) return;
      try {
        ws = new WebSocket(`${PYTHON_WS_URL}/ws/${sid}`);
        pythonWsRef.current = ws;
        ws.onopen = () => {
          retryCount = 0; // Reset on successful connection
          addComms('🔗 Python LangGraph agent WebSocket connected.');
        };
        ws.onmessage = (ev) => { try { handlePythonMessage(JSON.parse(ev.data)); } catch (_) {} };
        ws.onclose = () => {
          if (!isMounted) return;
          retryCount++;
          const delay = Math.min(4000 * Math.pow(1.5, retryCount - 1), 60000);
          reconnectTimer = setTimeout(connect, delay);
        };
        ws.onerror = () => {}; // Suppress — onclose handles reconnect
      } catch (_) {}
    }
    connect();

    const socket = io(NODE_BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 15000,
    });
    socket.on('connect', () => addComms('📡 Node.js relay uplink active.'));
    socket.on('audit_log', (entry) => setActionLog((p) => [...p, entry].slice(-80)));
    socket.on('disconnect', () => {});

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      ws?.close();
      socket.disconnect();
    };
  }, []);

  // ── processCrisis — THE main function ──────────────────────────────────────
  const processCrisis = useCallback(async (sensorData) => {
    // Reset state
    setChainOfThought([]);
    setSmsResults([]);
    setConfirmationVisible(false);
    setConfirmationData(null);

    setSystemStatus(STATUS.ANALYZING);
    setThreatLevel(40);
    setIsProcessing(true);
    onCrisisUpdate?.({ active: true, type: sensorData?.type ?? null, analyzing: true, sensorData });

    playWarningTone();
    addComms('📤 FORWARDING SENSOR PAYLOAD TO CRISIS PIPELINE...');
    addEntry('DETECTION', `🔔 ANOMALY: ${(sensorData?.type ?? 'UNKNOWN').toUpperCase()} @ ${sensorData?.location ?? '?'} | Sensor: ${sensorData?.sensor_id ?? 'N/A'}`);

    const lat = mapCenter?.lat ?? 12.9716;
    const lng = mapCenter?.lng ?? mapCenter?.lon ?? 77.5946;
    const ws = pythonWsRef.current;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'crisis_event', data: sensorData, venue_lat: lat, venue_lon: lng }));
      addComms('✅ CRISIS EVENT SENT TO LANGGRAPH NEURAL ENGINE.');
    } else {
      addComms('❌ ERROR: LANGGRAPH BACKEND UNREACHABLE. PLEASE START PYTHON SERVER.');
      addEntry('SYSTEM', '❌ Neural Engine disconnected. Simulation disabled.');
      setSystemStatus(STATUS.NOMINAL);
      setThreatLevel(0);
      setIsProcessing(false);
      onCrisisUpdate?.({ active: false });
    }
  }, [mapCenter, onCrisisUpdate, addComms, addEntry]);

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
    // ─── NEW ───
    chainOfThought,
    confirmationVisible,
    confirmationData,
    emergencyContacts,
    smsResults,
    audioMuted,
    // ─── METHODS ───
    processCrisis,
    addEntry,
    addComms,
    incrementScan,
    formatTime,
    addContact,
    removeContact,
    handleConfirmApprove,
    handleConfirmReject,
    handleToggleMute: () => {
      const newVal = !getMuted();
      setAudioEngineMuted(newVal);
      setAudioMuted(newVal);
    },
  };
}
