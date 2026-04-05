import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * Step 1: Login / Authentication screen.
 * Glassmorphism card, glowing elements, sci-fi server background.
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
      setDateStr(now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
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

  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.8 }}
      className="login-container relative w-full h-full text-white"
    >
      {/* Background Image Container */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 mix-blend-screen"
        style={{ backgroundImage: 'url(/bg-server.png)' }}
      />
      
      {/* Background gradient overlays to ensure text readability and dark vibe */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#02050E]/90 via-[#070D18]/80 to-[#02050E]/95 z-0 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,180,255,0.05)_0%,transparent_60%)] z-0 pointer-events-none" />

      {/* Decorative side HUD text */}
      <div className="absolute left-8 top-1/3 opacity-30 text-[8px] font-mono leading-relaxed max-w-[200px] pointer-events-none z-0">
        <p>SYSTEM.CORE.LOAD: 0x00A78F</p>
        <p>NODE_STATUS: NOMINAL</p>
        <p>THROUGHPUT: 4.88 TBps</p>
        <br/>
        <p>ENCRYPT_KEY: 2048-BIT RSA</p>
        <p>HANDSHAKE: ESTABLISHED</p>
        <p>SECURE_CHANNEL: ACTIVE</p>
        <br/>
        <p>WAITING FOR OPERATOR INPUT...</p>
      </div>

      <div className="absolute right-8 top-1/3 opacity-30 text-[8px] font-mono leading-relaxed max-w-[200px] pointer-events-none text-right z-0">
        <p>DATACENTER_IP: 192.168.0.224</p>
        <p>ROUTING_TABLE: SYNCED</p>
        <p>LATENCY: 12ms</p>
        <br/>
        <p>PROCESS_MGR_DAEMON</p>
        <p>PID: 49488 running...</p>
        <p>MEM: 44.2% ALLOCATED</p>
      </div>

      {/* Top Left Status */}
      <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
        <div className="w-10 h-10 border border-cyan-500/30 bg-cyan-950/40 rounded flex items-center justify-center p-2 shadow-[0_0_15px_rgba(0,180,255,0.15)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--command-teal)" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-widest text-[#e2e8f0]">RAKSHAK AI</h2>
          <p className="text-[10px] tracking-widest text-cyan-500/80 mt-0.5 uppercase">System: ONLINE [Secure]</p>
        </div>
      </div>

      {/* Top Right Clock */}
      <div className="absolute top-6 right-6 z-10 text-right font-mono flex flex-col items-end">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(255,0,0,0.8)]" />
          <span className="text-[10px] tracking-widest text-gray-400">LIVE</span>
        </div>
        <p className="text-xs tracking-wider text-gray-300">TIME: {timeStr}</p>
        <p className="text-[10px] tracking-wider text-gray-500 mt-1 uppercase">DATE: {dateStr}</p>
      </div>

      {/* Center Auth Card */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="auth-card relative p-1 rounded-[24px]"
        >
          {/* Connecting lines deco to the globe */}
          <div className="absolute top-1/2 left-0 -translate-x-[60px] md:-translate-x-[120px] w-[60px] md:w-[120px] h-[1px] bg-cyan-500/20" />
          <div className="absolute top-1/2 right-0 translate-x-[60px] md:translate-x-[120px] w-[60px] md:w-[120px] h-[1px] bg-cyan-500/20" />
          <div className="absolute top-1/2 left-0 -translate-x-[120px] w-[3px] h-[3px] rounded-full bg-cyan-500/50 hidden md:block" />
          <div className="absolute top-1/2 right-0 translate-x-[120px] w-[3px] h-[3px] rounded-full bg-cyan-500/50 hidden md:block" />

          {/* Inner Card content */}
          <div className="bg-[#0b131e]/80 backdrop-blur-xl rounded-[20px] border border-cyan-500/20 p-10 w-[420px] shadow-[0_0_50px_rgba(0,150,255,0.06)] relative overflow-hidden flex flex-col items-center">
            
            {/* Top Shine */}
            <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[#00f2ff]/50 to-transparent" />

            {/* Logo Logo */}
            <div className="w-16 h-16 bg-gradient-to-b from-[#162e43] to-[#0d1b2a] border border-cyan-500/30 rounded-[18px] flex items-center justify-center p-3 mb-5 shadow-[0_8px_32px_rgba(0,0,0,0.6),inset_0_2px_4px_rgba(0,242,255,0.1)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>

            <h1 className="text-[22px] font-medium tracking-[0.15em] text-[#e2e8f0] mb-2">RAKSHAK AI</h1>
            <p className="text-[10px] tracking-[0.2em] font-mono text-cyan-500/80 mb-10 text-center uppercase">Crisis Command Authentication</p>

            <form onSubmit={handleSubmit} className="w-full space-y-6">
              
              {/* Input Group 1 */}
              <div>
                <label className="flex items-center gap-2 text-[10px] font-mono text-cyan-500/70 mb-2 uppercase tracking-widest pl-1">
                  <span className="w-1 h-1 rounded-full bg-cyan-500/50" />
                  Operator Email
                </label>
                <div className="auth-input-wrapper relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-input w-full bg-[#050911]/90 border border-[#1b2a3a] rounded-lg py-3.5 pl-12 pr-4 text-sm font-sans tracking-wide text-gray-200 outline-none focus:border-[#00f2ff]/50 transition-colors shadow-[inset_0_4px_16px_rgba(0,0,0,0.8)]"
                    placeholder="operator@rakshak.ai"
                  />
                </div>
              </div>

              {/* Input Group 2 */}
              <div className="pt-1">
                <label className="flex items-center gap-2 text-[10px] font-mono text-cyan-500/70 mb-2 uppercase tracking-widest pl-1">
                  <span className="w-1 h-1 rounded-full bg-cyan-500/50" />
                  Security Key
                </label>
                <div className="auth-input-wrapper relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={securityKey}
                    onChange={(e) => setSecurityKey(e.target.value)}
                    className="auth-input w-full bg-[#050911]/90 border border-[#1b2a3a] rounded-lg py-3.5 pl-12 pr-4 text-sm tracking-[0.3em] text-gray-200 outline-none focus:border-[#00f2ff]/50 transition-colors shadow-[inset_0_4px_16px_rgba(0,0,0,0.8)]"
                    placeholder="••••••••••"
                  />
                </div>
                <div className="flex justify-end mt-3">
                  <a href="#" className="text-[10px] font-sans text-cyan-500/60 hover:text-cyan-400 transition-colors">Forgot Security Key?</a>
                </div>
              </div>
              
              {error && (
                <div className="text-[11px] font-mono text-red-500 text-center bg-red-500/10 border border-red-500/20 py-2.5 rounded-lg font-medium tracking-wide">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="auth-submit-btn w-full relative group overflow-hidden rounded-lg py-3.5 transition-all duration-200 active:scale-[0.98] border border-[#00f2ff]/20"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[#1a5f97] via-[#0d4677] to-[#062444]" />
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00f2ff] shadow-[0_0_15px_#00f2ff]" />
                  <div className="absolute top-0 left-[10%] right-[10%] h-[1px] bg-white/20" />
                  
                  <div className="relative flex items-center justify-center gap-2">
                    <span className="text-[13px] font-medium tracking-[0.1em] text-white mt-px font-sans">
                      {isSubmitting ? 'AUTHENTICATING...' : 'READY TO ENGAGE'}
                    </span>
                    {!isSubmitting && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white ml-2 opacity-90 group-hover:translate-x-1 transition-transform">
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

      {/* Bottom Status Panel */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <div className="flex border border-gray-700/50 rounded-full overflow-hidden bg-[#050a11]/80 backdrop-blur pb-px">
          <div className="px-5 py-2 text-[9px] font-mono tracking-[0.15em] text-gray-500 uppercase">
            VERSION 2.5 SECURITY LEVEL 4
          </div>
          <div className="px-4 py-2 border-l border-gray-700/50 bg-[#1a2c42]/30 text-[9px] font-mono tracking-[0.15em] text-[#e2e8f0]">
            [DATA ENCRYPTED]
          </div>
        </div>
      </div>
      
    </motion.div>
  );
}
