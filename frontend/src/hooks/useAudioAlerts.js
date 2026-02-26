import { useRef, useCallback } from 'react';

const audioCtxRef = { current: null };

function getAudioCtx() {
  if (!audioCtxRef.current) {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtxRef.current;
}

function playTone(freq, duration, type = 'sine') {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.3;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration / 1000);
}

function speak(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }
}

export function useAudioAlerts() {
  const lastTier = useRef(null);
  const dangerInterval = useRef(null);

  const playAlert = useCallback((tier, message) => {
    if (tier === lastTier.current) return;
    lastTier.current = tier;

    if (dangerInterval.current) {
      clearInterval(dangerInterval.current);
      dangerInterval.current = null;
    }
    window.speechSynthesis?.cancel();

    switch (tier) {
      case 'ADVISORY':
        playTone(440, 200);
        break;
      case 'ACTION_REQUIRED':
        playTone(660, 250);
        setTimeout(() => playTone(880, 250), 300);
        setTimeout(() => { if (message) speak(message); }, 1000);
        break;
      case 'IMMEDIATE_DANGER':
        const alarm = () => {
          for (let i = 0; i < 6; i++) {
            setTimeout(() => playTone(440 + (i % 2) * 440, 200), i * 250);
          }
          setTimeout(() => { if (message) speak(message); }, 1800);
        };
        alarm();
        dangerInterval.current = setInterval(alarm, 30000);
        break;
      default:
        break;
    }
  }, []);

  const stopAlerts = useCallback(() => {
    if (dangerInterval.current) {
      clearInterval(dangerInterval.current);
      dangerInterval.current = null;
    }
    window.speechSynthesis?.cancel();
    lastTier.current = null;
  }, []);

  return { playAlert, stopAlerts };
}
