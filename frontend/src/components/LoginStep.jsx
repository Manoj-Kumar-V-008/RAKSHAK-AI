import { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Step 1: Login / Authentication screen.
 * Glassmorphism card with email + security key fields.
 */
export default function LoginStep({ onLogin }) {
  const [email, setEmail] = useState('');
  const [securityKey, setSecurityKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !securityKey.trim()) {
      setError('ALL FIELDS REQUIRED');
      return;
    }

    setIsSubmitting(true);

    // Simulate auth verification delay
    await new Promise((r) => setTimeout(r, 1800));

    setIsSubmitting(false);
    onLogin({ email });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, y: -40 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center justify-center min-h-screen w-full px-4 relative z-10"
    >
      <div className="glass w-full max-w-lg p-10 relative overflow-hidden">
        {/* Scan line effect */}
        <div className="scan-line absolute inset-0 pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-10">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mx-auto mb-6 w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(0,242,255,0.15), rgba(255,77,77,0.15))',
              border: '1px solid rgba(0,242,255,0.2)',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--command-teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold tracking-wider"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--command-teal)' }}
          >
            RAKSHAK AI
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="label-mono mt-3"
            style={{ color: 'var(--text-dim)' }}
          >
            CRISIS COMMAND AUTHENTICATION
          </motion.p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <label className="label-mono block mb-2" style={{ color: 'var(--command-teal-dim)' }}>
              ▸ OPERATOR EMAIL
            </label>
            <input
              id="login-email"
              type="email"
              className="glow-input"
              placeholder="operator@rakshak.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <label className="label-mono block mb-2" style={{ color: 'var(--command-teal-dim)' }}>
              ▸ SECURITY KEY
            </label>
            <input
              id="login-security-key"
              type="password"
              className="glow-input"
              placeholder="••••••••••••"
              value={securityKey}
              onChange={(e) => setSecurityKey(e.target.value)}
              autoComplete="current-password"
            />
          </motion.div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-2 rounded-lg"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--crisis-red)',
                background: 'rgba(255, 77, 77, 0.08)',
                border: '1px solid rgba(255, 77, 77, 0.2)',
              }}
            >
              ⚠ {error}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="pt-3"
          >
            <button
              id="login-submit"
              type="submit"
              className="glow-btn w-full flex items-center justify-center gap-3"
              disabled={isSubmitting}
              style={{ opacity: isSubmitting ? 0.6 : 1 }}
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'var(--command-teal) transparent transparent transparent' }}
                  />
                  INITIALIZING...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  INITIALIZE SYSTEM
                </>
              )}
            </button>
          </motion.div>
        </form>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-center"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}
        >
          ENCRYPTED CONNECTION ● AES-256 ● v4.2.1
        </motion.div>
      </div>
    </motion.div>
  );
}
