import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const mono = "var(--font-mono, 'JetBrains Mono', monospace)";

// ─── Building Config ────────────────────────────────────────────────────────
// Each floor is a layer in the isometric view — sensors are mapped to real IDs
const FLOORS = [
  {
    id: 'roof',
    label: 'ROOF',
    level: 'LVL 05',
    height: 0,
    color: 'rgba(0,242,255,0.08)',
    borderColor: 'rgba(0,242,255,0.25)',
    sensors: [
      { id: 'ENV-R5-01', type: 'air', label: 'AQI', x: 25, y: 30, value: 42, unit: '' },
      { id: 'ENV-R5-02', type: 'comms', label: 'COMMS', x: 75, y: 30, value: 99.8, unit: '%' },
    ],
  },
  {
    id: 'floor3',
    label: 'WING C · POWER',
    level: 'LVL 04',
    height: 1,
    color: 'rgba(0,242,255,0.06)',
    borderColor: 'rgba(0,242,255,0.2)',
    sensors: [
      { id: 'PWR-C1-01', type: 'power', label: 'GRID', x: 20, y: 35, value: 88, unit: '%' },
      { id: 'PWR-C1-02', type: 'power', label: 'UPS', x: 50, y: 65, value: 100, unit: '%' },
      { id: 'TMP-C1-03', type: 'temp', label: 'TEMP', x: 80, y: 40, value: 21.4, unit: '°C' },
    ],
  },
  {
    id: 'floor2',
    label: 'KITCHEN · DINING',
    level: 'LVL 03',
    height: 2,
    color: 'rgba(0,242,255,0.05)',
    borderColor: 'rgba(0,242,255,0.18)',
    sensors: [
      { id: 'SMK-K2-07', type: 'smoke', label: 'SMOKE', x: 15, y: 30, value: 12, unit: 'ppm' },
      { id: 'TMP-K2-08', type: 'temp', label: 'TEMP', x: 45, y: 50, value: 24.2, unit: '°C' },
      { id: 'GAS-K2-09', type: 'gas', label: 'GAS', x: 75, y: 35, value: 0, unit: 'ppm' },
      { id: 'SPR-K2-10', type: 'sprinkler', label: 'SPNK', x: 30, y: 70, value: 1, unit: '' },
    ],
  },
  {
    id: 'floor1',
    label: 'LOBBY · EAST GATE',
    level: 'LVL 02',
    height: 3,
    color: 'rgba(0,242,255,0.04)',
    borderColor: 'rgba(0,242,255,0.15)',
    sensors: [
      { id: 'BIO-L1-03', type: 'bio', label: 'BIO', x: 20, y: 40, value: 72, unit: 'bpm' },
      { id: 'SEC-E1-12', type: 'security', label: 'CAM', x: 50, y: 25, value: 1, unit: '' },
      { id: 'SEC-E1-13', type: 'security', label: 'DOOR', x: 80, y: 55, value: 1, unit: '' },
      { id: 'CRW-L1-04', type: 'crowd', label: 'CROWD', x: 35, y: 65, value: 234, unit: '' },
      { id: 'SEC-E1-14', type: 'security', label: 'GATE', x: 85, y: 30, value: 1, unit: '' },
    ],
  },
  {
    id: 'basement',
    label: 'BASEMENT B2 · UTILITY',
    level: 'LVL 01',
    height: 4,
    color: 'rgba(0,242,255,0.03)',
    borderColor: 'rgba(0,242,255,0.12)',
    sensors: [
      { id: 'WTR-B2-04', type: 'water', label: 'WATER', x: 25, y: 40, value: 15, unit: 'cm' },
      { id: 'PWR-B2-05', type: 'power', label: 'BACKUP', x: 60, y: 35, value: 100, unit: '%' },
      { id: 'TMP-B2-06', type: 'temp', label: 'TEMP', x: 80, y: 60, value: 19.8, unit: '°C' },
      { id: 'PMP-B2-07', type: 'pump', label: 'PUMP', x: 40, y: 70, value: 1, unit: '' },
    ],
  },
];

