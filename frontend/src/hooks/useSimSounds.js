import { useCallback, useRef } from 'react';

const audioCtxRef = { current: null };

function getCtx() {
  if (!audioCtxRef.current) {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtxRef.current.state === 'suspended') {
    audioCtxRef.current.resume();
  }
  return audioCtxRef.current;
}

function tone(freq, duration, type = 'sine', vol = 0.15) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export default function useSimSounds() {
  const enabled = useRef(true);

  /** Short ping when focusing on a traveler */
  const playFocusPing = useCallback(() => {
    if (!enabled.current) return;
    tone(880, 0.12, 'sine', 0.12);
    setTimeout(() => tone(1320, 0.1, 'sine', 0.08), 60);
  }, []);

  /** Ascending chime when a new trip starts */
  const playTripStarted = useCallback(() => {
    if (!enabled.current) return;
    tone(523, 0.15, 'sine', 0.1);
    setTimeout(() => tone(659, 0.15, 'sine', 0.1), 100);
    setTimeout(() => tone(784, 0.2, 'sine', 0.08), 200);
  }, []);

  /** Descending tone when a trip completes */
  const playTripCompleted = useCallback(() => {
    if (!enabled.current) return;
    tone(784, 0.15, 'triangle', 0.1);
    setTimeout(() => tone(659, 0.15, 'triangle', 0.1), 120);
    setTimeout(() => tone(523, 0.25, 'triangle', 0.08), 240);
  }, []);

  /** Subtle sweep sound when NWS scan runs */
  const playNwsScan = useCallback(() => {
    if (!enabled.current) return;
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  }, []);

  return { playFocusPing, playTripStarted, playTripCompleted, playNwsScan };
}
