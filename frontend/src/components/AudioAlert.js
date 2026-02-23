// AudioAlert.js - Web Audio API + SpeechSynthesis for weather alerts

let audioContext = null;
let lastTier = null;
let dangerIntervalId = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function playTone(frequency, duration, volume = 0.3, type = 'sine') {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

function playAdvisoryChime() {
  playTone(440, 0.2, 0.15, 'sine');
}

function playActionAlert() {
  const ctx = getAudioContext();
  // First tone
  playTone(660, 0.25, 0.4, 'square');
  // Second tone after 300ms
  setTimeout(() => {
    playTone(880, 0.25, 0.4, 'square');
  }, 300);
}

function playDangerAlarm() {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sawtooth';
  gainNode.gain.setValueAtTime(0.6, ctx.currentTime);

  // Oscillate between 440Hz and 880Hz over 2 seconds
  const duration = 2;
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const time = ctx.currentTime + (i * duration) / steps;
    const freq = i % 2 === 0 ? 440 : 880;
    oscillator.frequency.setValueAtTime(freq, time);
  }

  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

function speak(message, volume = 1.0) {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 0.9;
  utterance.pitch = 0.8;
  utterance.volume = volume;
  utterance.lang = 'en-US';

  window.speechSynthesis.speak(utterance);
}

function stopDangerLoop() {
  if (dangerIntervalId) {
    clearInterval(dangerIntervalId);
    dangerIntervalId = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function triggerAudioAlert(tier, alertMessage) {
  // Avoid re-triggering the same tier
  if (tier === lastTier) return;
  lastTier = tier;

  // Stop any running danger loop
  stopDangerLoop();

  switch (tier) {
    case 'ADVISORY':
      playAdvisoryChime();
      break;

    case 'ACTION_REQUIRED':
      playActionAlert();
      setTimeout(() => {
        speak(alertMessage, 0.8);
      }, 700);
      break;

    case 'IMMEDIATE_DANGER':
      playDangerAlarm();
      setTimeout(() => {
        speak(alertMessage, 1.0);
      }, 2200);
      // Repeat every 30 seconds
      dangerIntervalId = setInterval(() => {
        playDangerAlarm();
        setTimeout(() => {
          speak(alertMessage, 1.0);
        }, 2200);
      }, 30000);
      break;

    default:
      break;
  }
}

export function resetAudioAlert() {
  lastTier = null;
  stopDangerLoop();
}
