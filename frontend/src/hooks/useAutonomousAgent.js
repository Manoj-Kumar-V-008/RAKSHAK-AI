import { useState, useCallback, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

// ──────────────────────────────────────────────────────
//  STATUS + CATEGORY ENUMS
// ──────────────────────────────────────────────────────
export const STATUS = {
  NOMINAL:     { label: 'NOMINAL',          color: '#22C55E', glow: '0 0 12px rgba(34,197,94,0.4)' },
  MONITORING:  { label: 'MONITORING',       color: '#3B82F6', glow: '0 0 12px rgba(59,130,246,0.4)' },
  ANALYZING:   { label: 'AI ANALYZING...', color: '#F59E0B', glow: '0 0 14px rgba(245,158,11,0.5)' },
  CRISIS:      { label: 'CRISIS DETECTED',  color: '#EF4444', glow: '0 0 16px rgba(239,68,68,0.6)' },
  DISPATCHING: { label: 'DISPATCHING',      color: '#A855F7', glow: '0 0 14px rgba(168,85,247,0.5)' },
  RESOLVED:    { label: 'RESOLVED',         color: '#22C55E', glow: '0 0 12px rgba(34,197,94,0.4)' },
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

export default function useAutonomousAgent({ hospitalityType, services, mapCenter, onCrisisUpdate }) {
  const [systemStatus, setSystemStatus] = useState(STATUS.NOMINAL);
  const [actionLog, setActionLog] = useState([]);
  const [commsLog, setCommsLog] = useState([]);
  const [evacuationZone, setEvacuationZone] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null);

  const [threatLevel, setThreatLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState([]); 
  const [scanCount, setScanCount] = useState(0);

  const formatTime = (d) =>
    d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // ─── ADD LOG ENTRY ───
  const addEntry = useCallback((category, message, meta = null) => {
    setActionLog((prev) => {
      const entry = {
        id: Date.now() + Math.random(),
        timestamp: new Date(),
        category,
        message,
        meta,
      };
      return [...prev, entry].slice(-60);
    });
  }, []);

  // ─── ADD COMMS LINE ───
  const addComms = useCallback((line) => {
    setCommsLog((prev) => [...prev, {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      text: line,
    }].slice(-30));
  }, []);

  const incrementScan = useCallback(() => {
    setScanCount((prev) => prev + 1);
  }, []);

  const triggerEvacuation = useCallback((zone, message) => {
    setEvacuationZone(zone);
    setAlertMessage(message);
    addEntry('DISPATCH', `[${formatTime(new Date())}] 🚨 Alerting occupants in ${zone}`);
  }, [addEntry]);

  // Connect to the Backend Socket.io Server for Real-Time Brain Sync
  useEffect(() => {
    const socket = io('http://localhost:3000');

    socket.on('connect', () => {
      addComms('ESTABLISHED SECURE WEBSOCKET UPLINK TO AGENT CORE.');
    });

    socket.on('sync_state', (data) => {
      // Intentionally left simple, can load past logs here
    });

    socket.on('audit_log', (entry) => {
      // The backend has a new log entry
      setActionLog((prev) => [...prev, entry].slice(-60));
      
      // If it's a serious detection, upgrade threat
      if (entry.category === 'DETECTION') {
        setSystemStatus(STATUS.CRISIS);
        setThreatLevel(85);
        addComms('THREAT DETECTED. INITIATING REVERT CONTROL TO AGENT.');
      }
      if (entry.category === 'RESOLVED') {
        setSystemStatus(STATUS.MONITORING);
        setThreatLevel(20);
        setTimeout(() => {
          setSystemStatus(STATUS.NOMINAL);
          setThreatLevel(0);
          setDispatchProgress([]);
          setEvacuationZone(null);
          setAlertMessage(null);
          onCrisisUpdate?.({ active: false, type: null });
        }, 8000);
      }
    });

    socket.on('agent_status', (data) => {
      setIsProcessing(data.isProcessing);
      if (data.status === 'ANALYZING') {
        setSystemStatus(STATUS.ANALYZING);
      } else if (data.status === 'NOMINAL') {
        // let the resolved hook clear it slowly
      }
    });

    socket.on('agent_thought', (thought) => {
      addComms(`AGENT OPINION: ${thought}`);
    });

    socket.on('agent_action', ({ name, args }) => {
      addComms(`AGENT EXECUTING OVERRIDE: ${name.toUpperCase()}`);
      
      // Hook specific tools to UI behaviors
      if (name === 'send_alert' || (name === 'dispatch_responder' && args.location)) {
         // Auto-trigger evacuation logic physically
         if (args.zones && args.zones.length > 0) {
            triggerEvacuation(args.zones[0], args.message);
         } else if (args.location) {
             // For dispatch responder trying to warn that location
             if (args.reason && args.reason.toLowerCase().includes('fire')) {
                triggerEvacuation(args.location, "Evacuate Zone Immediately.");
             }
         }
      }
    });

    socket.on('crisis_update', (payload) => {
       // payload.types -> ['hospital', 'fire_station']
       const mappedServices = (payload.types || []).map(t => services?.find(s => s.type === t)).filter(Boolean);
       const mappedNodes = mappedServices.map(s => s.id);
       
       setSystemStatus(STATUS.DISPATCHING);
       
       // Build progress bars
       const progress = mappedServices.map(s => ({
          name: s.name,
          type: s.type,
          progress: 100,
          done: true,
          reason: payload.details?.reason || 'Agent ordered dispatch after analysis.',
       }));
       setDispatchProgress(progress);

       onCrisisUpdate?.({
           active: payload.active,
           types: payload.types,
           alertedNodes: mappedNodes,
           sensorData: payload.sensorData,
           services: mappedServices,
           respondersActive: true 
       });
    });

    return () => socket.disconnect();
  }, [addComms, onCrisisUpdate, services, triggerEvacuation]);


  // ──────────────────────────────────────────────────────
  //  PROCESS CRISIS — Route to backend agent via webhook
  // ──────────────────────────────────────────────────────
  const processCrisis = useCallback(async (sensorData) => {
    // Stage 0: Sensor Detection
    setSystemStatus(STATUS.ANALYZING);
    setThreatLevel(50);
    onCrisisUpdate?.({ active: true, type: null, analyzing: true, sensorData });
    addComms('FORWARDING SENSOR TELEMETRY TO BACKEND NEURAL ENGINE...');

    try {
        await fetch('http://localhost:3000/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sensorData)
        });
    } catch (e) {
        addComms('ERROR: BACKEND UPLINK FAILURE ' + e.message);
    }
  }, [onCrisisUpdate, addComms]);

  return {
    systemStatus,
    actionLog,
    commsLog,
    threatLevel,
    isProcessing,
    dispatchProgress,
    scanCount,
    evacuationZone,
    alertMessage,
    processCrisis,
    addEntry,
    addComms,
    incrementScan,
    formatTime,
  };
}
