import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';

export default function CoreNode({ data }) {
  const { statusText, isCrisis } = data;

  const color = isCrisis ? '#EF4444' : '#06B6D4';
  const bgColor = isCrisis ? 'rgba(239,68,68,0.15)' : 'rgba(6,182,212,0.15)';

  return (
    <div style={{
      width: 260,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      pointerEvents: 'none',
    }}>
      {/* ─── Handles for 360 routing (both source + target) ─── */}
      <Handle type="source" position={Position.Top} id="top-src" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top} id="top" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom-src" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} id="left-src" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} id="right-src" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right} id="right" style={{ opacity: 0 }} />
      
      {/* ─── Glowing Orb ─── */}
      <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
            filter: 'blur(16px)',
          }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
        />
        <motion.div
          style={{
            position: 'relative',
            width: 52,
            height: 52,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            background: bgColor,
            backdropFilter: 'blur(12px)',
            border: `2px solid ${color}80`,
            boxShadow: `0 0 30px ${color}40`,
            pointerEvents: 'auto',
            cursor: 'pointer',
          }}
          animate={{ scale: [1, 1.05, 1], borderColor: [`${color}40`, `${color}90`, `${color}40`] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        >
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: color,
            filter: `drop-shadow(0 0 12px ${color})`,
          }} />
        </motion.div>
      </div>

      {/* ─── Status Text (inline, not absolutely positioned) ─── */}
      <div style={{
        marginTop: 8,
        padding: '6px 12px',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.8)',
        border: `1px solid ${color}30`,
        backdropFilter: 'blur(10px)',
        textAlign: 'center',
        maxWidth: 260,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 800,
          color: color,
          letterSpacing: 2,
          display: 'block',
        }}>
          RAKSHAK NEURAL CORE
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          color: '#E5E7EB',
          marginTop: 2,
          display: 'block',
          lineHeight: 1.4,
          wordBreak: 'break-word',
        }}>
          {statusText}
        </span>
      </div>
    </div>
  );
}
