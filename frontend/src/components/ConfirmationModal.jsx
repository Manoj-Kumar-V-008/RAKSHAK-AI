import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const mono = "var(--font-mono, 'JetBrains Mono', monospace)";

/**
 * ConfirmationModal — Human-in-the-loop dispatch confirmation.
 * Auto-approves after countdown. Shows full AI reasoning.
 */
export default function ConfirmationModal({
  visible = false,
  dispatchPlan = [],     // [{name, type, distance, score, reason}]
  reasoning = '',
  threatScore = 0,
  crisisType = '',
  contacts = [],         // [{name, phone}]
  countdownSeconds = 12,
  onApprove,
  onReject,
}) {
  const [countdown, setCountdown] = useState(countdownSeconds);

  useEffect(() => {
    if (!visible) { setCountdown(countdownSeconds); return; }
    setCountdown(countdownSeconds);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onApprove?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, countdownSeconds]);

  const progress = ((countdownSeconds - countdown) / countdownSeconds) * 100;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 5000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
            style={{
              width: 520, maxWidth: '90vw',
              background: 'rgba(6,8,14,0.98)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 20,
              boxShadow: '0 0 60px rgba(239,68,68,0.1), 0 20px 60px rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}
          >
            {/* Auto-approve progress bar */}
            <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.04)' }}>
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
                style={{
                  height: '100%', borderRadius: 2,
                  background: 'linear-gradient(90deg, #F59E0B, #EF4444)',
                  boxShadow: '0 0 8px rgba(239,68,68,0.4)',
                }}
              />
            </div>

            {/* Header */}
            <div style={{
              padding: '18px 24px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', background: '#EF4444',
                    boxShadow: '0 0 12px #EF4444', animation: 'pulse-glow 1s infinite',
                  }} />
                  <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: '#EF4444', letterSpacing: 2 }}>
                    DISPATCH CONFIRMATION
                  </span>
                </div>
                <div style={{
                  padding: '4px 12px', borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                }}>
                  <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 800, color: '#EF4444' }}>
                    {countdown}s
                  </span>
                </div>
              </div>
              <p style={{ fontFamily: mono, fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginTop: 6 }}>
                AUTO-APPROVE IN {countdown} SECONDS · {crisisType.toUpperCase()} CRISIS · THREAT {threatScore}/100
              </p>
            </div>

            {/* Dispatch Plan */}
            <div style={{ padding: '14px 24px' }}>
              <p style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: '#F59E0B', letterSpacing: 1.5, marginBottom: 10 }}>
                UNITS TO DISPATCH
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dispatchPlan.map((unit, i) => {
                  const typeColors = { hospital: '#22C55E', fire_station: '#F97316', police: '#3B82F6' };
                  const c = typeColors[unit.type] || '#8892A8';
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      background: `${c}08`, border: `1px solid ${c}20`,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${c}15`, border: `1px solid ${c}25`,
                        fontSize: 16,
                      }}>
                        {unit.type === 'hospital' ? '🏥' : unit.type === 'fire_station' ? '🚒' : '🚔'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: '#E8ECF4', letterSpacing: 0.3 }}>
                          {unit.name}
                        </p>
                        <p style={{ fontFamily: mono, fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                          {unit.distance}km · Score: {unit.score} · ETA ~{Math.ceil((unit.distance || 1) * 2)}min
                        </p>
                      </div>
                      <div style={{
                        padding: '2px 8px', borderRadius: 4,
                        background: `${c}15`, border: `1px solid ${c}25`,
                      }}>
                        <span style={{ fontFamily: mono, fontSize: 8, color: c, fontWeight: 700 }}>
                          {unit.type === 'hospital' ? 'MEDICAL' : unit.type === 'fire_station' ? 'FIRE' : 'POLICE'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Reasoning */}
            <div style={{
              padding: '10px 24px 14px',
              borderTop: '1px solid rgba(255,255,255,0.03)',
            }}>
              <p style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: '#A855F7', letterSpacing: 1.5, marginBottom: 6 }}>
                AI REASONING
              </p>
              <p style={{ fontFamily: mono, fontSize: 9, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                {reasoning || 'AI analysis complete. Optimal units selected based on proximity, traffic, and crisis type match.'}
              </p>
            </div>

            {/* Alert Recipients */}
            {contacts.length > 0 && (
              <div style={{
                padding: '10px 24px 14px',
                borderTop: '1px solid rgba(255,255,255,0.03)',
              }}>
                <p style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: '#06B6D4', letterSpacing: 1.5, marginBottom: 6 }}>
                  SMS ALERT RECIPIENTS
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {contacts.map((c, i) => (
                    <div key={i} style={{
                      padding: '4px 10px', borderRadius: 6,
                      background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ fontFamily: mono, fontSize: 8, color: '#06B6D4' }}>📱</span>
                      <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
                        {c.name} · {c.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{
              padding: '14px 24px 20px',
              display: 'flex', gap: 10,
              borderTop: '1px solid rgba(255,255,255,0.04)',
            }}>
              <button
                onClick={onApprove}
                style={{
                  flex: 2, padding: '12px 20px', borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))',
                  border: '1px solid rgba(34,197,94,0.3)',
                  color: '#22C55E', fontFamily: mono, fontSize: 11, fontWeight: 700,
                  letterSpacing: 2, cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.target.style.boxShadow = '0 0 20px rgba(34,197,94,0.15)'; e.target.style.borderColor = '#22C55E'; }}
                onMouseLeave={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'rgba(34,197,94,0.3)'; }}
              >
                ✓ APPROVE DISPATCH
              </button>
              <button
                onClick={onReject}
                style={{
                  flex: 1, padding: '12px 20px', borderRadius: 10,
                  background: 'rgba(15,20,30,0.5)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.3)', fontFamily: mono, fontSize: 10, fontWeight: 600,
                  letterSpacing: 1, cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.target.style.borderColor = 'rgba(239,68,68,0.3)'; e.target.style.color = '#EF4444'; }}
                onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.06)'; e.target.style.color = 'rgba(255,255,255,0.3)'; }}
              >
                ✕ REJECT
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
