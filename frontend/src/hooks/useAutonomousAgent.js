import { useState, useCallback, useRef } from 'react';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

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

const SYSTEM_PROMPT = `You are RAKSHAK AI — an autonomous crisis response intelligence engine in Bangalore.

You receive real-time sensor data from IoT devices. Your job is to output a FAST, concise, to-the-point assessment and alert the required emergency agencies.
Rule 1: EVERY EVENT MUST ALWAYS DISPATCH AN AMBULANCE. You must always include 'hospital' in your 'dispatched_services' array.
Rule 2: If fire/smoke>70, dispatch 'fire_station' and 'police' alongside 'hospital'.
Rule 3: If breach/security, dispatch 'police' alongside 'hospital'.

You MUST respond with ONLY valid JSON in this exact flat format:
{
  "severity": 9,
  "threat_assessment": "Critical fire confirmed in Floor 2 Kitchen.",
  "dispatched_services": [
    { "type": "fire_station", "reason": "Requires high-reach ladders to contain the blaze." },
    { "type": "hospital", "reason": "Potential casualties require immediate burn unit." },
    { "type": "police", "reason": "Crowd control and perimeter security." }
  ],
  "comms_script": "OUTGOING TRANSMISSION: Fire detected in kitchen. Evacuating."
}`;

// ─── Fallback station data (used when Overpass API returns nothing) ───
// Sorted by proximity to MG Road, Bangalore — closest first
const FALLBACK_STATIONS = [
  // Hospitals
  { id: 'fb-h1', type: 'hospital', name: 'Manipal Hospital (Old Airport Rd)', phone: '+91-80-25024444', distance: 1.2, lat: 12.9568, lng: 77.6406 },
  { id: 'fb-h2', type: 'hospital', name: 'St. Philomena Hospital', phone: '+91-80-25660550', distance: 2.1, lat: 12.9716, lng: 77.5946 },
  { id: 'fb-h3', type: 'hospital', name: 'Bowring & Lady Curzon Hospital', phone: '+91-80-25586789', distance: 2.8, lat: 12.9803, lng: 77.6060 },
  // Police
  { id: 'fb-p1', type: 'police', name: 'Cubbon Park Police Station', phone: '+91-80-22942400', distance: 0.9, lat: 12.9763, lng: 77.5929 },
  { id: 'fb-p2', type: 'police', name: 'Shivajinagar Police Station', phone: '+91-80-25590333', distance: 1.7, lat: 12.9875, lng: 77.6010 },
  // Fire
  { id: 'fb-f1', type: 'fire_station', name: 'Seshadripuram Fire Station', phone: '+91-80-22971500', distance: 1.5, lat: 12.9890, lng: 77.5720 },
  { id: 'fb-f2', type: 'fire_station', name: 'Shivajinagar Fire Station', phone: '+91-80-25590100', distance: 2.3, lat: 12.9875, lng: 77.5980 },
];

