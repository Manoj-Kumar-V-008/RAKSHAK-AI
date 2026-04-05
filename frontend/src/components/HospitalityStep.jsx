import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HOSPITALITY_TYPES = [
  {
    id: 'business-hotel',
    label: 'Business Hotel',
    sub: 'High-Rise Operations',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2"/>
        <line x1="9" y1="6" x2="9" y2="6.01"/>
        <line x1="15" y1="6" x2="15" y2="6.01"/>
        <line x1="9" y1="10" x2="9" y2="10.01"/>
        <line x1="15" y1="10" x2="15" y2="10.01"/>
        <line x1="9" y1="14" x2="9" y2="14.01"/>
        <line x1="15" y1="14" x2="15" y2="14.01"/>
        <path d="M10 22v-4h4v4"/>
      </svg>
    ),
  },
  {
    id: 'luxury-resort',
    label: 'Luxury Resort',
    sub: 'Sprawling Layout',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18"/>
        <path d="M5 21V7l7-4 7 4v14"/>
        <path d="M9 21v-6h6v6"/>
        <circle cx="12" cy="10" r="2"/>
      </svg>
    ),
  },
  {
    id: 'boutique-stay',
    label: 'Boutique Stay',
    sub: 'Heritage / Compact',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18"/>
        <path d="M9 21V9l-4 3V21"/>
        <path d="M15 21V9l4 3V21"/>
        <path d="M9 9l3-6 3 6"/>
        <line x1="12" y1="14" x2="12" y2="17"/>
      </svg>
    ),
  },
  {
    id: 'convention-center',
    label: 'Convention Center',
    sub: 'Crowd / Event Ops',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: 0.15 * i + 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

/**
 * Step 2: Hospitality type selection screen.
 */
export default function HospitalityStep({ onSelect }) {
  const [selected, setSelected] = useState(null);
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
      className="flex flex-col items-center justify-center min-h-screen w-full px-4 relative z-10"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-12"
      >
        <p
          className="label-mono mb-3 pulse-glow"
          style={{ color: 'var(--command-teal)' }}
        >
          ▸ SYSTEM AUTHENTICATED
        </p>
        <h2
          className="text-3xl font-bold tracking-wide"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}
        >
          SELECT COMMAND CONTEXT
        </h2>
        <p
          className="mt-3 text-sm"
          style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
        >
          Define the operational environment for crisis protocols
        </p>
      </motion.div>

      {/* Selection grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl w-full">
        {HOSPITALITY_TYPES.map((type, i) => (
          <motion.div
            key={type.id}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            onClick={() => setSelected(type)}
            className={`hospitality-card glass p-6 flex flex-col items-center text-center gap-3 ${
              selected?.id === type.id ? 'selected' : ''
            }`}
            id={`card-${type.id}`}
          >
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center mb-1"
              style={{
                background: selected?.id === type.id
                  ? 'linear-gradient(135deg, rgba(0,242,255,0.2), rgba(0,242,255,0.05))'
                  : 'rgba(0,242,255,0.06)',
                color: selected?.id === type.id ? 'var(--command-teal)' : 'var(--text-secondary)',
                border: `1px solid ${selected?.id === type.id ? 'rgba(0,242,255,0.3)' : 'rgba(0,242,255,0.08)'}`,
                transition: 'all 0.3s ease',
              }}
            >
              {type.icon}
            </div>
            <h3
              className="text-base font-semibold tracking-wide"
              style={{
                fontFamily: 'var(--font-mono)',
                color: selected?.id === type.id ? 'var(--command-teal)' : 'var(--text-primary)',
              }}
            >
              {type.label}
            </h3>
            <p
              className="text-xs"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}
            >
              {type.sub}
            </p>

            {/* Selection indicator */}
            <AnimatePresence>
              {selected?.id === type.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="w-5 h-5 rounded-full flex items-center justify-center mt-1"
                  style={{
                    background: 'var(--command-teal)',
                    boxShadow: '0 0 12px var(--command-teal-dim)',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0B0E14" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Deploy button */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4 }}
            className="mt-10"
          >
            <button
              id="deploy-btn"
              className="glow-btn-red glow-btn flex items-center gap-3"
              onClick={handleDeploy}
              disabled={deploying}
              style={{ opacity: deploying ? 0.6 : 1, minWidth: 260 }}
            >
              {deploying ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'var(--crisis-red) transparent transparent transparent' }}
                  />
                  DEPLOYING...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v8M8 12h8"/>
                  </svg>
                  DEPLOY COMMAND CENTER
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
