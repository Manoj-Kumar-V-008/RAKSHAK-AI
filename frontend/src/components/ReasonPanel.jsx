import { motion, AnimatePresence } from 'framer-motion';

/**
 * ReasonPanel — A tooltip/side-panel that shows WHY the AI made a particular decision.
 * 
 * Props:
 *  - visible:   boolean
 *  - onClose:   function
 *  - title:     heading for the panel
 *  - reasoning: string — explanation from AI
 *  - factors:   array of strings — factors considered
 *  - rejected:  array of { name, reason } — rejected options
 *  - color:     accent color
 */
export default function ReasonPanel({ visible, onClose, title, reasoning, factors, rejected, color }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 10, scale: 0.97 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="absolute right-0 top-0 bottom-0 z-50 flex flex-col"
          style={{
            width: 260,
            background: 'rgba(5, 7, 10, 0.95)',
            backdropFilter: 'blur(24px)',
            border: `1px solid ${color}30`,
            borderRadius: '0 16px 16px 0',
            boxShadow: `0 8px 40px rgba(0,0,0,0.6), -4px 0 20px ${color}08`,
            overflowY: 'auto',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3"
            style={{ borderBottom: `1px solid ${color}15` }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              color,
              letterSpacing: 2,
            }}>
              {title}
            </span>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors bg-transparent border-none cursor-pointer"
              style={{ fontSize: 14 }}
            >
              ✕
            </button>
          </div>

          {/* Reasoning */}
          <div className="px-4 py-3">
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: '#D1D5DB',
              lineHeight: 1.7,
              letterSpacing: 0.3,
            }}>
              {reasoning || 'No analysis data available yet.'}
            </p>
          </div>

          {/* Factors */}
          {factors && factors.length > 0 && (
            <div className="px-4 pb-3">
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                fontWeight: 700,
                color: '#6B7280',
                letterSpacing: 2,
                marginBottom: 6,
              }}>
                FACTORS
              </p>
              {factors.map((f, i) => (
                <div key={i} className="flex items-start gap-2 mb-1.5">
                  <span style={{ color, fontSize: 8, marginTop: 2 }}>●</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: '#9CA3AF',
                    lineHeight: 1.5,
                  }}>
                    {f}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Rejected Options */}
          {rejected && rejected.length > 0 && (
            <div className="px-4 py-3" style={{ borderTop: `1px solid rgba(239,68,68,0.12)` }}>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                fontWeight: 700,
                color: '#EF4444',
                letterSpacing: 2,
                marginBottom: 6,
              }}>
                REJECTED
              </p>
              {rejected.map((r, i) => (
                <div key={i} className="mb-2.5">
                  <p style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: '#D1D5DB',
                    fontWeight: 600,
                  }}>
                    {r.name}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 8,
                    color: '#6B7280',
                    marginTop: 2,
                    lineHeight: 1.4,
                  }}>
                    {r.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
