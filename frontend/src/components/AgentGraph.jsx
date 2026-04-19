import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CustomDecisionNode from './CustomDecisionNode';
import CoreNode from './CoreNode';

// ─── Stable node type registry ───
const nodeTypes = { decision: CustomDecisionNode, core: CoreNode };

const COLORS = {
  observe: '#04889fff',
  analyze: '#3B82F6',
  execute: '#EF4444',
  hospital: '#22C55E',
  police: '#3B82F6',
  fire_station: '#F97316',
};

const E_STYLE = (c) => ({ stroke: c, strokeWidth: 2, strokeOpacity: 0.7 });
const E_MARKER = (c) => ({ type: MarkerType.ArrowClosed, width: 14, height: 14, color: c });

// ─── Guaranteed fallback station data (used when live Overpass data is absent) ───
const FALLBACK_STATIONS = {
  hospital: { name: 'Manipal Hospital (Old Airport Rd)', phone: '+91-80-25024444', distance: 1.2 },
  police:   { name: 'Cubbon Park Police Station',       phone: '+91-80-22942400', distance: 0.9 },
  fire_station: { name: 'Seshadripuram Fire Station',   phone: '+91-80-22971500', distance: 1.5 },
};

// Resolve a station's display details — prefer live crisisInfo data, fall back to static table
function resolveStation(type, crisisServices, crisisReasons) {
  const liveObj = Array.isArray(crisisServices)
    ? crisisServices.find(s => s && (s.type === type || s.service_type === type))
    : null;

  const fallback = FALLBACK_STATIONS[type] || {};

  return {
    name:     liveObj?.name     || fallback.name     || type.replace('_', ' ').toUpperCase(),
    phone:    liveObj?.phone    || fallback.phone     || null,
    distance: liveObj?.distance != null
      ? liveObj.distance
      : (liveObj?.distance_km != null ? liveObj.distance_km : (fallback.distance ?? null)),
    reason:   crisisReasons?.[type] || 'Nearest available unit selected by AI agent.',
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Inner canvas — lives inside ReactFlowProvider
// ─────────────────────────────────────────────────────────────────────────────
// LangGraph node definitions — maps node key to display info
const LANGGRAPH_NODES = [
  { id: 'lg-detect',   key: 'detect_crisis',  label: 'DETECT', desc: 'Crisis Classification',     color: '#F59E0B', x: 80,  y: 10  },
  { id: 'lg-gather',   key: 'gather_intel',   label: 'GATHER', desc: 'Overpass + TomTom Intel',   color: '#3B82F6', x: 80,  y: 85  },
  { id: 'lg-score',    key: 'score_services', label: 'SCORE',  desc: 'Points-Based Ranking',       color: '#A855F7', x: 80,  y: 160 },
  { id: 'lg-decide',   key: 'decide_dispatch',label: 'DECIDE', desc: 'Gemini Dispatch Decision',  color: '#EF4444', x: 80,  y: 235 },
  { id: 'lg-alert',    key: 'alert_venue',    label: 'ALERT',  desc: 'Evacuation & Zone Alert',   color: '#22C55E', x: 80,  y: 310 },
];

function LangGraphPipeline({ activeNode, threatTier, threatLevel, cascadeRisk, serviceScores }) {
  const TIER_COLORS = { GREEN: '#22C55E', YELLOW: '#EAB308', ORANGE: '#F97316', RED: '#EF4444', CRITICAL: '#DC2626' };
  const tierColor = TIER_COLORS[threatTier] || '#22C55E';

  return (
    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 20, width: 220, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Threat badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, padding: '4px 8px', borderRadius: 6, background: `${tierColor}15`, border: `1px solid ${tierColor}40` }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: tierColor, boxShadow: `0 0 6px ${tierColor}` }} />
        <span style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: tierColor, letterSpacing: 1.2 }}>
          THREAT {threatTier} — {threatLevel?.toFixed(0) ?? 0}/100
        </span>
        {cascadeRisk > 0.1 && (
          <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#F97316', marginLeft: 'auto' }}>
            CASCADE {(cascadeRisk * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Pipeline nodes */}
      {LANGGRAPH_NODES.map((n, i) => {
        const isActive  = activeNode === n.key;
        const isDone    = LANGGRAPH_NODES.slice(0, i).some(p => p.key === activeNode) || (activeNode === null && threatLevel > 0);
        return (
          <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Connector line */}
            {i > 0 && <div style={{ position: 'absolute', left: 18, top: 60 + i * 75 - 12, width: 2, height: 12, background: 'rgba(255,255,255,0.08)' }} />}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8, width: '100%',
              background:   isActive ? `${n.color}20` : isDone ? `rgba(255,255,255,0.03)` : 'transparent',
              border:       `1px solid ${isActive ? n.color : isDone ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)'}`,
              transition:   'all 0.3s ease',
              boxShadow:    isActive ? `0 0 10px ${n.color}30` : 'none',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: isActive ? n.color : isDone ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                boxShadow: isActive ? `0 0 8px ${n.color}` : 'none',
                animation: isActive ? 'pulse 1s infinite' : 'none',
              }} />
              <div>
                <p style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 700, color: isActive ? n.color : 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>{n.label}</p>
                <p style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5 }}>{n.desc}</p>
              </div>
              {isActive && <div style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 7, color: n.color }}>●</div>}
            </div>
          </div>
        );
      })}

      {/* Top-3 scored services */}
      {serviceScores?.length > 0 && (
        <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
          <p style={{ fontFamily: 'monospace', fontSize: 8, color: '#A855F7', fontWeight: 700, marginBottom: 4, letterSpacing: 1 }}>SCORED SERVICES</p>
          {serviceScores.slice(0, 3).map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 7, color: i === 0 ? '#22C55E' : 'rgba(255,255,255,0.3)', width: 12 }}>#{i+1}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(255,255,255,0.5)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 7, color: '#A855F7', fontWeight: 700 }}>{s.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentGraphInner({ agentState, crisisInfo }) {
  const { systemStatus, actionLog, isProcessing, activeNode, serviceScores, threatTier, threatLevel, cascadeRisk } = agentState;

  // Service dispatch lifecycle (Alerting → Responded → Dispatched)
  const [serviceStatus, setServiceStatus] = useState({});

  // React Flow managed state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // ── Freeze: keep the last ACTIVE crisis snapshot even after crisis clears ──
  const frozenCrisis = useRef(null);
  useEffect(() => {
    if (crisisInfo?.active) {
      frozenCrisis.current = crisisInfo; // capture the rich payload
      return;
    }
    if (crisisInfo?.reviewVisible && crisisInfo?.sensorData) {
      frozenCrisis.current = crisisInfo;
      return;
    }
    frozenCrisis.current = null;
  }, [crisisInfo]);

  // Derived — always use the frozen snapshot for rendering if available
  const displayCrisis = crisisInfo?.active || crisisInfo?.reviewVisible ? crisisInfo : frozenCrisis.current;

  useEffect(() => {
    if (crisisInfo?.active) {
      setServiceStatus({});
      return;
    }
    if (!crisisInfo?.reviewVisible && !crisisInfo?.sensorData) {
      setServiceStatus({});
    }
  }, [crisisInfo?.active, crisisInfo?.reviewVisible, crisisInfo?.sensorData?.sensor_id]);

  // Parse Gemini threat-assessment entry from action log
  const analysisEntry = useMemo(() => {
    const decLog = actionLog.filter(e => e.category === 'DECISION');
    return decLog[decLog.length - 1] || null;
  }, [actionLog]);

  const severityMatch = analysisEntry?.message?.match(/Severity (\d+)/);
  const severity = severityMatch ? severityMatch[1] : null;

  const dispatchedTypes = useMemo(
    () => displayCrisis?.types || [],
    [displayCrisis?.types]
  );
  const latestSensor = displayCrisis?.sensorData;

  // ── Dispatch lifecycle simulation ──
  useEffect(() => {
    if (!crisisInfo?.active || dispatchedTypes.length === 0) return;

    const timers = [];
    dispatchedTypes.forEach((type, i) => {
      timers.push(setTimeout(() => {
        setServiceStatus(prev => {
          if (prev[type]) return prev;
          return { ...prev, [type]: 'Alerting Agency...' };
        });
        timers.push(setTimeout(() => {
          setServiceStatus(prev => ({ ...prev, [type]: 'Agency Responded' }));
          timers.push(setTimeout(() => {
            setServiceStatus(prev => ({ ...prev, [type]: 'Units Dispatched ✅' }));
          }, 1800 + Math.random() * 1000));
        }, 1500 + Math.random() * 1200));
      }, i * 900));
    });

    return () => timers.forEach(clearTimeout);
  }, [crisisInfo?.active, dispatchedTypes.join(',')]); // eslint-disable-line

  // ────────────────────────────────────────────────────────────
  // Build the React Flow graph — COMPACT positions centered near origin
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    // Use a compact center so fitView can scale everything nicely
    const CX = 400;
    const CY = 250;
    const nds = [];
    const eds = [];

    const hasCrisis = !!(displayCrisis?.active || displayCrisis?.reviewVisible || frozenCrisis.current);

    // ── Core node status text ──
    let coreStatus = 'Monitoring system telemetry for anomalies...';
    let isCrisis = false;

    if (isProcessing) {
      coreStatus = 'Analyzing sensor stream via Gemini...';
    } else if (hasCrisis) {
      isCrisis = true;
      if (!crisisInfo?.active) {
        coreStatus = 'Incident resolved. Decision graph preserved for review.';
      } else if (dispatchedTypes.length > 0) {
        coreStatus = 'Executing crisis protocols — units mobilized.';
      } else if (analysisEntry) {
        coreStatus = 'Threat confirmed. Allocating nearest responders.';
      } else {
        coreStatus = 'Anomaly detected. Running AI threat models.';
      }
    }

    // ── 1. Central Core Node ──
    nds.push({
      id: 'core',
      type: 'core',
      draggable: false,
      selectable: false,
      position: { x: CX, y: CY },
      data: { statusText: coreStatus, isCrisis },
    });

    // ── 2. OBSERVE node (top-left of core) ──
    if (latestSensor || isProcessing || hasCrisis) {
      nds.push({
        id: 'observe',
        type: 'decision',
        position: { x: CX - 200, y: CY - 230 },
        data: {
          category: 'OBSERVE',
          title: latestSensor ? latestSensor.type.toUpperCase() + ' SENSOR' : 'Sensor Sweep',
          subtitle: latestSensor?.location ? `📍 ${latestSensor.location}` : null,
          text: latestSensor
            ? `Anomaly reading detected — value: ${latestSensor.value ?? 'triggered'}`
            : 'Pending sensor lock.',
          severity: 'HIGH',
          color: COLORS.observe,
          active: !!crisisInfo?.active,
        },
      });
      eds.push({
        id: 'e-obs-core',
        source: 'observe',
        target: 'core',
        animated: !!crisisInfo?.active,
        style: E_STYLE(COLORS.observe),
        markerEnd: E_MARKER(COLORS.observe),
      });
    }

    // ── 3. ANALYZE node (left of core) ──
    if (hasCrisis || analysisEntry) {
      const isAnalyzing = !analysisEntry;
      nds.push({
        id: 'analyze',
        type: 'decision',
        position: { x: CX - 400, y: CY + 20 },
        data: {
          category: 'ANALYZE',
          title: isAnalyzing ? 'Gemini Processing...' : `Severity: ${severity}/10`,
          subtitle: isAnalyzing ? null : '🧠 Gemini threat assessment complete',
          text: isAnalyzing
            ? 'Gemini actively analyzing threat vectors.'
            : (analysisEntry?.message || '')
                .replace(/⚠️\s*THREAT ASSESSMENT.*?\n\n/, '')
                .slice(0, 120) + '…',
          severity: isAnalyzing ? 'MED' : 'HIGH',
          color: COLORS.analyze,
          active: !!crisisInfo?.active || isAnalyzing,
        },
      });
      eds.push({
        id: 'e-core-analyze',
        source: 'core',
        target: 'analyze',
        animated: isAnalyzing && !!crisisInfo?.active,
        style: E_STYLE(COLORS.analyze),
        markerEnd: E_MARKER(COLORS.analyze),
      });
    }

    // ── 4. EXECUTE / Dispatch nodes (right-side, compact radial) ──
    if (dispatchedTypes.length > 0) {
      const spawnPoints = [
        { x: CX + 350, y: CY - 240 },
        { x: CX + 420, y: CY + 20 },
        { x: CX + 350, y: CY + 280 },
      ];

      const serviceInfos = displayCrisis?.services || [];
      const serviceReasons = displayCrisis?.serviceReasons || {};

      dispatchedTypes.forEach((type, i) => {
        const pos = spawnPoints[i % spawnPoints.length];
        const status = serviceStatus[type] || 'Pending Alert...';
        const color = COLORS[type] || COLORS.execute;

        // ── Always resolves to a real name — uses live data first, then fallback ──
        const resolved = resolveStation(type, serviceInfos, serviceReasons);
        const stationName = resolved.name;
        const distanceStr = resolved.distance != null ? `📍 ${resolved.distance.toFixed(1)} km away` : null;
        const phoneStr = resolved.phone ? `📞 ${resolved.phone}` : null;
        const reason = resolved.reason;

        const isDone = status.includes('Dispatched');
        const isActive = !isDone;

        nds.push({
          id: `dispatch-${type}`,
          type: 'decision',
          position: pos,
          data: {
            category: type === 'fire_station' ? 'FIRE STATION' : type.toUpperCase(),
            title: stationName,           // e.g. "Max Super Speciality Hospital"
            subtitle: distanceStr,        // e.g. "1.4 km away"
            text: isDone ? '✅ Units Dispatched' : status,
            meta: phoneStr,               // phone shown below
            severity: isDone ? 'MED' : 'HIGH',
            color,
            active: isActive,
            reason,                       // AI reasoning, shown on toggle
          },
        });

        eds.push({
          id: `e-core-${type}`,
          source: 'core',
          target: `dispatch-${type}`,
          animated: isActive && !!crisisInfo?.active,
          style: E_STYLE(color),
          markerEnd: E_MARKER(color),
        });
      });
    }

    setNodes(nds);
    setEdges(eds);
  }, [
    crisisInfo?.active,
    displayCrisis?.services,
    displayCrisis?.serviceReasons,
    latestSensor,
    isProcessing,
    analysisEntry,
    severity,
    dispatchedTypes,
    serviceStatus,
  ]); // eslint-disable-line

  // ─────────────── Render ───────────────
  const isCrisisActive = !!crisisInfo?.active;
  const hasFrozen = !!(displayCrisis?.reviewVisible || frozenCrisis.current);
  const statusDot = isProcessing ? '#F59E0B' : isCrisisActive ? '#EF4444' : hasFrozen ? '#A855F7' : '#22C55E';
  const statusLabel = isProcessing
    ? 'ANALYZING'
    : isCrisisActive
    ? 'CRISIS ACTIVE'
    : hasFrozen
    ? 'RESOLVED — GRAPH PRESERVED'
    : systemStatus?.label || 'STANDBY';

  const { fitView } = useReactFlow();

  // Ref for the canvas container (for ResizeObserver)
  const canvasRef = useRef(null);

  // Stable fitView caller with debounce
  const fitViewTimer = useRef(null);
  const doFitView = useCallback(() => {
    clearTimeout(fitViewTimer.current);
    fitViewTimer.current = setTimeout(() => {
      fitView({ padding: 0.15, includeHiddenNodes: true, duration: 300 });
    }, 80);
  }, [fitView]);

  // Re-fit whenever nodes count changes
  const prevNodeCount = useRef(0);
  useEffect(() => {
    if (nodes.length > 0 && nodes.length !== prevNodeCount.current) {
      doFitView();
      prevNodeCount.current = nodes.length;
    }
  }, [nodes.length, doFitView]);

  // Re-fit on window resize
  useEffect(() => {
    window.addEventListener('resize', doFitView);
    return () => window.removeEventListener('resize', doFitView);
  }, [doFitView]);

  // Re-fit on panel resize via ResizeObserver (dragging the panel handle)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(doFitView);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doFitView]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#030508', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px',
        height: 32,
        minHeight: 32,
        borderBottom: '1px solid rgba(0,242,255,0.08)',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(14px)',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: statusDot,
            boxShadow: `0 0 8px ${statusDot}`,
          }} />
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#E5E7EB', fontWeight: 700, letterSpacing: 1.5 }}>
            RAKSHAK NEURAL ENGINE
          </span>
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#6B7280', letterSpacing: 1.2 }}>
          LangGraph v2.0 · {statusLabel}
        </span>
      </div>

      {/* React Flow canvas — fills all remaining height */}
      <div ref={canvasRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* LangGraph pipeline overlay */}
        <LangGraphPipeline
          activeNode={activeNode}
          threatTier={threatTier}
          threatLevel={threatLevel}
          cascadeRisk={cascadeRisk}
          serviceScores={serviceScores}
        />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15, includeHiddenNodes: true }}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          nodesDraggable={true}
          elementsSelectable={true}
          panOnDrag
          zoomOnScroll
          minZoom={0.1}
          maxZoom={1.5}
          style={{ width: '100%', height: '100%' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} color="#151d2e" />
        </ReactFlow>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Outer wrapper — provides the ReactFlowProvider store
// ─────────────────────────────────────────────────────────────────────────────
export default function AgentGraph(props) {
  return (
    <ReactFlowProvider>
      <AgentGraphInner {...props} />
    </ReactFlowProvider>
  );
}
