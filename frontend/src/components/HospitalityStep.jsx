import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HOSPITALITY_TYPES = [
  {
    id: 'business-hotel',
    label: 'Business Hotel',
    sub: 'High-Rise Operations',
    img: '/img-business-hotel.png',
    stats: { floors: '50+', rooms: '800', evac: '4 min' },
  },
  {
    id: 'luxury-resort',
    label: 'Luxury Resort',
    sub: 'Sprawling Layout',
    img: '/img-luxury-resort.png',
    stats: { floors: '3-5', rooms: '200', evac: '8 min' },
  },
  {
    id: 'boutique-stay',
    label: 'Boutique Stay',
    sub: 'Heritage / Compact',
    img: '/img-boutique-stay.png',
    stats: { floors: '2-4', rooms: '40', evac: '2 min' },
  },
  {
    id: 'convention-center',
    label: 'Convention Center',
    sub: 'Crowd / Event Ops',
    img: '/img-convention-center.png',
    stats: { floors: '1-3', rooms: '50+', evac: '6 min' },
  },
];

/* ── Shared styles ── */
const fonts = {
  mono: "var(--font-mono, 'JetBrains Mono', monospace)",
  sans: "var(--font-sans, 'Inter', sans-serif)",
};

const teal = '#00f2ff';
const tealDim = 'rgba(0,242,255,0.5)';

