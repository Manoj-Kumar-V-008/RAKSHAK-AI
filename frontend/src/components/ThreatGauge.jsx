import { useEffect, useRef } from 'react';

const TIER_COLORS = {
  GREEN:    '#22C55E',
  YELLOW:   '#EAB308',
  ORANGE:   '#F97316',
  RED:      '#EF4444',
  CRITICAL: '#DC2626',
};

function getTier(score) {
  if (score <= 30) return 'GREEN';
  if (score <= 55) return 'YELLOW';
  if (score <= 75) return 'ORANGE';
  if (score <= 90) return 'RED';
  return 'CRITICAL';
}

const mono = "var(--font-mono, 'JetBrains Mono', monospace)";

export default function ThreatGauge({ score = 0, cascadeRisk = 0, crisisType = '', isActive = false }) {
  const displayScore = Math.min(100, Math.max(0, Math.round(score)));
  const tier = getTier(displayScore);
  const color = TIER_COLORS[tier];
  
  // SVG arc math
  const radius = 52;
  const circumference = Math.PI * radius; // half circle
  const progress = (displayScore / 100) * circumference;
  
  const animRef = useRef(null);
  const prevScore = useRef(0);
  const currentAnim = useRef(0);

  useEffect(() => {
    const start = currentAnim.current;
    const end = displayScore;
    const duration = 800;
    const startTime = performance.now();

    function animate(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      currentAnim.current = start + (end - start) * eased;
      
      const el = animRef.current;
      if (el) {
        const val = Math.round(currentAnim.current);
        el.textContent = val;
      }
      
      if (t < 1) requestAnimationFrame(animate);
    }
    
    requestAnimationFrame(animate);
    prevScore.current = displayScore;
  }, [displayScore]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '10px 12px',
      background: isActive ? `${color}08` : 'rgba(15,20,30,0.5)',
      border: `1px solid ${isActive ? `${color}30` : 'rgba(255,255,255,0.04)'}`,
      borderRadius: 14,
      transition: 'all 0.5s ease',
      minWidth: 140,
    }}>
      {/* SVG Gauge */}
      <svg width="120" height="72" viewBox="0 0 130 75">
        {/* Background arc */}
        <path
          d="M 10 65 A 52 52 0 0 1 120 65"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d="M 10 65 A 52 52 0 0 1 120 65"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference - progress}
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease',
            filter: `drop-shadow(0 0 6px ${color}60)`,
          }}
        />
        {/* Score text */}
        <text
          ref={animRef}
          x="65" y="52"
          textAnchor="middle"
          fill={color}
          style={{
            fontFamily: mono, fontSize: 26, fontWeight: 800,
            filter: `drop-shadow(0 0 8px ${color}40)`,
          }}
        >
          {displayScore}
        </text>
        <text x="65" y="68" textAnchor="middle" fill="rgba(255,255,255,0.3)"
          style={{ fontFamily: mono, fontSize: 7, letterSpacing: 2 }}>
          THREAT SCORE
        </text>
        {/* Tier label on left */}
        <text x="8" y="72" textAnchor="start" fill={color}
          style={{ fontFamily: mono, fontSize: 6, fontWeight: 700, letterSpacing: 1 }}>
          0
        </text>
        <text x="122" y="72" textAnchor="end" fill="rgba(255,255,255,0.2)"
          style={{ fontFamily: mono, fontSize: 6, letterSpacing: 1 }}>
          100
        </text>
      </svg>

      {/* Tier Badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 6,
        background: `${color}15`, border: `1px solid ${color}30`,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: isActive ? 'pulse-glow 1s infinite' : 'none',
        }} />
        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color, letterSpacing: 1.5 }}>
          {tier}
        </span>
        {crisisType && (
          <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>
            · {crisisType.toUpperCase()}
          </span>
        )}
      </div>

      {/* Cascade Risk */}
      {cascadeRisk > 0.05 && (
        <div style={{ width: '100%', marginTop: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>
              CASCADE RISK
            </span>
            <span style={{ fontFamily: mono, fontSize: 8, color: '#F97316', fontWeight: 700 }}>
              {(cascadeRisk * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{
            width: '100%', height: 3, borderRadius: 2,
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${cascadeRisk * 100}%`, height: '100%',
              borderRadius: 2,
              background: 'linear-gradient(90deg, #F97316, #EF4444)',
              transition: 'width 0.8s ease',
              boxShadow: '0 0 6px rgba(249,115,22,0.4)',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
