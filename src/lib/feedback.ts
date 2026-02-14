/** Lightweight notification feedback utilities (no external deps) */

const FEEDBACK_KEY = "acry-feedback-enabled";

/** Check if feedback is enabled (default: true) */
export function isFeedbackEnabled(): boolean {
  try {
    const val = localStorage.getItem(FEEDBACK_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

/** Set feedback enabled/disabled */
export function setFeedbackEnabled(enabled: boolean) {
  try {
    localStorage.setItem(FEEDBACK_KEY, String(enabled));
  } catch {
    // storage unavailable
  }
}

/** Play a short, pleasant notification chime using Web Audio API */
export function playNotificationSound() {
  if (!isFeedbackEnabled()) return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08); // C#6
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.16); // E6

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not supported — silently ignore
  }
}

/** Trigger a short haptic vibration if supported */
export function triggerHaptic(pattern: number | number[] = 50) {
  if (!isFeedbackEnabled()) return;
  try {
    navigator?.vibrate?.(pattern);
  } catch {
    // Haptic not supported — silently ignore
  }
}

/** Combined feedback for notifications */
export function notifyFeedback() {
  playNotificationSound();
  triggerHaptic([30, 50, 30]);
}