// Sensor type → color + icon mapping
const SENSOR_STYLE = {
  smoke:    { color: '#EF4444', icon: '🔥', alertColor: '#FF6B6B' },
  fire:     { color: '#EF4444', icon: '🔥', alertColor: '#FF6B6B' },
  temp:     { color: '#F59E0B', icon: '🌡', alertColor: '#FBBF24' },
  gas:      { color: '#EF4444', icon: '💨', alertColor: '#FF6B6B' },
  sprinkler:{ color: '#06B6D4', icon: '💦', alertColor: '#22D3EE' },
  water:    { color: '#06B6D4', icon: '💧', alertColor: '#22D3EE' },
  power:    { color: '#F59E0B', icon: '⚡', alertColor: '#FBBF24' },
  security: { color: '#3B82F6', icon: '🔒', alertColor: '#60A5FA' },
  bio:      { color: '#22C55E', icon: '❤', alertColor: '#4ADE80' },
  crowd:    { color: '#8B5CF6', icon: '👥', alertColor: '#A78BFA' },
  air:      { color: '#22C55E', icon: '🌬', alertColor: '#4ADE80' },
  comms:    { color: '#06B6D4', icon: '📡', alertColor: '#22D3EE' },
  pump:     { color: '#06B6D4', icon: '⛽', alertColor: '#22D3EE' },
};

function getSensorStatus(sensor, crisisActive, sensorId) {
  // Check if this specific sensor triggered the crisis
  if (crisisActive && sensor.id === sensorId) return 'CRITICAL';
  // Check if same floor sensors are affected
  if (crisisActive && sensor.id.startsWith(sensorId?.split('-')?.[0] || '___')) return 'WARNING';
  // Random chance for "attention" to make it feel alive
  if (sensor.id.charCodeAt(sensor.id.length - 1) % 17 === 0) return 'ATTENTION';
  return 'NOMINAL';
}