export default function HospitalityStep({ onSelect }) {
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [deploying, setDeploying] = useState(false);

  const handleDeploy = async () => {
    if (!selected) return;
    setDeploying(true);
    await new Promise((r) => setTimeout(r, 1200));
    onSelect(selected);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.5 }}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      {/* ── Background ambient glow ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(0,180,255,0.04) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ textAlign: 'center', marginBottom: '3vh', position: 'relative', zIndex: 2 }}
      >
        <p
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            letterSpacing: '0.2em',
            color: teal,
            textTransform: 'uppercase',
            marginBottom: 10,
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}
        >
          ▸ SYSTEM AUTHENTICATED
        </p>
        <h2
          style={{
            fontFamily: fonts.mono,
            fontSize: 'clamp(20px, 2.5vw, 36px)',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#e2e8f0',
            margin: 0,
          }}
        >
          SELECT COMMAND CONTEXT
        </h2>
        <p
          style={{
            fontFamily: fonts.mono,
            fontSize: 'clamp(11px, 1vw, 14px)',
            color: '#8892A8',
            marginTop: 10,
          }}
        >
          Define the operational environment for crisis protocols
        </p>
      </motion.div>

      {/* ── Cards Grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'clamp(12px, 1.2vw, 24px)',
          width: '100%',
          maxWidth: 1400,
          position: 'relative',
          zIndex: 2,
        }}
      >
        {HOSPITALITY_TYPES.map((type, i) => {
          const isSelected = selected?.id === type.id;
          const isHovered = hovered === type.id;

          return (
            <motion.div
              key={type.id}
              initial={{ opacity: 0, y: 40, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: 0.15 * i + 0.25,
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
              }}
              onClick={() => setSelected(type)}
              onMouseEnter={() => setHovered(type.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: 'relative',
                borderRadius: 20,
                overflow: 'hidden',
                cursor: 'pointer',
                border: isSelected
                  ? `2px solid ${teal}`
                  : '2px solid rgba(0,242,255,0.08)',
                boxShadow: isSelected
                  ? `0 0 40px rgba(0,242,255,0.15), inset 0 0 40px rgba(0,242,255,0.05)`
                  : isHovered
                  ? '0 8px 40px rgba(0,0,0,0.5)'
                  : '0 4px 20px rgba(0,0,0,0.3)',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isHovered && !isSelected ? 'translateY(-6px)' : 'translateY(0)',
                aspectRatio: '3 / 4',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* ── Image ── */}
              <div
                style={{
                  position: 'relative',
                  flex: '1 1 60%',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={type.img}
                  alt={type.label}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                    filter: isSelected
                      ? 'brightness(0.8) saturate(1.3)'
                      : 'brightness(0.55) saturate(0.9)',
                  }}
                />
                {/* Dark gradient overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to bottom, rgba(5,7,10,0.15) 0%, rgba(5,7,10,0.6) 60%, rgba(11,19,30,0.98) 100%)',
                  }}
                />

                {/* Selection check */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: teal,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 0 20px ${tealDim}`,
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#0B0E14"
                      strokeWidth="3"
                      strokeLinecap="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </motion.div>
                )}

                {/* Status badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    left: 14,
                    padding: '4px 12px',
                    borderRadius: 999,
                    background: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(0,242,255,0.15)',
                    fontSize: 9,
                    fontFamily: fonts.mono,
                    letterSpacing: '0.15em',
                    color: teal,
                    textTransform: 'uppercase',
                  }}
                >
                  {isSelected ? '● SELECTED' : 'AVAILABLE'}
                </div>
              </div>

              {/* ── Info panel ── */}
              <div
                style={{
                  flex: '0 0 auto',
                  padding: 'clamp(14px, 1.5vw, 24px)',
                  background: 'rgba(11, 19, 30, 0.95)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <h3
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 'clamp(14px, 1.1vw, 20px)',
                    fontWeight: 700,
                    color: isSelected ? teal : '#e2e8f0',
                    letterSpacing: '0.06em',
                    margin: 0,
                    transition: 'color 0.3s',
                  }}
                >
                  {type.label}
                </h3>
                <p
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 'clamp(9px, 0.7vw, 12px)',
                    color: '#6b7280',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    margin: 0,
                  }}
                >
                  {type.sub}
                </p>

                {/* Stats row */}
                <div
                  style={{
                    display: 'flex',
                    gap: 'clamp(6px, 0.6vw, 16px)',
                    marginTop: 6,
                    paddingTop: 10,
                    borderTop: '1px solid rgba(0,242,255,0.08)',
                  }}
                >
                  {Object.entries(type.stats).map(([key, val]) => (
                    <div key={key} style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 'clamp(9px, 0.6vw, 10px)',
                          fontFamily: fonts.mono,
                          color: '#4a5568',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          marginBottom: 2,
                        }}
                      >
                        {key === 'evac' ? 'EVAC' : key.toUpperCase()}
                      </div>
                      <div
                        style={{
                          fontSize: 'clamp(12px, 0.9vw, 16px)',
                          fontFamily: fonts.mono,
                          color: isSelected ? teal : '#d1d5db',
                          fontWeight: 600,
                          transition: 'color 0.3s',
                        }}
                      >
                        {val}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom glow line when selected */}
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: teal,
                    boxShadow: `0 0 15px ${teal}`,
                  }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── Deploy button ── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4 }}
            style={{ marginTop: 'clamp(20px, 2.5vh, 40px)', position: 'relative', zIndex: 2 }}
          >
            <button
              onClick={handleDeploy}
              disabled={deploying}
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 14,
                padding: '18px 56px',
                border: '1px solid rgba(255,77,77,0.25)',
                cursor: deploying ? 'wait' : 'pointer',
                background: 'linear-gradient(to bottom, rgba(255,77,77,0.12), rgba(255,77,77,0.04))',
                color: '#FF4D4D',
                fontFamily: fonts.mono,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                transition: 'all 0.3s',
                opacity: deploying ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: '0 0 30px rgba(255,77,77,0.08)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 0 40px rgba(255,77,77,0.15)';
                e.currentTarget.style.borderColor = 'rgba(255,77,77,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 0 30px rgba(255,77,77,0.08)';
                e.currentTarget.style.borderColor = 'rgba(255,77,77,0.25)';
              }}
            >
              {deploying ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 16,
                      height: 16,
                      border: '2px solid transparent',
                      borderTopColor: '#FF4D4D',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  DEPLOYING...
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v8M8 12h8" />
                  </svg>
                  DEPLOY COMMAND CENTER
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spin keyframe injection */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </motion.div>
  );
}
