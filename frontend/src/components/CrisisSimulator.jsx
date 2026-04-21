import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SCENARIOS = [
  {
    label: '🔥 Fire @ Kitchen',
    shortLabel: 'FIRE',
    color: '#EF4444',
    data: { type: 'smoke', value: 92, location: 'Kitchen, Floor 2', sensor_id: 'SMK-K2-07', temperature_c: 340 },
  },
  {
    label: '🏥 Medical @ Lobby',
    shortLabel: 'MEDICAL',
    color: '#22C55E',
    data: { type: 'health', heart_rate: 0, spo2: 68, location: 'Lobby Level 1', sensor_id: 'BIO-L1-03', alert: 'cardiac_arrest' },
  },
  {
    label: '🚨 Breach @ East Gate',
    shortLabel: 'SECURITY',
    color: '#3B82F6',
    data: { type: 'security', value: 95, location: 'East Gate, Sector B', sensor_id: 'SEC-E1-12', alert: 'perimeter_breach' },
  },
  {
    label: '⚡ Power Fail @ Wing C',
    shortLabel: 'POWER',
    color: '#F59E0B',
    data: { type: 'power', value: 0, location: 'Sector C, Main Grid', sensor_id: 'PWR-C1-01', alert: 'total_blackout' },
  },
  {
    label: '💧 Flood @ Basement',
    shortLabel: 'FLOOD',
    color: '#06B6D4',
    data: { type: 'water', value: 88, location: 'Basement B2, Utility', sensor_id: 'WTR-B2-04', alert: 'rapid_water_rise' },
  },
];

/**
 * CrisisSimulator — Dev console for triggering crisis events.
 * Controlled externally via `isOpen` prop from the bottom bar.
 */
export default function CrisisSimulator({ onTrigger, isProcessing, isOpen, backendReady = true }) {
  const [lastTriggered, setLastTriggered] = useState(null);
  const isDisabled = isProcessing || !backendReady;

  const handleTrigger = (scenario) => {
    if (isDisabled) return;
    setLastTriggered(scenario.shortLabel);
    onTrigger(scenario.data);
    setTimeout(() => setLastTriggered(null), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          style={{
            position: 'fixed',
            bottom: 46,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            width: 560,
            padding: '16px 20px',
            background: 'rgba(6,8,14,0.97)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 16,
            boxShadow: '0 0 40px rgba(0,0,0,0.5), 0 0 16px rgba(239,68,68,0.06)',
          }}
          id="crisis-simulator"
        >
          {/* Header */}
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#EF4444', boxShadow: '0 0 6px #EF4444' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#EF4444', letterSpacing: 1.5 }}>
                CRISIS SIMULATOR
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>
              {!backendReady ? '⏳ WARMING UP BACKEND...' : isProcessing ? '⏳ PROCESSING...' : 'DEV MODE · SIMULATED IoT DATA'}
            </span>
          </div>

          {/* Scenario buttons */}
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.shortLabel}
                onClick={() => handleTrigger(s)}
                disabled={isDisabled}
                className="flex-1 min-w-[100px] px-3 py-2.5 rounded-xl flex items-center gap-2"
                style={{
                  background: lastTriggered === s.shortLabel ? `${s.color}18` : 'rgba(19,25,36,0.5)',
                  border: `1px solid ${lastTriggered === s.shortLabel ? s.color : 'rgba(255,255,255,0.05)'}`,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.5 : 1,
                  transition: 'all 0.25s ease',
                  fontFamily: 'var(--font-mono)',
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled) {
                    e.currentTarget.style.borderColor = s.color;
                    e.currentTarget.style.background = `${s.color}10`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (lastTriggered !== s.shortLabel) {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.background = 'rgba(19,25,36,0.5)';
                  }
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{s.label.split(' ')[0]}</span>
                <div className="text-left">
                  <p style={{ fontSize: 9, fontWeight: 600, color: s.color, letterSpacing: 0.5 }}>
                    {s.label.split(' ').slice(1).join(' ')}
                  </p>
                  <p style={{ fontSize: 7, color: 'var(--text-dim)', letterSpacing: 0.5, marginTop: 1 }}>
                    {s.data.sensor_id}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Sensor data preview */}
          {lastTriggered && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}
            >
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#F59E0B', letterSpacing: 1 }}>
                → SENSOR PAYLOAD INJECTED · AWAITING AI ANALYSIS
              </p>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