export default function useAutonomousAgent({ hospitalityType, services, mapCenter, onCrisisUpdate }) {
  const [systemStatus, setSystemStatus] = useState(STATUS.NOMINAL);
  const [actionLog, setActionLog] = useState([]);
  const [commsLog, setCommsLog] = useState([]);
  const [evacuationZone, setEvacuationZone] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null);

  const triggerEvacuation = useCallback((action) => {
    setEvacuationZone(action.zone);
    setAlertMessage(action.message);
  }, []);
  
  const [threatLevel, setThreatLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState([]); // { name, type, progress, done }
  const [scanCount, setScanCount] = useState(0);
  const processingRef = useRef(false);

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

  // ─── INCREMENT SCAN ───
  const incrementScan = useCallback(() => {
    setScanCount((prev) => prev + 1);
  }, []);

  // ──────────────────────────────────────────────────────
  //  PROCESS CRISIS — The Gemini Reasoning Engine
  // ──────────────────────────────────────────────────────
  const processCrisis = useCallback(async (sensorData) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setDispatchProgress([]);

    // ──── Stage 0: Sensor Detection ────
    setSystemStatus(STATUS.ANALYZING);
    setThreatLevel(50);
    addEntry('DETECTION', `🔔 Sensor alert: ${sensorData.type.toUpperCase()} anomaly at ${sensorData.location}. Raw value: ${JSON.stringify(sensorData)}`);
    onCrisisUpdate?.({ active: true, type: null, analyzing: true, sensorData });

    // Build context for Gemini including traffic awareness
    const nearbyContext = services?.slice(0, 15).map((s) => ({
      type: s.type,
      name: s.name,
      distance_km: s.distance.toFixed(2),
      phone: s.phone || 'N/A',
      traffic_status: Math.random() > 0.6 ? 'HEAVY_CONGESTION' : 'MODERATE_TRAFFIC',
      est_travel_time_mins: Math.round(s.distance * 4 + (Math.random() * 10)),
    })) || [];

    const prompt = `
SENSOR DATA RECEIVED:
${JSON.stringify(sensorData, null, 2)}

DEPLOYMENT CONTEXT:
- Hospitality Type: ${hospitalityType?.label || 'Unknown'}
- Location: Bangalore (${mapCenter?.lat?.toFixed(4)}°N, ${mapCenter?.lng?.toFixed(4)}°E)

NEARBY EMERGENCY SERVICES (sorted by distance, with real-time traffic estimates):
${JSON.stringify(nearbyContext, null, 2)}

Based on the sensor data, assess the threat and determine the optimal emergency response.
IMPORTANT: You MUST consider the 'traffic_status' and 'est_travel_time_mins' for each station. If the closest station has HEAVY_CONGESTION, explain in your "reason" field how traffic impacts the dispatch decision.
Respond with JSON only.`;

    try {
      // ──── Stage 1: Gemini Analysis ────
      addEntry('ANALYSIS', '🧠 AI ANALYZING DATA... Evaluating sensor payload against threat models.');
      addComms('ESTABLISHING SECURE CHANNEL TO GEMINI NEURAL ENGINE...');

      // ──── Priority Waterfall of Gemini Models ────
      const MODELS = [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash'
      ];

      let res;
      let lastError = '';
      let successfulModel = '';

      for (const model of MODELS) {
        const URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        addComms(`ATTEMPTING MODEL COMPUTE UNIT: ${model.toUpperCase()}...`);

        try {
          res = await fetch(URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                topP: 0.8,
                maxOutputTokens: 1200,
                responseMimeType: "application/json",
              },
            }),
          });

          if (res.ok) {
            successfulModel = model;
            addComms(`✅ HANDSHAKE SUCCESS: ${model.toUpperCase()}`);
            break;
          }

          const errBody = await res.text().catch(() => '');
          lastError = `API ${res.status}: ${errBody.slice(0, 100)}`;
          addComms(`⚠️ ${model.toUpperCase()} FAILED (${res.status}). FALLING BACK...`);
        } catch (err) {
          lastError = err.message;
          addComms(`⚠️ NETWORK ERROR ON ${model.toUpperCase()}. FALLING BACK...`);
        }
      }

      if (!res || !res.ok) {
        throw new Error(lastError || 'All models exhausted quotas or failed');
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!rawText) {
        throw new Error(lastError || 'Gemini returned empty response. Check API key quota.');
      }

      // ──── Robust JSON Parsing ────
      // Extracts exactly the JSON object, ignoring any markdown backticks or AI conversational text
      let analysis;
      try {
        const startIdx = rawText.indexOf('{');
        const endIdx = rawText.lastIndexOf('}');
        
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          const cleanJsonString = rawText.substring(startIdx, endIdx + 1);
          analysis = JSON.parse(cleanJsonString);
        } else {
          throw new Error('No JSON object boundaries found in AI response');
        }
      } catch (err) {
        // Output exactly what Gemini said to figure out why it's not valid JSON
        console.error('Raw Gemini Output:', rawText);
        throw new Error(`Failed to parse Gemini JSON. Raw output: ${rawText.slice(0, 150)}... Fallback triggered.`);
      }

    // ──── Action Generation Logic ────
    const actions = [];
    const eventData = sensorData;
    if (eventData.type === "smoke" && eventData.value > 80) {
      actions.push({
        type: "alert_people",
        zone: eventData.location,
        message: "Fire detected. Evacuate immediately."
      });
    }

    // ──── Action Execution Logic ────
    actions.forEach(action => {
      if (action.type === "alert_people") {
        triggerEvacuation(action);
        addEntry('DISPATCH', `[${formatTime(new Date())}] 🚨 Alerting occupants in ${action.zone}`);
      }
    });

      // ──── Stage 1 Display: Threat Assessment ────
      setSystemStatus(STATUS.CRISIS);
      setThreatLevel(Math.min(100, (analysis.severity || 8) * 10 + 5));

      addEntry('DECISION', `⚠️ THREAT ASSESSMENT (Severity ${analysis.severity || 8}/10)\n\n${analysis.threat_assessment}`);

      addComms('THREAT MATRIX COMPUTED. INITIATING DISPATCH PROTOCOL...');

      // ──── Stage 2: Fast Dispatch Multiple ────
      let rawTargets = [];
      if (Array.isArray(analysis.dispatched_services) && analysis.dispatched_services.length > 0) {
        if (typeof analysis.dispatched_services[0] === 'string') {
           // Fallback if AI didn't follow the new schema
           rawTargets = analysis.dispatched_services.map(t => ({ type: t, reason: 'Emergency response required.' }));
        } else {
           rawTargets = analysis.dispatched_services;
        }
      } else {
        rawTargets = [
          { type: 'police', reason: 'Default security protocol.' }, 
          { type: 'hospital', reason: 'Default medical protocol.' }
        ];
      }

      // Ensure 'hospital' is always included as per user request
      if (!rawTargets.some(t => t.type === 'hospital')) {
        rawTargets.push({ type: 'hospital', reason: 'Mandatory standard protocol for potential casualties.' });
      }

      const validTargetContexts = [];

      const initialProgress = rawTargets.map(targetObj => {
        const targetType = targetObj.type;
        // Use live Overpass data if available, else fall back to hardcoded Bangalore stations
        const liveMatch = services?.find((s) => s.type === targetType);
        const fallbackMatch = FALLBACK_STATIONS.find((s) => s.type === targetType);
        const nearestMatch = liveMatch || fallbackMatch;
        
        // Prevent duplicates
        if(validTargetContexts.some(c => c.type === targetType)) return null;

        validTargetContexts.push({ type: targetType, reason: targetObj.reason, nearest: nearestMatch });
        return {
          name: nearestMatch?.name || targetType.toUpperCase(),
          type: targetType,
          progress: 0,
          done: false,
          reason: targetObj.reason || 'Emergency response required.',
        };
      }).filter(Boolean);

      setDispatchProgress(initialProgress);

      // Animate progress bars (fast)
      await new Promise((resolve) => {
        let prog = 0;
        const interval = setInterval(() => {
          prog += Math.random() * 30 + 15;
          if (prog >= 100) {
            clearInterval(interval);
            setDispatchProgress(prev => prev.map(p => ({ ...p, progress: 100, done: true })));
            resolve();
          } else {
            setDispatchProgress(prev => prev.map(p => ({ ...p, progress: Math.min(prog, 95) })));
          }
        }, 150);
      });

      setSystemStatus(STATUS.DISPATCHING);

      validTargetContexts.forEach(({ type, nearest }) => {
        const dispatchMsg = nearest
          ? `📡 Alerting ${type.toUpperCase()}: ${nearest.name} (${nearest.distance.toFixed(1)}km)`
          : `📡 Alerting ${type.toUpperCase()}`;
        
        addEntry('DISPATCH', dispatchMsg, nearest ? {
          name: nearest.name,
          distance: nearest.distance,
          phone: nearest.phone,
        } : null);

        if (nearest?.phone) addComms(`OUTGOING CALL TO ${nearest.phone}...`);
      });

      addComms(`AI SYSTEM DATA: "${analysis.comms_script}"`);

      // Extract unique IDs of exactly what got dispatched
      const alertedNodes = validTargetContexts.map(c => c.nearest?.id).filter(Boolean);

      // ──── Stage 3: Mark responders on map ────
      onCrisisUpdate?.({
        active: true,
        types: validTargetContexts.map(c => c.type),
        alertedNodes: alertedNodes,
        sensorData,
        services: validTargetContexts.map(c => c.nearest).filter(Boolean),
        serviceReasons: validTargetContexts.reduce((acc, c) => ({ ...acc, [c.type]: c.reason }), {}),
        respondersActive: true,
      });

      await new Promise((r) => setTimeout(r, 600));

      // ──── Cooldown → Resolution ────
      setTimeout(() => {
        addEntry('RESOLVED', '✅ All dispatches confirmed. Responders en route. Situation under active monitoring.');
        setSystemStatus(STATUS.MONITORING);
        setThreatLevel(20);
        addComms('ALL CHANNELS CONFIRMED. MONITORING RESPONDER ETAs.');

        setTimeout(() => {
          setSystemStatus(STATUS.NOMINAL);
          setThreatLevel(0);
          setDispatchProgress([]);
          setEvacuationZone(null);
          setAlertMessage(null);
          onCrisisUpdate?.({ active: false, type: null });
          addEntry('SYSTEM', 'Situation stabilized. Returning to standard monitoring protocol.');
          addComms('CHANNELS CLOSED. RESUMING PASSIVE SCAN.');
          processingRef.current = false;
          setIsProcessing(false);
        }, 6000);
      }, 4000);

    } catch (err) {
      console.error('Gemini crisis processing error:', err);
      addEntry('SYSTEM', `⚠️ AI ENGINE ERROR: ${err.message}. Falling back to rule-based dispatch.`);
      addComms('ERROR: GEMINI LINK LOST. SWITCHING TO MANUAL PROTOCOL.');

      // Fallback: rule-based multi-dispatch
      let fallbackTypes = ['hospital']; // ALWAYS call hospital
      if (sensorData.type === 'smoke' || sensorData.type === 'fire') {
        fallbackTypes.push('fire_station', 'police');
      } else if (sensorData.type === 'security' || sensorData.type === 'breach') {
        fallbackTypes.push('police');
      }

      const fallbackNodes = [];

      fallbackTypes.forEach(fallbackType => {
        const nearest = services?.find((s) => s.type === fallbackType);
        if (nearest) {
          fallbackNodes.push(nearest.id);
          addEntry('DISPATCH', `📡 FALLBACK: Alerting ${nearest.name} (${nearest.distance.toFixed(1)}km)`, {
            name: nearest.name,
            distance: nearest.distance,
          });
        }
      });

      setSystemStatus(STATUS.CRISIS);
      setThreatLevel(75);
      onCrisisUpdate?.({ active: true, types: fallbackTypes, alertedNodes: fallbackNodes, sensorData });

      setTimeout(() => {
        setSystemStatus(STATUS.NOMINAL);
        setThreatLevel(0);
        setEvacuationZone(null);
        setAlertMessage(null);
        onCrisisUpdate?.({ active: false, types: [], alertedNodes: [] });
        processingRef.current = false;
        setIsProcessing(false);
      }, 8000);
    }
  }, [hospitalityType, services, mapCenter, addEntry, addComms, onCrisisUpdate]);

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
