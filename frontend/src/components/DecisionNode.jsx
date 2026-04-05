import { motion } from 'framer-motion';

/**
 * DecisionNode — A single card in the OBSERVE → ANALYZE → DECIDE → EXECUTE graph.
 * 
 * Props:
 *  - label:     e.g. "OBSERVE"
 *  - icon:      emoji/symbol for header
 *  - items:     array of { key, value } pairs
 *  - active:    boolean — is this the current stage?
 *  - completed: boolean — has this stage finished?
 *  - delay:     animation entry delay (seconds)
 *  - color:     accent color for this node
 *  - onClick:   handler to expand reasoning
 */
export default function DecisionNode({ label, icon, items, active, completed, delay = 0, color, onClick }) {
  const borderColor = active ? color : completed ? `${color}60` : 'rgba(0,242,255,0.12)';
  const bgColor = active ? `${color}0d` : 'rgba(17,24,39,0.8)';
  const labelColor = active ? color : completed ? `${color}aa` : '#4B5563';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      onClick={onClick}
      className="relative cursor-pointer group"
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 16,
        padding: '14px 16px',
        minWidth: 0,
        transition: 'border-color 0.3s, background 0.3s',
      }}
    >
      {/* Active pulse indicator */}
      {active && (
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      )}

      {/* Completed checkmark */}
      {completed && !active && (
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: '#111827', border: `1px solid ${color}60` }}>
          <span style={{ fontSize: 8, color }}>✓</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          color: labelColor,
        }}>
          {label}
        </span>
      </div>

      {/* Data Items */}
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: '#6B7280',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              {item.key}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: active ? '#E5E7EB' : completed ? '#9CA3AF' : '#4B5563',
              fontWeight: 600,
              textAlign: 'right',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.value || '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Hover hint */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{ boxShadow: `inset 0 0 20px ${color}10, 0 0 15px ${color}08` }} />
    </motion.div>
  );
}
