import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const mono = "var(--font-mono, 'JetBrains Mono', monospace)";

const CAT_STYLES = {
  SYSTEM:    { color: '#00F2FF', emoji: '⚙' },
  DETECTION: { color: '#F59E0B', emoji: '🔍' },
  ANALYSIS:  { color: '#A855F7', emoji: '🧠' },
  DECISION:  { color: '#EF4444', emoji: '⚡' },
  DISPATCH:  { color: '#F97316', emoji: '🚀' },
  RESOLVED:  { color: '#22C55E', emoji: '✅' },
  INTEL:     { color: '#3B82F6', emoji: '📡' },
  COMMS:     { color: '#06B6D4', emoji: '📡' },
  SMS:       { color: '#06B6D4', emoji: '📱' },
  CONFIRM:   { color: '#EAB308', emoji: '⏳' },
};

export default function IncidentTimeline({ entries = [], formatTime }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div ref={scrollRef} style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      maxHeight: 260, overflowY: 'auto', overflowX: 'hidden',
      scrollBehavior: 'smooth',
      paddingRight: 4,
    }}>
      {entries.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px 0', gap: 8,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: '#22C55E',
            animation: 'pulse-glow 2s infinite',
          }} />
          <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>
            SYSTEM NOMINAL · AWAITING EVENTS
          </span>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {entries.slice(-15).map((entry, i) => {
            const style = CAT_STYLES[entry.category] || CAT_STYLES.SYSTEM;
            const isCrisis = ['DETECTION', 'DISPATCH', 'DECISION'].includes(entry.category);

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -8, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', gap: 8 }}
              >
                {/* Timeline connector */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  width: 16, flexShrink: 0,
                }}>
                  {i > 0 && <div style={{ width: 1, height: 4, background: 'rgba(255,255,255,0.05)' }} />}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: style.color,
                    boxShadow: isCrisis ? `0 0 6px ${style.color}` : 'none',
                    opacity: isCrisis ? 1 : 0.5,
                  }} />
                  <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.03)' }} />
                </div>

                {/* Content */}
                <div style={{
                  flex: 1, minWidth: 0,
                  padding: '5px 8px', borderRadius: 8,
                  background: isCrisis ? `${style.color}06` : 'transparent',
                  borderLeft: isCrisis ? `2px solid ${style.color}30` : '2px solid transparent',
                  marginBottom: 2,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{
                      fontFamily: mono, fontSize: 7, fontWeight: 700,
                      color: style.color, letterSpacing: 1, opacity: 0.9,
                    }}>
                      {style.emoji} {entry.category}
                    </span>
                    <span style={{
                      fontFamily: mono, fontSize: 7, color: 'rgba(255,255,255,0.12)',
                      marginLeft: 'auto',
                    }}>
                      {formatTime ? formatTime(entry.timestamp) : ''}
                    </span>
                  </div>
                  <p style={{
                    fontFamily: mono, fontSize: 8, color: 'var(--text-primary)',
                    lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                    opacity: 0.8,
                  }}>
                    {entry.message}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
}
