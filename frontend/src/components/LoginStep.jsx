import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * Step 1: Login / Authentication screen.
 * Uses inline styles for guaranteed rendering across all builds.
 */
export default function LoginStep({ onLogin }) {
  const [email, setEmail] = useState('manojkumar@mail.com');
  const [securityKey, setSecurityKey] = useState('password123');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Real-time clock
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false }));
      setDateStr(
        now.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !securityKey.trim()) {
      setError('ALL FIELDS REQUIRED');
      return;
    }
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1800));
    setIsSubmitting(false);
    onLogin({ email });
  };

  /* ── shared inline style fragments ── */
  const inputStyle = {
    width: '100%',
    background: 'rgba(5, 9, 17, 0.92)',
    border: '1px solid rgba(27, 42, 58, 0.8)',
    borderRadius: '14px',
    padding: '22px 18px 22px 56px',
    color: '#e2e8f0',
    fontFamily: 'var(--font-sans)',
    fontSize: '15px',
    letterSpacing: '0.04em',
    outline: 'none',
    transition: 'border-color 0.3s',
    boxShadow: 'inset 0 4px 16px rgba(0,0,0,0.8)',
  };

  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'rgba(0, 180, 216, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    marginBottom: '12px',
    paddingLeft: '4px',
  };

  const dotStyle = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'rgba(0, 180, 216, 0.5)',
    flexShrink: 0,
  };

  const iconWrapStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    paddingLeft: '20px',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  };

  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.8 }}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        color: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* ── Background layers ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/bg-server.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.35,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(2,5,14,0.92), rgba(7,13,24,0.82), rgba(2,5,14,0.95))',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(0,180,255,0.05) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Left HUD text ── */}
      <div
        style={{
          position: 'absolute',
          left: 32,
          top: '30%',
          opacity: 0.3,
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.8,
          maxWidth: 220,
          pointerEvents: 'none',
          color: '#8892A8',
        }}
      >
        <p>SYSTEM.CORE.LOAD: 0x00A78F</p>
        <p>NODE_STATUS: NOMINAL</p>
        <p>THROUGHPUT: 4.88 TBps</p>
        <br />
        <p>ENCRYPT_KEY: 2048-BIT RSA</p>
        <p>HANDSHAKE: ESTABLISHED</p>
        <p>SECURE_CHANNEL: ACTIVE</p>
        <br />
        <p>WAITING FOR OPERATOR INPUT...</p>
      </div>

      {/* ── Right HUD text ── */}
      <div
        style={{
          position: 'absolute',
          right: 32,
          top: '30%',
          opacity: 0.3,
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.8,
          maxWidth: 220,
          pointerEvents: 'none',
          textAlign: 'right',
          color: '#8892A8',
        }}
      >
        <p>DATACENTER_IP: 192.168.0.224</p>
        <p>ROUTING_TABLE: SYNCED</p>
        <p>LATENCY: 12ms</p>
        <br />
        <p>PROCESS_MGR_DAEMON</p>
        <p>PID: 49488 running...</p>
        <p>MEM: 44.2% ALLOCATED</p>
      </div>

      {/* ── Top-left logo + status ── */}
      <div
        style={{
          position: 'absolute',
          top: 28,
          left: 28,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: '1px solid rgba(0,180,216,0.3)',
            background: 'rgba(8,47,64,0.4)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 8,
            boxShadow: '0 0 15px rgba(0,180,255,0.15)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--command-teal)" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: '#e2e8f0',
              margin: 0,
            }}
          >
            RAKSHAK AI
          </h2>
          <p
            style={{
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'rgba(0,180,216,0.8)',
              textTransform: 'uppercase',
              marginTop: 4,
            }}
          >
            System: ONLINE [Secure]
          </p>
        </div>
      </div>

      {/* ── Top-right clock ── */}
      <div
        style={{
          position: 'absolute',
          top: 28,
          right: 28,
          zIndex: 10,
          textAlign: 'right',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 6 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#ef4444',
              boxShadow: '0 0 8px rgba(255,0,0,0.8)',
              animation: 'pulse-glow 2s ease-in-out infinite',
            }}
          />
          <span style={{ fontSize: 11, letterSpacing: '0.2em', color: '#9ca3af' }}>LIVE</span>
        </div>
        <p style={{ fontSize: 15, letterSpacing: '0.08em', color: '#d1d5db', margin: 0 }}>
          TIME: {timeStr}
        </p>
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            color: '#6b7280',
            marginTop: 4,
            textTransform: 'uppercase',
          }}
        >
          DATE: {dateStr}
        </p>
      </div>

      {/* ── Center auth card ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          style={{ position: 'relative', width: '92%', maxWidth: 580 }}
        >
          {/* ── Connecting lines ── */}
          <div style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateX(-120px)', width: 120, height: 1, background: 'rgba(0,180,216,0.2)' }} />
          <div style={{ position: 'absolute', top: '50%', right: 0, transform: 'translateX(120px)', width: 120, height: 1, background: 'rgba(0,180,216,0.2)' }} />

          {/* ── Glass card ── */}
          <div
            style={{
              background: 'rgba(11, 19, 30, 0.82)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 24,
              border: '1px solid rgba(0,180,216,0.18)',
              padding: '48px 44px',
              boxShadow: '0 0 60px rgba(0,150,255,0.06)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {/* Top shine */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '25%',
                right: '25%',
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(0,242,255,0.5), transparent)',
              }}
            />

            {/* ── Logo ── */}
            <div
              style={{
                width: 72,
                height: 72,
                background: 'linear-gradient(to bottom, #162e43, #0d1b2a)',
                border: '1px solid rgba(0,180,216,0.3)',
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 14,
                marginBottom: 24,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 2px 4px rgba(0,242,255,0.1)',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>

            <h1
              style={{
                fontSize: 26,
                fontWeight: 500,
                letterSpacing: '0.2em',
                color: '#e2e8f0',
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              RAKSHAK AI
            </h1>
            <p
              style={{
                fontSize: 11,
                letterSpacing: '0.25em',
                fontFamily: 'var(--font-mono)',
                color: 'rgba(0,180,216,0.8)',
                marginBottom: 40,
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              Crisis Command Authentication
            </p>

            {/* ── Form ── */}
            <form onSubmit={handleSubmit} style={{ width: '100%' }}>
              {/* Email */}
              <div style={{ marginBottom: 28 }}>
                <div style={labelStyle}>
                  <span style={dotStyle} />
                  Operator Email
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={iconWrapStyle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@rakshak.ai"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = 'rgba(0,242,255,0.5)')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(27,42,58,0.8)')}
                  />
                </div>
              </div>

              {/* Security Key */}
              <div style={{ marginBottom: 8 }}>
                <div style={labelStyle}>
                  <span style={dotStyle} />
                  Security Key
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={iconWrapStyle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={securityKey}
                    onChange={(e) => setSecurityKey(e.target.value)}
                    placeholder="••••••••••"
                    style={{ ...inputStyle, letterSpacing: '0.35em' }}
                    onFocus={(e) => (e.target.style.borderColor = 'rgba(0,242,255,0.5)')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(27,42,58,0.8)')}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <a
                    href="#"
                    style={{
                      fontSize: 11,
                      color: 'rgba(0,180,216,0.55)',
                      textDecoration: 'none',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Forgot Security Key?
                  </a>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    color: '#ef4444',
                    textAlign: 'center',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    padding: '12px 0',
                    borderRadius: 12,
                    marginBottom: 16,
                    letterSpacing: '0.06em',
                  }}
                >
                  ⚠ {error}
                </div>
              )}

              {/* Submit */}
              <div style={{ marginTop: 28 }}>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 14,
                    padding: '22px 0',
                    border: '1px solid rgba(0,180,216,0.12)',
                    cursor: isSubmitting ? 'wait' : 'pointer',
                    background: 'linear-gradient(to bottom, #112338, #091524, #040a12)',
                    transition: 'transform 0.15s',
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {/* Bottom glow line */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: '#00b4d8',
                      boxShadow: '0 0 15px #00b4d8',
                    }}
                  />
                  {/* Top highlight */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '10%',
                      right: '10%',
                      height: 1,
                      background: 'rgba(255,255,255,0.08)',
                    }}
                  />

                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        letterSpacing: '0.18em',
                        color: '#d1d5db',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {isSubmitting ? 'AUTHENTICATING...' : 'READY TO ENGAGE'}
                    </span>
                    {!isSubmitting && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#d1d5db"
                        strokeWidth="2.5"
                        style={{ opacity: 0.85 }}
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>

      {/* ── Bottom status bar ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            border: '1px solid rgba(107,114,128,0.3)',
            borderRadius: 999,
            overflow: 'hidden',
            background: 'rgba(5,10,17,0.8)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            style={{
              padding: '8px 20px',
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.18em',
              color: '#6b7280',
              textTransform: 'uppercase',
            }}
          >
            VERSION 2.5 SECURITY LEVEL 4
          </div>
          <div
            style={{
              padding: '8px 18px',
              borderLeft: '1px solid rgba(107,114,128,0.3)',
              background: 'rgba(26,44,66,0.3)',
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.18em',
              color: '#e2e8f0',
            }}
          >
            [DATA ENCRYPTED]
          </div>
        </div>
      </div>
    </motion.div>
  );
}
