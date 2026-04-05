import { Handle, Position } from '@xyflow/react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CustomDecisionNode({ data }) {
  const { category, title, subtitle, text, meta, severity, color, active, reason } = data;
  const [showReason, setShowReason] = useState(false);

  return (
    <div
      style={{
        width: 220,
        background: '#08090f',
        border: `1px solid ${active ? color : color + '40'}`,
        borderRadius: 10,
        boxShadow: active
          ? `0 0 22px ${color}30, inset 0 0 12px ${color}08`
          : '0 4px 24px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}
    >
      {/* ── React Flow connection handles ── */}
      <Handle type="target" position={Position.Left}
        style={{ background: color, width: 8, height: 8, border: 'none', left: -4 }} />
      <Handle type="source" position={Position.Right}
        style={{ background: color, width: 8, height: 8, border: 'none', right: -4 }} />

      {/* ── Header: category label + severity badge ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px',
        borderBottom: `1px solid ${color}18`,
        background: `${color}0a`,
      }}>
        <span style={{
          fontFamily: 'monospace', fontSize: 9, fontWeight: 800,
          color: color, letterSpacing: 1.8, textTransform: 'uppercase',
        }}>
          {category}
        </span>
        {severity && (
          <span style={{
            fontFamily: 'monospace', fontSize: 8, fontWeight: 700,
            color: severity === 'HIGH' ? '#EF4444' : '#EAB308',
            border: `1px solid ${severity === 'HIGH' ? '#EF444440' : '#EAB30840'}`,
            borderRadius: 3, padding: '1px 6px',
            background: 'rgba(0,0,0,0.4)',
          }}>
            {severity === 'HIGH' ? '⚠ HIGH' : '⏱ MED'}
          </span>
        )}
      </div>

      {/* ── Body: station name + distance + status ── */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Primary title — this is the actual station/hospital name */}
        <span style={{
          fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
          color: '#F3F4F6', letterSpacing: 0.3, lineHeight: 1.3,
        }}>
          {title}
        </span>

        {/* Subtitle: distance from incident */}
        {subtitle && (
          <span style={{
            fontFamily: 'monospace', fontSize: 10, color: color,
            letterSpacing: 0.5, fontWeight: 600,
          }}>
            {subtitle}
          </span>
        )}

        {/* Status text (Alerting / Responded / Dispatched) */}
        <span style={{
          fontFamily: 'monospace', fontSize: 10, color: '#9CA3AF',
          lineHeight: 1.5, letterSpacing: 0.3, marginTop: 2,
        }}>
          {text}
        </span>

        {/* Meta: phone number */}
        {meta && (
          <span style={{
            fontFamily: 'monospace', fontSize: 9, color: '#6B7280',
            letterSpacing: 0.3, marginTop: 1,
          }}>
            {meta}
          </span>
        )}
      </div>

      {/* ── AI Reasoning toggle ── */}
      {reason && (
        <div style={{ borderTop: `1px solid ${color}15`, padding: '6px 10px 8px' }}>
          <button
            onClick={e => { e.stopPropagation(); setShowReason(v => !v); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6, padding: '5px 0',
              background: showReason ? `${color}18` : 'transparent',
              border: `1px solid ${color}25`, borderRadius: 6,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = `${color}22`}
            onMouseLeave={e => e.currentTarget.style.background = showReason ? `${color}18` : 'transparent'}
          >
            <span style={{ fontSize: 11 }}>{showReason ? '🧠' : '✨'}</span>
            <span style={{
              fontFamily: 'monospace', fontSize: 8, fontWeight: 700,
              color: color, letterSpacing: 1.2, textTransform: 'uppercase',
            }}>
              {showReason ? 'Hide AI Reasoning' : 'Why this station?'}
            </span>
          </button>

          <AnimatePresence>
            {showReason && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  marginTop: 6, padding: '8px 10px', borderRadius: 6,
                  background: 'rgba(0,0,0,0.55)',
                  border: `1px dashed ${color}35`,
                }}>
                  <p style={{
                    fontFamily: 'monospace', fontSize: 9.5, color: '#D1D5DB',
                    lineHeight: 1.65, letterSpacing: 0.4, margin: 0,
                    fontStyle: 'italic',
                  }}>
                    "{reason}"
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
