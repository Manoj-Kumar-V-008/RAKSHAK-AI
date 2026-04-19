import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NODE_COLORS = {
  detect_crisis:   { color: '#F59E0B', label: 'DETECT',  emoji: '🔍' },
  gather_intel:    { color: '#3B82F6', label: 'GATHER',  emoji: '📡' },
  score_services:  { color: '#A855F7', label: 'SCORE',   emoji: '📊' },
  decide_dispatch: { color: '#EF4444', label: 'DECIDE',  emoji: '⚡' },
  confirm:         { color: '#06B6D4', label: 'CONFIRM', emoji: '✅' },
  alert_venue:     { color: '#22C55E', label: 'ALERT',   emoji: '🚨' },
};

const mono = "var(--font-mono, 'JetBrains Mono', monospace)";

function TypewriterText({ text, speed = 18, onDone }) {
  const [displayed, setDisplayed] = useState('');
  const idx = useRef(0);

  useEffect(() => {
    setDisplayed('');
    idx.current = 0;
    const timer = setInterval(() => {
      idx.current++;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) {
        clearInterval(timer);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span style={{ color: '#00F2FF', animation: 'pulse-glow 0.8s infinite' }}>▌</span>
      )}
    </span>
  );
}

export default function ChainOfThought({ steps = [], activeNode = null, isProcessing = false, isPinned = false, onDismiss = null }) {
  const scrollRef = useRef(null);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 28;
    setStickToBottom(nearBottom);
  };

  useEffect(() => {
    if (scrollRef.current && stickToBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps.length, stickToBottom]);

  if (steps.length === 0 && !isProcessing) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 8, padding: 20,
      }}>
        <span style={{ fontSize: 28, opacity: 0.3 }}>🧠</span>
        <span style={{ fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: 1.5, textAlign: 'center' }}>
          CHAIN OF THOUGHT
        </span>
        <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(255,255,255,0.12)', letterSpacing: 0.5, textAlign: 'center' }}>
          Trigger a crisis to see AI reasoning
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden', pointerEvents: 'auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(0,242,255,0.06)',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🧠</span>
          <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: '#00F2FF', letterSpacing: 1.5 }}>
            CHAIN OF THOUGHT
          </span>
          {isPinned && !isProcessing && (
            <span style={{ fontFamily: mono, fontSize: 7, color: '#F59E0B', letterSpacing: 1, padding: '2px 6px', borderRadius: 999, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.16)' }}>
              REVIEW LOCKED
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 1 }}>
            {steps.length} STEPS
          </span>
          {onDismiss && !isProcessing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(239,68,68,0.18)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', cursor: 'pointer', fontFamily: mono, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Clear preserved incident review"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Steps */}
      <div
        ref={scrollRef}
        className="map-cot-panel"
        onScroll={handleScroll}
        onMouseDownCapture={(e) => e.stopPropagation()}
        onPointerDownCapture={(e) => e.stopPropagation()}
        onTouchStartCapture={(e) => e.stopPropagation()}
        onTouchMoveCapture={(e) => e.stopPropagation()}
        onWheelCapture={(e) => e.stopPropagation()}
        style={{
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        padding: '8px 10px',
        scrollBehavior: 'smooth',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
      }}>
        <AnimatePresence initial={false}>
          {steps.map((step, i) => {
            const nodeInfo = NODE_COLORS[step.node] || { color: '#8892A8', label: 'STEP', emoji: '●' };
            const isLatest = i === steps.length - 1;
            const isExpanded = expandedIdx === i;
            
            return (
              <motion.div
                key={`${step.node}-${i}`}
                initial={{ opacity: 0, x: -12, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{ marginBottom: 6 }}
              >
                {/* Step connector line */}
                {i > 0 && (
                  <div style={{
                    width: 2, height: 8, marginLeft: 11,
                    background: `linear-gradient(to bottom, ${NODE_COLORS[steps[i-1]?.node]?.color || '#333'}40, ${nodeInfo.color}40)`,
                  }} />
                )}

                <div
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  style={{
                    display: 'flex', gap: 10, cursor: 'pointer',
                    padding: '8px 10px', borderRadius: 10,
                    background: isLatest ? `${nodeInfo.color}10` : 'rgba(15,20,30,0.4)',
                    border: `1px solid ${isLatest ? `${nodeInfo.color}25` : 'rgba(255,255,255,0.03)'}`,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Node indicator */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${nodeInfo.color}18`,
                      border: `1px solid ${nodeInfo.color}35`,
                      fontSize: 12,
                    }}>
                      {nodeInfo.emoji}
                    </div>
                    <span style={{ fontFamily: mono, fontSize: 6, color: nodeInfo.color, letterSpacing: 0.8, fontWeight: 700 }}>
                      {nodeInfo.label}
                    </span>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontFamily: mono, fontSize: 9, color: 'var(--text-primary)',
                      lineHeight: 1.6, wordBreak: 'break-word',
                    }}>
                      {isLatest && isProcessing ? (
                        <TypewriterText text={step.text} speed={15} />
                      ) : (
                        step.text
                      )}
                    </p>

                    {/* Expanded details */}
                    <AnimatePresence>
                      {isExpanded && step.factors && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.04)' }}
                        >
                          {step.factors.map((f, fi) => (
                            <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <span style={{ color: nodeInfo.color, fontSize: 6 }}>●</span>
                              <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{f}</span>
                            </div>
                          ))}
                          {step.score !== undefined && (
                            <div style={{
                              marginTop: 4, padding: '3px 8px', borderRadius: 4,
                              background: `${nodeInfo.color}10`, display: 'inline-block',
                            }}>
                              <span style={{ fontFamily: mono, fontSize: 8, color: nodeInfo.color, fontWeight: 700 }}>
                                SCORE: {step.score}
                              </span>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Timestamp */}
                  <span style={{
                    fontFamily: mono, fontSize: 7, color: 'rgba(255,255,255,0.15)',
                    flexShrink: 0, marginTop: 2,
                  }}>
                    {step.time || ''}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Active processing indicator */}
        {isProcessing && activeNode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', marginTop: 4,
            }}
          >
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: NODE_COLORS[activeNode]?.color || '#F59E0B',
              boxShadow: `0 0 8px ${NODE_COLORS[activeNode]?.color || '#F59E0B'}`,
              animation: 'pulse-glow 1s infinite',
            }} />
            <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>
              {NODE_COLORS[activeNode]?.label || 'PROCESSING'}...
            </span>
          </motion.div>
        )}

        {!stickToBottom && steps.length > 4 && (
          <div style={{ position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }}>
            <button
              onClick={() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
                setStickToBottom(true);
              }}
              style={{
                border: '1px solid rgba(0,242,255,0.12)',
                background: 'rgba(3,5,8,0.92)',
                color: '#00F2FF',
                borderRadius: 999,
                padding: '5px 10px',
                fontFamily: mono,
                fontSize: 8,
                letterSpacing: 1,
                cursor: 'pointer',
              }}
            >
              JUMP TO LATEST
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
