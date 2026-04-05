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
    ? crisisServices.find(s => s && s.type === type)
    : null;

  const fallback = FALLBACK_STATIONS[type] || {};

  return {
    name:     liveObj?.name     || fallback.name     || type.replace('_', ' ').toUpperCase(),
    phone:    liveObj?.phone    || fallback.phone     || null,
    distance: liveObj?.distance != null ? liveObj.distance : (fallback.distance ?? null),
    reason:   crisisReasons?.[type] || 'Nearest available unit selected by AI agent.',
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Inner canvas — lives inside ReactFlowProvider
// ─────────────────────────────────────────────────────────────────────────────
function AgentGraphInner({ agentState, crisisInfo }) {
  const { systemStatus, actionLog, isProcessing } = agentState;

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
    }
  }, [crisisInfo]);

  // Derived — always use the frozen snapshot for rendering if available
  const displayCrisis = crisisInfo?.active ? crisisInfo : frozenCrisis.current;

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

    const hasCrisis = !!(displayCrisis?.active || frozenCrisis.current);

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
  const hasFrozen = !!frozenCrisis.current;
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
          {statusLabel}
        </span>
      </div>

      {/* React Flow canvas — fills all remaining height */}
      <div ref={canvasRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
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
