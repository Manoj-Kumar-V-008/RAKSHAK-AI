import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const mono = "var(--font-mono, 'JetBrains Mono', monospace)";

/**
 * TopBarControls — Working notification bell, search, analytics, and account controls.
 * Props:
 *  - userEmail: string
 *  - notifications: [{id, type, message, time, read}]
 *  - onClearNotification: (id) => void
 *  - onClearAll: () => void
 *  - onLogout: () => void
 */
export default function TopBarControls({
  userEmail = '',
  notifications = [],
  onClearNotification,
  onClearAll,
  onLogout,
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const notifRef = useRef(null);
  const accountRef = useRef(null);
  const searchRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) { setSearchOpen(false); setSearchQuery(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Search functionality — search through commands / features
  const SEARCHABLE = [
    { label: 'Crisis Simulator', desc: 'Trigger simulated crisis events', action: 'crisis_sim' },
    { label: 'Neural Engine', desc: 'View AI decision graph', action: 'neural' },
    { label: 'Facility Twin', desc: '3D building visualization', action: 'facility' },
    { label: 'Emergency Contacts', desc: 'Manage SMS alert recipients', action: 'contacts' },
    { label: 'Timeline', desc: 'View incident timeline', action: 'timeline' },
    { label: 'Services', desc: 'Browse nearby emergency services', action: 'services' },
    { label: 'Threat Gauge', desc: 'Current threat assessment', action: 'threat' },
    { label: 'Audio Settings', desc: 'Toggle audio alerts', action: 'audio' },
    { label: 'Chain of Thought', desc: 'AI reasoning steps', action: 'cot' },
  ];

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    setSearchResults(SEARCHABLE.filter(s =>
      s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)
    ));
  }, [searchQuery]);

  // Notification type → style
  const notifStyle = (type) => {
    switch (type) {
      case 'crisis': return { color: '#EF4444', icon: '🚨', bg: 'rgba(239,68,68,0.08)' };
      case 'dispatch': return { color: '#22C55E', icon: '🚀', bg: 'rgba(34,197,94,0.08)' };
      case 'system': return { color: '#06B6D4', icon: '⚙️', bg: 'rgba(6,182,212,0.08)' };
      case 'sms': return { color: '#8B5CF6', icon: '📱', bg: 'rgba(139,92,246,0.08)' };
      case 'alert': return { color: '#F59E0B', icon: '⚠️', bg: 'rgba(245,158,11,0.08)' };
      default: return { color: 'var(--text-secondary)', icon: 'ℹ️', bg: 'rgba(0,0,0,0.1)' };
    }
  };

  const userName = userEmail ? userEmail.split('@')[0].replace(/[._]/g, ' ') : 'Operator';
  const initials = userName.split(' ').map(w => w[0]?.toUpperCase() || '').join('').slice(0, 2) || 'OP';

  // Shared icon button style
  const iconBtn = (isActive) => ({
    width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: isActive ? 'rgba(0,242,255,0.08)' : 'transparent',
    border: `1px solid ${isActive ? 'rgba(0,242,255,0.2)' : 'rgba(255,255,255,0.04)'}`,
    cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
  });

  const dropdownStyle = {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
    background: 'rgba(6,8,14,0.98)', backdropFilter: 'blur(24px)',
    border: '1px solid rgba(0,242,255,0.1)', borderRadius: 12,
    boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 20px rgba(0,242,255,0.03)',
    overflow: 'hidden', zIndex: 1000, minWidth: 280,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

      {/* ═══ SEARCH ═══ */}
      <div ref={searchRef} style={{ position: 'relative' }}>
        <button
          onClick={() => { setSearchOpen(!searchOpen); setAccountOpen(false); setNotifOpen(false); }}
          style={iconBtn(searchOpen)}
          onMouseEnter={(e) => { if (!searchOpen) e.currentTarget.style.borderColor = 'rgba(0,242,255,0.15)'; }}
          onMouseLeave={(e) => { if (!searchOpen) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.97 }}
              style={{ ...dropdownStyle, width: 320 }}
            >
              <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0,242,255,0.06)' }}>
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search commands..."
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,242,255,0.1)',
                    borderRadius: 8, padding: '8px 10px', outline: 'none',
                    fontFamily: mono, fontSize: 11, color: 'var(--text-primary)',
                    letterSpacing: 0.5,
                  }}
                />
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto', padding: '4px' }}>
                {searchQuery && searchResults.length === 0 && (
                  <p style={{ padding: '16px', textAlign: 'center', fontFamily: mono, fontSize: 9, color: 'var(--text-dim)' }}>
                    No results for "{searchQuery}"
                  </p>
                )}
                {(searchQuery ? searchResults : SEARCHABLE.slice(0, 5)).map(item => (
                  <button
                    key={item.action}
                    onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      background: 'transparent', border: 'none', textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,242,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.1)', flexShrink: 0,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--command-teal)" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', marginTop: 1 }}>{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div style={{
                padding: '6px 12px', borderTop: '1px solid rgba(0,242,255,0.04)',
                fontFamily: mono, fontSize: 7, color: 'var(--text-dim)', letterSpacing: 0.5,
              }}>
                ↑↓ Navigate · ⏎ Select · ESC Close
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ ANALYTICS (static for now — shows it's not dummy) ═══ */}
      <button
        style={iconBtn(false)}
        title="System Analytics"
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,242,255,0.15)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      </button>

      {/* ═══ NOTIFICATIONS ═══ */}
      <div ref={notifRef} style={{ position: 'relative' }}>
        <button
          onClick={() => { setNotifOpen(!notifOpen); setAccountOpen(false); setSearchOpen(false); }}
          style={iconBtn(notifOpen)}
          onMouseEnter={e => { if (!notifOpen) e.currentTarget.style.borderColor = 'rgba(0,242,255,0.15)'; }}
          onMouseLeave={e => { if (!notifOpen) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={unreadCount > 0 ? '#F59E0B' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <div style={{
              position: 'absolute', top: -2, right: -2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: '#fff', fontFamily: mono,
              boxShadow: '0 0 6px rgba(239,68,68,0.5)',
              animation: 'pulse-glow 2s infinite',
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>

        <AnimatePresence>
          {notifOpen && (
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.97 }}
              style={dropdownStyle}
            >
              <div style={{
                padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid rgba(0,242,255,0.06)',
              }}>
                <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1.2 }}>
                  NOTIFICATIONS
                </span>
                {notifications.length > 0 && (
                  <button
                    onClick={onClearAll}
                    style={{
                      background: 'none', border: '1px solid rgba(0,242,255,0.08)', borderRadius: 6,
                      padding: '2px 8px', cursor: 'pointer', fontFamily: mono, fontSize: 7,
                      color: 'var(--text-dim)', letterSpacing: 0.5,
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--command-teal)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                  >
                    CLEAR ALL
                  </button>
                )}
              </div>

              <div style={{ maxHeight: 320, overflowY: 'auto', padding: '4px' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, marginBottom: 8, opacity: 0.4 }}>🔔</div>
                    <p style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-dim)' }}>No notifications</p>
                  </div>
                ) : (
                  notifications.slice(0, 20).map(notif => {
                    const s = notifStyle(notif.type);
                    return (
                      <div
                        key={notif.id}
                        style={{
                          display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 8,
                          background: notif.read ? 'transparent' : s.bg,
                          borderLeft: `2px solid ${notif.read ? 'transparent' : s.color}`,
                          transition: 'background 0.15s', cursor: 'pointer', marginBottom: 2,
                        }}
                        onClick={() => onClearNotification?.(notif.id)}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,242,255,0.03)'}
                        onMouseLeave={e => e.currentTarget.style.background = notif.read ? 'transparent' : s.bg}
                      >
                        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 2 }}>{s.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-primary)', fontWeight: notif.read ? 400 : 600, lineHeight: 1.3 }}>
                            {notif.message}
                          </p>
                          <p style={{ fontFamily: mono, fontSize: 7, color: 'var(--text-dim)', marginTop: 3 }}>
                            {notif.time}
                          </p>
                        </div>
                        {!notif.read && (
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0, marginTop: 6 }} />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ ACCOUNT ═══ */}
      <div ref={accountRef} style={{ position: 'relative' }}>
        <button
          onClick={() => { setAccountOpen(!accountOpen); setNotifOpen(false); setSearchOpen(false); }}
          style={{
            ...iconBtn(accountOpen),
            width: 32, height: 32, borderRadius: '50%',
            background: accountOpen
              ? 'linear-gradient(135deg, rgba(0,242,255,0.2), rgba(6,182,212,0.15))'
              : 'linear-gradient(135deg, rgba(0,242,255,0.08), rgba(6,182,212,0.04))',
            border: `1.5px solid ${accountOpen ? 'rgba(0,242,255,0.35)' : 'rgba(0,242,255,0.15)'}`,
            fontFamily: mono, fontSize: 10, fontWeight: 700, color: 'var(--command-teal)',
            letterSpacing: 1,
          }}
        >
          {initials}
        </button>

        <AnimatePresence>
          {accountOpen && (
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.97 }}
              style={{ ...dropdownStyle, minWidth: 240 }}
            >
              {/* Profile Header */}
              <div style={{ padding: '14px', borderBottom: '1px solid rgba(0,242,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, rgba(0,242,255,0.15), rgba(6,182,212,0.08))',
                    border: '1.5px solid rgba(0,242,255,0.25)',
                    fontFamily: mono, fontSize: 13, fontWeight: 700, color: 'var(--command-teal)',
                  }}>
                    {initials}
                  </div>
                  <div>
                    <p style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {userName}
                    </p>
                    <p style={{ fontFamily: mono, fontSize: 8, color: 'var(--text-dim)', marginTop: 1 }}>{userEmail}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 4px #22C55E' }} />
                      <span style={{ fontFamily: mono, fontSize: 7, color: '#22C55E', letterSpacing: 0.8 }}>ACTIVE · AUTHORIZED</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div style={{ padding: '4px' }}>
                {[
                  { icon: '👤', label: 'Profile', desc: 'View operator profile' },
                  { icon: '⚙️', label: 'Settings', desc: 'System configuration' },
                  { icon: '🔑', label: 'Security', desc: 'Access & permissions' },
                  { icon: '📊', label: 'Activity Log', desc: 'Session history' },
                ].map(item => (
                  <button
                    key={item.label}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      background: 'transparent', border: 'none', textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,242,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                      <div style={{ fontFamily: mono, fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Logout */}
              <div style={{ padding: '4px', borderTop: '1px solid rgba(0,242,255,0.04)' }}>
                <button
                  onClick={onLogout}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                    background: 'transparent', border: 'none', textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 14 }}>🚪</span>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: '#EF4444' }}>Sign Out</div>
                    <div style={{ fontFamily: mono, fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>End session</div>
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