export default function FacilityTwin3D({ crisisInfo, evacuationZone, alertMessage }) {
  const [activeFloor, setActiveFloor] = useState(null);
  const [hoveredSensor, setHoveredSensor] = useState(null);
  const [viewTab, setViewTab] = useState('structure'); // 'structure' | 'operational'
  const [sensorPulse, setSensorPulse] = useState(0);

  // Pulse animation for sensors
  useEffect(() => {
    const interval = setInterval(() => setSensorPulse(p => p + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  const crisisActive = crisisInfo?.active || false;
  const crisisSensorId = crisisInfo?.sensorData?.sensor_id || null;
  const crisisLocation = crisisInfo?.sensorData?.location?.toLowerCase() || '';

  // Determine which floor is affected
  const affectedFloorId = useMemo(() => {
    if (!crisisActive) return null;
    if (crisisLocation.includes('kitchen')) return 'floor2';
    if (crisisLocation.includes('lobby') || crisisLocation.includes('east gate')) return 'floor1';
    if (crisisLocation.includes('sector c') || crisisLocation.includes('wing c')) return 'floor3';
    if (crisisLocation.includes('basement')) return 'basement';
    return null;
  }, [crisisActive, crisisLocation]);

  // Total sensor count
  const totalSensors = FLOORS.reduce((sum, f) => sum + f.sensors.length, 0);
  const onlineSensors = totalSensors; // All online in simulation

  // Floor-level status
  const floorStatuses = useMemo(() => {
    return FLOORS.map(floor => {
      if (floor.id === affectedFloorId) return { ...floor, status: 'CRITICAL', statusColor: '#EF4444' };
      if (crisisActive && floor.height <= (FLOORS.find(f => f.id === affectedFloorId)?.height || -1) + 1) {
        return { ...floor, status: 'CAUTION', statusColor: '#F59E0B' };
      }
      return { ...floor, status: 'OPERATIONAL', statusColor: '#22C55E' };
    });
  }, [affectedFloorId, crisisActive]);

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      fontFamily: mono, overflow: 'hidden', position: 'relative',
    }}>
      {/* ═══ HEADER ═══ */}
      <div style={{
        padding: '10px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(0,242,255,0.06)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: crisisActive ? '#EF4444' : '#22C55E',
            boxShadow: `0 0 6px ${crisisActive ? '#EF4444' : '#22C55E'}`,
            animation: crisisActive ? 'pulse-glow 1s infinite' : 'none',
          }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--command-teal)', letterSpacing: 2 }}>FACILITY TWIN</span>
          <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>//</span>
          <span style={{ fontSize: 8, color: crisisActive ? '#EF4444' : '#22C55E', fontWeight: 600 }}>
            {crisisActive ? 'ALERT' : 'LIVE'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>SENSORS:</span>
          <span style={{ fontSize: 9, color: '#22C55E', fontWeight: 700 }}>{onlineSensors}/{totalSensors}</span>
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div style={{
        display: 'flex', gap: 0, flexShrink: 0,
        borderBottom: '1px solid rgba(0,242,255,0.04)',
      }}>
        {['structure', 'operational'].map(tab => (
          <button
            key={tab}
            onClick={() => setViewTab(tab)}
            style={{
              flex: 1, padding: '6px 0', cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${viewTab === tab ? 'var(--command-teal)' : 'transparent'}`,
              color: viewTab === tab ? 'var(--command-teal)' : 'var(--text-dim)',
              fontSize: 8, fontWeight: 700, letterSpacing: 1.5,
              fontFamily: mono, transition: 'all 0.2s',
              textTransform: 'uppercase',
            }}
          >
            {tab === 'structure' ? 'MAIN STRUCTURE' : 'OPERATIONAL'}
          </button>
        ))}
      </div>

      {/* ═══ CONTENT ═══ */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>

        {/* ── STRUCTURE VIEW: 3D Isometric Building ── */}
        {viewTab === 'structure' && (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            perspective: '800px', overflow: 'hidden',
          }}>
            {/* Grid background */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage: `
                linear-gradient(rgba(0,242,255,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,242,255,0.03) 1px, transparent 1px)
              `,
              backgroundSize: '30px 30px',
            }} />

            {/* Isometric Building Stack */}
            <div style={{
              transform: 'rotateX(55deg) rotateZ(-45deg)',
              transformStyle: 'preserve-3d',
              position: 'relative',
              width: 180, height: 180,
            }}>
              {FLOORS.map((floor, idx) => {
                const isAffected = floor.id === affectedFloorId;
                const isHovered = activeFloor === floor.id;
                const floorOffset = floor.height * 28;

                return (
                  <motion.div
                    key={floor.id}
                    onClick={() => setActiveFloor(activeFloor === floor.id ? null : floor.id)}
                    animate={{
                      y: isHovered ? -8 : 0,
                      scale: isHovered ? 1.02 : 1,
                    }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    style={{
                      position: 'absolute',
                      top: floorOffset,
                      left: 0,
                      width: 180,
                      height: 24,
                      transformStyle: 'preserve-3d',
                      cursor: 'pointer',
                      zIndex: 10 - idx,
                    }}
                  >
                    {/* Top face */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: isAffected
                        ? `rgba(239,68,68,${crisisActive ? 0.15 + Math.sin(sensorPulse) * 0.1 : 0.08})`
                        : (isHovered ? 'rgba(0,242,255,0.12)' : floor.color),
                      border: `1px solid ${isAffected ? '#EF4444' : (isHovered ? 'rgba(0,242,255,0.4)' : floor.borderColor)}`,
                      boxShadow: isAffected
                        ? `0 0 20px rgba(239,68,68,0.3), inset 0 0 20px rgba(239,68,68,0.1)`
                        : (isHovered ? '0 0 12px rgba(0,242,255,0.15)' : 'none'),
                      transition: 'all 0.3s ease',
                    }}>
                      {/* Sensor dots on each floor */}
                      {floor.sensors.map(sensor => {
                        const status = getSensorStatus(sensor, crisisActive, crisisSensorId);
                        const style = SENSOR_STYLE[sensor.type] || SENSOR_STYLE.temp;
                        const dotColor = status === 'CRITICAL' ? '#EF4444'
                          : status === 'WARNING' ? '#F59E0B'
                          : status === 'ATTENTION' ? '#F59E0B'
                          : style.color;

                        return (
                          <div
                            key={sensor.id}
                            onMouseEnter={() => setHoveredSensor(sensor)}
                            onMouseLeave={() => setHoveredSensor(null)}
                            style={{
                              position: 'absolute',
                              left: `${sensor.x}%`,
                              top: `${sensor.y}%`,
                              transform: 'translate(-50%, -50%) rotateZ(45deg)',
                              width: status === 'CRITICAL' ? 8 : 5,
                              height: status === 'CRITICAL' ? 8 : 5,
                              borderRadius: '50%',
                              background: dotColor,
                              boxShadow: `0 0 ${status === 'CRITICAL' ? 10 : 4}px ${dotColor}`,
                              animation: status === 'CRITICAL' ? 'pulse-glow 0.8s infinite' : 'none',
                              transition: 'all 0.3s',
                              zIndex: 5,
                            }}
                          />
                        );
                      })}

                      {/* Floor label */}
                      <span style={{
                        position: 'absolute', bottom: 2, left: 4,
                        fontSize: 5, color: isAffected ? '#EF4444' : 'rgba(0,242,255,0.5)',
                        letterSpacing: 0.8, fontWeight: 600,
                        transform: 'rotateZ(45deg)',
                        transformOrigin: 'left bottom',
                        whiteSpace: 'nowrap',
                      }}>
                        {floor.level}
                      </span>
                    </div>

                    {/* Right face (depth) */}
                    <div style={{
                      position: 'absolute',
                      bottom: -24, left: 0, width: '100%', height: 24,
                      background: isAffected
                        ? 'rgba(239,68,68,0.08)'
                        : 'rgba(0,242,255,0.02)',
                      borderRight: `1px solid ${isAffected ? 'rgba(239,68,68,0.3)' : floor.borderColor}`,
                      borderBottom: `1px solid ${isAffected ? 'rgba(239,68,68,0.3)' : floor.borderColor}`,
                      borderLeft: `1px solid ${isAffected ? 'rgba(239,68,68,0.15)' : 'rgba(0,242,255,0.06)'}`,
                      transformOrigin: 'top',
                      transform: 'rotateX(-90deg)',
                    }} />
                  </motion.div>
                );
              })}
            </div>

            {/* Sensor Tooltip */}
            <AnimatePresence>
              {hoveredSensor && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  style={{
                    position: 'absolute', top: 8, left: 8, zIndex: 100,
                    background: 'rgba(3,5,8,0.95)', border: '1px solid rgba(0,242,255,0.15)',
                    borderRadius: 8, padding: '8px 10px', minWidth: 140,
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12 }}>{SENSOR_STYLE[hoveredSensor.type]?.icon || '📡'}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--command-teal)', letterSpacing: 1 }}>
                      {hoveredSensor.id}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{hoveredSensor.label}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      color: SENSOR_STYLE[hoveredSensor.type]?.color || 'var(--command-teal)',
                    }}>
                      {hoveredSensor.value}{hoveredSensor.unit}
                    </span>
                  </div>
                  <div style={{
                    marginTop: 4, fontSize: 6, color: 'var(--text-dim)', letterSpacing: 0.5,
                  }}>
                    STATUS: <span style={{ color: '#22C55E' }}>ONLINE</span> · LAST: 2s AGO
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── OPERATIONAL VIEW: Floor Status List ── */}
        {viewTab === 'operational' && (
          <div style={{ padding: '8px 10px', overflowY: 'auto', height: '100%' }}>
            {floorStatuses.map(floor => {
              const isAffected = floor.id === affectedFloorId;
              return (
                <motion.div
                  key={floor.id}
                  layout
                  onClick={() => setActiveFloor(activeFloor === floor.id ? null : floor.id)}
                  style={{
                    padding: '8px 10px', marginBottom: 4, borderRadius: 8, cursor: 'pointer',
                    background: isAffected ? 'rgba(239,68,68,0.06)' : 'rgba(15,20,30,0.4)',
                    border: `1px solid ${isAffected ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: floor.statusColor,
                        boxShadow: `0 0 4px ${floor.statusColor}`,
                        animation: isAffected ? 'pulse-glow 1s infinite' : 'none',
                      }} />
                      <div>
                        <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.8 }}>
                          {floor.level} — {floor.label}
                        </div>
                        <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 2 }}>
                          {floor.sensors.length} sensors · {floor.status}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 7, fontWeight: 700, letterSpacing: 1,
                      color: floor.statusColor,
                      padding: '2px 6px', borderRadius: 4,
                      background: `${floor.statusColor}15`,
                      border: `1px solid ${floor.statusColor}30`,
                    }}>
                      {floor.status === 'CRITICAL' ? '⚠' : floor.status === 'CAUTION' ? '!' : '✓'}
                    </div>
                  </div>

                  {/* Expanded sensor list */}
                  <AnimatePresence>
                    {activeFloor === floor.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', marginTop: 6 }}
                      >
                        <div style={{
                          padding: '6px 0', borderTop: '1px solid rgba(0,242,255,0.04)',
                          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
                        }}>
                          {floor.sensors.map(sensor => {
                            const status = getSensorStatus(sensor, crisisActive, crisisSensorId);
                            const style = SENSOR_STYLE[sensor.type] || SENSOR_STYLE.temp;
                            return (
                              <div
                                key={sensor.id}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  padding: '4px 6px', borderRadius: 6,
                                  background: status === 'CRITICAL' ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.2)',
                                  border: `1px solid ${status === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.02)'}`,
                                }}
                              >
                                <div style={{
                                  width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                                  background: status === 'CRITICAL' ? '#EF4444' : (status === 'WARNING' ? '#F59E0B' : style.color),
                                  boxShadow: `0 0 3px ${status === 'CRITICAL' ? '#EF4444' : style.color}`,
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 6, color: 'var(--text-dim)', letterSpacing: 0.5 }}>{sensor.id}</div>
                                  <div style={{ fontSize: 8, fontWeight: 700, color: status === 'CRITICAL' ? '#EF4444' : style.color }}>
                                    {sensor.label}: {sensor.value}{sensor.unit}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {/* Environment footer */}
            <div style={{
              marginTop: 8, padding: '8px 0', borderTop: '1px solid rgba(0,242,255,0.04)',
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
            }}>
              {[
                { icon: '🌬', label: 'AQI', value: '42', sub: 'Fine', color: '#22C55E' },
                { icon: '🌡', label: 'TEMP', value: '21.4°C', sub: '', color: '#F59E0B' },
                { icon: '⚡', label: 'GRID', value: '88%', sub: 'Load', color: '#06B6D4' },
              ].map(m => (
                <div key={m.label} style={{
                  textAlign: 'center', padding: '4px',
                  background: 'rgba(0,0,0,0.2)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.02)',
                }}>
                  <span style={{ fontSize: 11 }}>{m.icon}</span>
                  <div style={{ fontSize: 10, fontWeight: 700, color: m.color, marginTop: 2 }}>{m.value}</div>
                  <div style={{ fontSize: 6, color: 'var(--text-dim)', letterSpacing: 0.5 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Crisis overlay on building */}
        <AnimatePresence>
          {crisisActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute', bottom: 6, left: 6, right: 6,
                padding: '6px 8px', borderRadius: 8,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                backdropFilter: 'blur(8px)',
                zIndex: 50,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#EF4444', animation: 'pulse-glow 0.8s infinite' }} />
                <span style={{ fontSize: 8, fontWeight: 700, color: '#EF4444', letterSpacing: 1 }}>ZONE COMPROMISED</span>
              </div>
              <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 2 }}>
                {crisisInfo?.sensorData?.location || 'Unknown'} · Sensor: {crisisSensorId || '—'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
