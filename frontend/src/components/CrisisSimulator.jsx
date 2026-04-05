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
 * CrisisSimulator — A floating DevTools console for triggering crisis events.
 */
export default function CrisisSimulator({ onTrigger, isProcessing }) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastTriggered, setLastTriggered] = useState(null);

  const handleTrigger = (scenario) => {
    if (isProcessing) return;
    setLastTriggered(scenario.shortLabel);
    onTrigger(scenario.data);
    setTimeout(() => setLastTriggered(null), 2000);
  };

  return (
    <>
      {/* Toggle button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-xl"
        style={{
          zIndex: 2000,
          background: isOpen ? 'rgba(239,68,68,0.15)' : 'rgba(8,10,16,0.9)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${isOpen ? 'rgba(239,68,68,0.3)' : 'rgba(0,242,255,0.12)'}`,
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
        id="crisis-simulator-toggle"
      >
        <span style={{ fontSize: 14 }}>⚡</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          color: isOpen ? '#EF4444' : 'var(--command-teal)', letterSpacing: 1,
        }}>
          {isProcessing ? 'PROCESSING...' : 'DEV CONSOLE'}
        </span>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="fixed bottom-14 left-1/2 -translate-x-1/2 px-5 py-4 rounded-2xl"
            style={{
              zIndex: 1999,
              width: 520,
              background: 'rgba(6,8,14,0.96)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(239,68,68,0.2)',
              boxShadow: '0 0 20px rgba(239,68,68,0.08), 0 8px 40px rgba(0,0,0,0.5)',
            }}
            id="crisis-simulator"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#EF4444', boxShadow: '0 0 6px #EF4444' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#EF4444', letterSpacing: 1.5 }}>
                  CRISIS SIMULATOR
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>
                DEV MODE · SIMULATED IoT DATA
              </span>
            </div>

            {/* Scenario buttons */}
            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.shortLabel}
                  onClick={() => handleTrigger(s)}
                  disabled={isProcessing}
                  className="flex-1 min-w-[140px] px-4 py-3 rounded-xl flex items-center gap-2"
                  style={{
                    background: lastTriggered === s.shortLabel
                      ? `${s.color}20`
                      : 'rgba(19,25,36,0.5)',
                    border: `1px solid ${lastTriggered === s.shortLabel ? s.color : 'rgba(255,255,255,0.05)'}`,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    opacity: isProcessing ? 0.5 : 1,
                    transition: 'all 0.25s ease',
                    fontFamily: 'var(--font-mono)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isProcessing) {
                      e.currentTarget.style.borderColor = s.color;
                      e.currentTarget.style.background = `${s.color}12`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (lastTriggered !== s.shortLabel) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.background = 'rgba(19,25,36,0.5)';
                    }
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{s.label.split(' ')[0]}</span>
                  <div className="text-left">
                    <p style={{ fontSize: 10, fontWeight: 600, color: s.color, letterSpacing: 0.5 }}>
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
                className="mt-3 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#F59E0B', letterSpacing: 1 }}>
                  → SENSOR PAYLOAD INJECTED · AWAITING AI ANALYSIS
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
