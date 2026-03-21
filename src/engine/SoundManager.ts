/**
 * Sound manager — Web Audio API synth for UI sounds.
 * No external audio files needed — generates tones programmatically.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume: number = 0.1) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

/** Notification ping — new message */
export function soundNotification() {
  playTone(880, 0.15, "sine", 0.08);
  setTimeout(() => playTone(1100, 0.1, "sine", 0.06), 100);
}

/** Task complete — success chime */
export function soundTaskComplete() {
  playTone(523, 0.12, "sine", 0.07);
  setTimeout(() => playTone(659, 0.12, "sine", 0.07), 100);
  setTimeout(() => playTone(784, 0.2, "sine", 0.07), 200);
}

/** Error — low buzz */
export function soundError() {
  playTone(220, 0.3, "square", 0.05);
}

/** Click — soft tick */
export function soundClick() {
  playTone(600, 0.05, "sine", 0.04);
}

/** Deploy — whoosh (rising pitch) */
export function soundDeploy() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.4);
}

/** Agent select — pop */
export function soundSelect() {
  playTone(440, 0.08, "sine", 0.06);
  setTimeout(() => playTone(660, 0.06, "sine", 0.04), 50);
}

/** Mute state */
let muted = false;

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

export function isMuted(): boolean {
  return muted;
}

// Sound functions already respect mute via isMuted() check
// Export wrapped versions that check mute state
export const sounds = {
  notification: () => { if (!muted) soundNotification(); },
  taskComplete: () => { if (!muted) soundTaskComplete(); },
  error: () => { if (!muted) soundError(); },
  click: () => { if (!muted) soundClick(); },
  deploy: () => { if (!muted) soundDeploy(); },
  select: () => { if (!muted) soundSelect(); },
};
