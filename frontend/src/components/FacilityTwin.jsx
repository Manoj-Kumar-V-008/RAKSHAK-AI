import { motion } from 'framer-motion';

/**
 * ZONES mapping matches the simulated data injected by CrisisSimulator
 */
const ZONES = [
  { id: 'kitchen', label: 'Kitchen & Dining', path: 'M50 50 h 200 v 150 h -200 Z', textPos: { x: 150, y: 125 } },
  { id: 'lobby', label: 'Main Lobby Level 1', path: 'M250 50 h 300 v 250 h -300 Z', textPos: { x: 400, y: 175 } },
  { id: 'eastgate', label: 'East Gate (Sector B)', path: 'M550 50 h 150 v 250 h -150 Z', textPos: { x: 625, y: 175 } },
  { id: 'sectorc', label: 'Sector C (Main Grid)', path: 'M50 200 h 200 v 200 h -200 Z', textPos: { x: 150, y: 300 } },
  { id: 'basement', label: 'Basement B2 (Utility)', path: 'M250 300 h 450 v 100 h -450 Z', textPos: { x: 475, y: 350 } },
];

export default function FacilityTwin({ crisisInfo, evacuationZone, alertMessage }) {
  // Infer active zone based on crisis type or string matching of location
  let activeZoneId = null;
  if (crisisInfo?.active && crisisInfo?.sensorData?.location) {
    const loc = crisisInfo.sensorData.location.toLowerCase();
    if (loc.includes('kitchen')) activeZoneId = 'kitchen';
    else if (loc.includes('lobby')) activeZoneId = 'lobby';
    else if (loc.includes('east gate') || loc.includes('eastgate')) activeZoneId = 'eastgate';
    else if (loc.includes('sector c')) activeZoneId = 'sectorc';
    else if (loc.includes('basement')) activeZoneId = 'basement';
  }

  // Infer evacuation zone
  let evacZoneId = null;
  if (evacuationZone) {
    const loc = evacuationZone.toLowerCase();
    if (loc.includes('kitchen')) evacZoneId = 'kitchen';
    else if (loc.includes('lobby')) evacZoneId = 'lobby';
    else if (loc.includes('east gate') || loc.includes('eastgate')) evacZoneId = 'eastgate';
    else if (loc.includes('sector c')) evacZoneId = 'sectorc';
    else if (loc.includes('basement')) evacZoneId = 'basement';
  }

  // Determine critical color based on severity (fallback to red)
  const crisisColor = crisisInfo?.color || '#EF4444';

  return (
    <div className="relative w-full h-full flex items-center justify-center p-8">
      {/* ─── High-Tech Grid & Scanline Background ─── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(rgba(0, 242, 255, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 242, 255, 0.05) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }}>
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(circle at center, transparent 30%, rgba(5,7,10,0.9) 100%)'
        }} />
      </div>

      <div className="relative w-full max-w-3xl aspect-video rounded-3xl overflow-hidden glass p-4"
           style={{ border: '1px solid rgba(0, 242, 255, 0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
        
        {/* Header HUD */}
        <div className="absolute top-6 left-8 z-10">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--command-teal)', letterSpacing: 2 }}>
            FACILITY TWIN <span style={{ opacity: 0.5 }}>//</span> LIVE
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1, marginTop: 4 }}>
            SENSOR MESH: <span style={{ color: '#22C55E' }}>47/47 ONLINE</span>
          </p>
        </div>

        {/* The SVG Floor Plan */}
        <svg 
          viewBox="0 0 800 450" 
          className="w-full h-full"
          style={{ filter: 'drop-shadow(0 0 10px rgba(0,242,255,0.1))' }}
        >
          {ZONES.map((zone) => {
            const isActive = activeZoneId === zone.id;
            
            return (
              <g key={zone.id}>
                <motion.path
                  d={zone.path}
                  fill={isActive ? `${crisisColor}22` : 'rgba(11, 14, 20, 0.6)'}
                  stroke={isActive ? crisisColor : 'rgba(0, 242, 255, 0.3)'}
                  strokeWidth={isActive ? 3 : 1.5}
                  animate={
                    isActive 
                      ? { fill: [`${crisisColor}11`, `${crisisColor}44`, `${crisisColor}11`] }
                      : {}
                  }
                  transition={isActive ? { repeat: Infinity, duration: 1.5 } : {}}
                  style={{ cursor: 'crosshair', transition: 'stroke 0.3s ease' }}
                />
                
                {isActive && (
                   <motion.circle
                     cx={zone.textPos.x}
                     cy={zone.textPos.y - 15}
                     r={12}
                     fill="transparent"
                     stroke={crisisColor}
                     strokeWidth="2"
                     initial={{ scale: 0.5, opacity: 1 }}
                     animate={{ scale: 3, opacity: 0 }}
                     transition={{ repeat: Infinity, duration: 1.5 }}
                   />
                )}

                <text
                  x={zone.textPos.x}
                  y={zone.textPos.y}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  fill={isActive ? crisisColor : 'rgba(0, 242, 255, 0.5)'}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: isActive ? '14px' : '11px',
                    fontWeight: isActive ? 800 : 500,
                    letterSpacing: '1px',
                    textShadow: isActive ? `0 0 8px ${crisisColor}` : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {zone.label.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Connective / Core paths just for tech aesthetics */}
          <path d="M 250 50 L 250 400 M 550 50 L 550 300" stroke="rgba(0, 242, 255, 0.1)" strokeWidth="2" strokeDasharray="4 4" />
        </svg>

        {/* Evacuation Overlays */}
        {ZONES.map((zone) => {
          if (evacZoneId !== zone.id) return null;
          return (
            <div
              key={`evac-${zone.id}`}
              className="absolute bg-red-600 animate-pulse text-white font-bold p-2 rounded text-center whitespace-nowrap"
              style={{
                left: `${(zone.textPos.x / 800) * 100}%`,
                top: `${(zone.textPos.y / 450) * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 20,
                boxShadow: '0 0 15px rgba(239, 68, 68, 0.8)',
                fontFamily: 'var(--font-mono)'
              }}
            >
              🚨 EVACUATE IMMEDIATELY
            </div>
          );
        })}

        {/* Active Zone Readout Overlay */}
        {crisisInfo?.active && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute bottom-6 right-8 p-4 rounded-xl"
            style={{ 
              background: 'rgba(8,10,16,0.9)', 
              backdropFilter: 'blur(12px)',
              border: `1px solid ${crisisColor}40`,
              boxShadow: `0 0 20px ${crisisColor}20`
            }}
          >
             <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: crisisColor, fontWeight: 700, letterSpacing: 1.5 }}>
               ⚠️ ZONE COMPROMISED
             </p>
             <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', marginTop: 4 }}>
               ISOLATING SECTOR...
             </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
