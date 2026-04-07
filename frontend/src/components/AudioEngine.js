/**
 * AudioEngine — Synthesized military-grade alert tones using Web Audio API.
 * No external files needed. Three tiers of alerts.
 */

let audioCtx = null;
let isMuted = false;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/**
 * Tier 1: Subtle scan beep — plays on periodic scans
 */
export function playScanBeep() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (_) {}
}

/**
 * Tier 2: Warning tone — plays on crisis detection. Two-tone alert.
 */
export function playWarningTone() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 0.25;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, t);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  } catch (_) {}
}

/**
 * Tier 3: Critical siren — plays on CRISIS ACTIVE. Descending klaxon.
 */
export function playCriticalSiren() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    // Three-pulse klaxon
    for (let pulse = 0; pulse < 3; pulse++) {
      const startTime = ctx.currentTime + pulse * 0.5;

      // Main siren oscillator
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(900, startTime);
      osc1.frequency.linearRampToValueAtTime(500, startTime + 0.35);
      gain1.gain.setValueAtTime(0.07, startTime);
      gain1.gain.setValueAtTime(0.07, startTime + 0.25);
      gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
      osc1.connect(gain1).connect(ctx.destination);
      osc1.start(startTime);
      osc1.stop(startTime + 0.42);

      // Sub-bass rumble
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(80, startTime);
      gain2.gain.setValueAtTime(0.05, startTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start(startTime);
      osc2.stop(startTime + 0.42);
    }
  } catch (_) {}
}

/**
 * Tier: Dispatch confirmation — ascending confirmation chime
 */
export function playDispatchConfirm() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch (_) {}
}

/**
 * Tier: SMS sent — short metallic ping
 */
export function playSMSSent() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (_) {}
}

/**
 * Tier: Resolved — pleasant descending chime
 */
export function playResolved() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const notes = [784, 659, 523, 392]; // G5, E5, C5, G4
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.15;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  } catch (_) {}
}

export function setMuted(mute) {
  isMuted = mute;
}

export function getMuted() {
  return isMuted;
}
