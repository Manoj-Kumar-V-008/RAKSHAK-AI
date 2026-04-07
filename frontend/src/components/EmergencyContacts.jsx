import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const mono = "var(--font-mono, 'JetBrains Mono', monospace)";

/**
 * EmergencyContacts — Manage phone numbers for SMS/call alerts.
 * Persists in localStorage. Shows delivery status during crisis.
 */
export default function EmergencyContacts({ contacts = [], onAdd, onRemove, smsResults = [] }) {
  const [inputPhone, setInputPhone] = useState('');
  const [inputName, setInputName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const handleAdd = () => {
    const phone = inputPhone.trim().replace(/\s/g, '');
    const name = inputName.trim() || 'Contact';
    if (phone.length >= 10) {
      onAdd?.({ name, phone: phone.startsWith('+') ? phone : `+91${phone}` });
      setInputPhone('');
      setInputName('');
      setShowAdd(false);
    }
  };

  return (
    <div style={{ padding: '0 14px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>📱</span>
          <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: '#06B6D4', letterSpacing: 1.5 }}>
            ALERT RECIPIENTS
          </span>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{
            padding: '3px 8px', borderRadius: 6,
            background: showAdd ? 'rgba(239,68,68,0.08)' : 'rgba(6,182,212,0.08)',
            border: `1px solid ${showAdd ? 'rgba(239,68,68,0.15)' : 'rgba(6,182,212,0.15)'}`,
            color: showAdd ? '#EF4444' : '#06B6D4',
            fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: 1,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {showAdd ? '✕' : '+ ADD'}
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: '10px', borderRadius: 10, marginBottom: 8,
              background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.1)',
            }}
          >
            <input
              value={inputName}
              onChange={e => setInputName(e.target.value)}
              placeholder="Name (e.g. Manoj)"
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 6, marginBottom: 6,
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(6,182,212,0.1)',
                color: '#E8ECF4', fontFamily: mono, fontSize: 10, outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={inputPhone}
                onChange={e => setInputPhone(e.target.value)}
                placeholder="+91 XXXXXXXXXX"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 6,
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(6,182,212,0.1)',
                  color: '#E8ECF4', fontFamily: mono, fontSize: 10, outline: 'none',
                }}
              />
              <button
                onClick={handleAdd}
                style={{
                  padding: '7px 14px', borderRadius: 6,
                  background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.25)',
                  color: '#06B6D4', fontFamily: mono, fontSize: 9, fontWeight: 700,
                  cursor: 'pointer', letterSpacing: 1,
                }}
              >
                ADD
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact list */}
      {contacts.length === 0 ? (
        <div style={{
          padding: '12px', borderRadius: 8, textAlign: 'center',
          border: '1px dashed rgba(6,182,212,0.1)',
        }}>
          <p style={{ fontFamily: mono, fontSize: 8, color: 'rgba(255,255,255,0.15)', letterSpacing: 0.5 }}>
            No contacts added. Add a phone number to receive SMS alerts.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {contacts.map((contact, i) => {
            const sms = smsResults.find(s => s.phone === contact.phone);
            const maskedPhone = contact.phone.replace(/(\+\d{2})(\d{3})(\d{4})(\d+)/, '$1 $2 **** $4');
            
            return (
              <motion.div
                key={contact.phone}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 8,
                  background: sms?.status === 'delivered' ? 'rgba(34,197,94,0.05)' :
                              sms?.status === 'sending' ? 'rgba(245,158,11,0.05)' :
                              'rgba(15,20,30,0.4)',
                  border: `1px solid ${sms?.status === 'delivered' ? 'rgba(34,197,94,0.15)' :
                                       sms?.status === 'sending' ? 'rgba(245,158,11,0.15)' :
                                       'rgba(255,255,255,0.03)'}`,
                  transition: 'all 0.3s ease',
                }}
              >
                {/* Status dot */}
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: sms?.status === 'delivered' ? '#22C55E' :
                              sms?.status === 'sending' ? '#F59E0B' :
                              sms?.status === 'failed' ? '#EF4444' :
                              'rgba(255,255,255,0.15)',
                  boxShadow: sms?.status === 'delivered' ? '0 0 4px #22C55E' :
                             sms?.status === 'sending' ? '0 0 4px #F59E0B' : 'none',
                  animation: sms?.status === 'sending' ? 'pulse-glow 1s infinite' : 'none',
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: mono, fontSize: 9, color: '#E8ECF4', fontWeight: 600 }}>
                    {contact.name}
                  </p>
                  <p style={{ fontFamily: mono, fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
                    {maskedPhone}
                  </p>
                </div>

                {sms?.status && (
                  <span style={{
                    fontFamily: mono, fontSize: 7, fontWeight: 700, letterSpacing: 0.8,
                    color: sms.status === 'delivered' ? '#22C55E' :
                           sms.status === 'sending' ? '#F59E0B' : '#EF4444',
                  }}>
                    {sms.status === 'delivered' ? '✓ SENT' :
                     sms.status === 'sending' ? '⏳ SENDING' : '✕ FAILED'}
                  </span>
                )}

                <button
                  onClick={() => onRemove?.(contact.phone)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.15)', fontSize: 10, padding: 2,
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => e.target.style.color = '#EF4444'}
                  onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.15)'}
                >
                  ✕
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
