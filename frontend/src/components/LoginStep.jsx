import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * Step 1 — Premium Login / Authentication screen.
 * Split-screen hero layout with cinematic background and glassmorphic form.
 */
export default function LoginStep({ onLogin }) {
  const [email, setEmail] = useState('operator@rakshak.ai');
  const [securityKey, setSecurityKey] = useState('rakshak2026');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false }));
      setDateStr(now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1800));
    setIsSubmitting(false);
    onLogin({ email: email || 'operator@rakshak.ai' });
  };

  /* ── color tokens ── */
  const teal = '#00f2ff';
  const tealSoft = 'rgba(0,242,255,0.6)';

  /* ── input style ── */
  const mkInput = (focused) => ({
    width: '100%',
    background: 'rgba(5, 9, 17, 0.85)',
    border: `1px solid ${focused ? tealSoft : 'rgba(30,45,65,0.7)'}`,
    borderRadius: 12,
    padding: '20px 18px 20px 52px',
    color: '#e2e8f0',
    fontFamily: "var(--font-sans, 'Inter', sans-serif)",
    fontSize: 15,
    letterSpacing: '0.04em',
    outline: 'none',
    transition: 'border-color 0.3s, box-shadow 0.3s',
    boxShadow: focused
      ? '0 0 20px rgba(0,242,255,0.06), inset 0 2px 12px rgba(0,0,0,0.6)'
      : 'inset 0 2px 12px rgba(0,0,0,0.6)',
  });

  const mono = "var(--font-mono, 'JetBrains Mono', monospace)";
  const sans = "var(--font-sans, 'Inter', sans-serif)";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.8 }}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        background: '#030508',
      }}
    >
      {/* ═══════════════════════════════════════════════
          LEFT HALF — Cinematic Hero
         ═══════════════════════════════════════════════ */}
      <div
        style={{
          flex: '1 1 55%',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Hero image */}
        <img
          src="/bg-command.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'brightness(0.45) saturate(1.2)',
          }}
        />
        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(135deg, rgba(3,5,8,0.7) 0%, rgba(3,5,8,0.3) 50%, rgba(3,5,8,0.85) 100%)',
          }}
        />
        {/* Right edge fade into form side */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '30%',
            background: 'linear-gradient(to right, transparent, #030508)',
          }}
        />

        {/* Content overlay */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 'clamp(24px, 3vw, 48px)',
          }}
        >
          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <img
                src="/rakshak-shield.png"
                alt="Rakshak AI"
                style={{
                  width: 'clamp(36px, 3vw, 56px)',
                  height: 'clamp(36px, 3vw, 56px)',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 10px rgba(0,242,255,0.3))',
                }}
              />
              <div>
                <h2 style={{ fontSize: 'clamp(14px, 1.2vw, 20px)', fontWeight: 700, letterSpacing: '0.2em', color: '#e2e8f0', margin: 0 }}>
                  RAKSHAK AI
                </h2>
                <p style={{ fontSize: 'clamp(8px, 0.6vw, 11px)', letterSpacing: '0.15em', color: tealSoft, textTransform: 'uppercase', marginTop: 3 }}>
                  Crisis Command System
                </p>
              </div>
            </div>

            {/* Live clock */}
            <div style={{ textAlign: 'right', fontFamily: mono }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px rgba(255,0,0,0.8)', animation: 'pulse-glow 2s ease-in-out infinite' }} />
                <span style={{ fontSize: 10, letterSpacing: '0.2em', color: '#9ca3af' }}>LIVE</span>
              </div>
              <p style={{ fontSize: 'clamp(12px, 1vw, 17px)', letterSpacing: '0.08em', color: '#d1d5db', margin: 0 }}>
                {timeStr}
              </p>
              <p style={{ fontSize: 'clamp(8px, 0.6vw, 11px)', letterSpacing: '0.08em', color: '#6b7280', marginTop: 3, textTransform: 'uppercase' }}>
                {dateStr}
              </p>
            </div>
          </div>

          {/* Center hero text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            style={{ maxWidth: 520, marginBottom: '8vh' }}
          >
            <div style={{
              display: 'inline-block',
              padding: '5px 16px',
              borderRadius: 999,
              background: 'rgba(0,242,255,0.08)',
              border: '1px solid rgba(0,242,255,0.15)',
              marginBottom: 20,
            }}>
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.2em', color: teal, textTransform: 'uppercase' }}>
                ● SYSTEM OPERATIONAL
              </span>
            </div>
            <h1
              style={{
                fontFamily: sans,
                fontSize: 'clamp(24px, 2.8vw, 48px)',
                fontWeight: 800,
                lineHeight: 1.15,
                color: '#f1f5f9',
                margin: '0 0 16px 0',
              }}
            >
              Real-Time Crisis
              <br />
              <span style={{ color: teal }}>Command Center</span>
            </h1>
            <p
              style={{
                fontFamily: sans,
                fontSize: 'clamp(12px, 0.9vw, 16px)',
                lineHeight: 1.7,
                color: '#8892A8',
                maxWidth: 420,
              }}
            >
              AI-powered autonomous emergency response platform.
              Deploy intelligent crisis protocols across your entire hospitality infrastructure.
            </p>

            {/* Feature pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
              {['AI-Powered', 'Real-Time', 'Multi-Site', 'Autonomous'].map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    background: 'rgba(0,242,255,0.04)',
                    border: '1px solid rgba(0,242,255,0.1)',
                    fontFamily: mono,
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    color: '#8892A8',
                    textTransform: 'uppercase',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Bottom HUD */}
          <div style={{ display: 'flex', gap: 'clamp(16px, 2vw, 40px)', fontFamily: mono }}>
            {[
              { label: 'Uptime', value: '99.97%' },
              { label: 'Latency', value: '12ms' },
              { label: 'Encryption', value: 'AES-256' },
              { label: 'Protocol', value: 'v4.2' },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 'clamp(7px, 0.5vw, 9px)', color: '#4a5568', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 'clamp(12px, 0.9vw, 16px)', color: '#d1d5db', fontWeight: 600 }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          RIGHT HALF — Auth Form
         ═══════════════════════════════════════════════ */}
      <div
        style={{
          flex: '1 1 45%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: 'clamp(24px, 3vw, 60px)',
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '20%',
            width: '60%',
            height: '60%',
            background: 'radial-gradient(ellipse, rgba(0,242,255,0.03) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          style={{
            width: '100%',
            maxWidth: 440,
            position: 'relative',
          }}
        >
          {/* Shield logo */}
          <div style={{ textAlign: 'center', marginBottom: 'clamp(24px, 2.5vw, 40px)' }}>
            <img
              src="/rakshak-shield.png"
              alt="Rakshak AI Shield"
              style={{
                width: 'clamp(56px, 5vw, 80px)',
                height: 'clamp(56px, 5vw, 80px)',
                objectFit: 'contain',
                margin: '0 auto 16px',
                display: 'block',
                filter: 'drop-shadow(0 0 20px rgba(0,242,255,0.25))',
              }}
            />
            <h1
              style={{
                fontFamily: sans,
                fontSize: 'clamp(20px, 1.8vw, 30px)',
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: '#e2e8f0',
                margin: '0 0 6px 0',
              }}
            >
              AUTHENTICATE
            </h1>
            <p style={{ fontFamily: mono, fontSize: 'clamp(9px, 0.6vw, 11px)', letterSpacing: '0.2em', color: 'rgba(0,242,255,0.6)', textTransform: 'uppercase' }}>
              Secure Operator Access
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>

            {/* Email */}
            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: mono, fontSize: 10, color: 'rgba(0,180,216,0.6)',
                textTransform: 'uppercase', letterSpacing: '0.15em',
                marginBottom: 10, paddingLeft: 2,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(0,180,216,0.4)' }} />
                Operator Email
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, paddingLeft: 18, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a5568" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@rakshak.ai"
                  style={mkInput(focusedField === 'email')}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            {/* Security Key */}
            <div style={{ marginBottom: 8 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: mono, fontSize: 10, color: 'rgba(0,180,216,0.6)',
                textTransform: 'uppercase', letterSpacing: '0.15em',
                marginBottom: 10, paddingLeft: 2,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(0,180,216,0.4)' }} />
                Security Key
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, paddingLeft: 18, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a5568" strokeWidth="1.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={securityKey}
                  onChange={(e) => setSecurityKey(e.target.value)}
                  placeholder="••••••••••"
                  style={{ ...mkInput(focusedField === 'key'), letterSpacing: '0.35em' }}
                  onFocus={() => setFocusedField('key')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <a href="#" style={{ fontSize: 10, color: 'rgba(0,180,216,0.45)', textDecoration: 'none', letterSpacing: '0.05em', fontFamily: sans }}>
                  Forgot Security Key?
                </a>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                fontSize: 11, fontFamily: mono, color: '#ef4444', textAlign: 'center',
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                padding: '10px 0', borderRadius: 10, marginBottom: 12, letterSpacing: '0.06em',
              }}>
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 12,
                padding: '20px 0',
                border: 'none',
                cursor: isSubmitting ? 'wait' : 'pointer',
                background: `linear-gradient(135deg, ${teal}, #0091a4)`,
                transition: 'transform 0.15s, box-shadow 0.3s',
                boxShadow: '0 4px 24px rgba(0,242,255,0.2)',
                marginTop: 24,
                opacity: isSubmitting ? 0.7 : 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 36px rgba(0,242,255,0.35)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,242,255,0.2)'; }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 'clamp(13px, 0.9vw, 15px)',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  color: '#030508',
                  fontFamily: sans,
                }}>
                  {isSubmitting ? 'AUTHENTICATING...' : 'READY TO ENGAGE'}
                </span>
                {!isSubmitting && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#030508" strokeWidth="2.5" style={{ opacity: 0.8 }}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, margin: '28px 0 0',
          }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(0,242,255,0.08)' }} />
            <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: '0.2em', color: '#4a5568', textTransform: 'uppercase' }}>
              Encrypted Connection
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(0,242,255,0.08)' }} />
          </div>

          {/* Trust indicators */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16,
          }}>
            {['AES-256', 'TLS 1.3', 'SOC-2'].map((badge) => (
              <span key={badge} style={{
                fontFamily: mono, fontSize: 9, letterSpacing: '0.12em', color: '#4a5568',
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid rgba(74,85,104,0.2)',
              }}>
                {badge}
              </span>
            ))}
          </div>

          {/* Version footer */}
          <p style={{
            textAlign: 'center', fontFamily: mono, fontSize: 8,
            letterSpacing: '0.15em', color: '#374151', marginTop: 20,
          }}>
            RAKSHAK AI v4.2.1 — SECURITY LEVEL 4
          </p>
        </motion.div>
      </div>

      {/* ── Responsive: Stack on small screens ── */}
      <style>{`
        @media (max-width: 900px) {
          div[style*="flex: 1 1 55%"] {
            display: none !important;
          }
          div[style*="flex: 1 1 45%"] {
            flex: 1 1 100% !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
