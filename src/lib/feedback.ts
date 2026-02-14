/** Lightweight notification feedback utilities (no external deps) */

const FEEDBACK_KEY = "acry-feedback-enabled";
const VOLUME_KEY = "acry-feedback-volume";

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
  } catch {}
}

/** Get volume level 0–100 (default: 50) */
export function getFeedbackVolume(): number {
  try {
    const val = localStorage.getItem(VOLUME_KEY);
    return val === null ? 50 : Math.min(100, Math.max(0, Number(val)));
  } catch {
    return 50;
  }
}

/** Set volume level 0–100 */
export function setFeedbackVolume(volume: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.min(100, Math.max(0, volume))));
  } catch {}
}

/** Play a short, pleasant notification chime using Web Audio API */
export function playNotificationSound() {
  if (!isFeedbackEnabled()) return;
  try {
    const vol = getFeedbackVolume() / 100;
    if (vol === 0) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.16);

    gain.gain.setValueAtTime(0.15 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

/** Trigger a short haptic vibration if supported */
export function triggerHaptic(pattern: number | number[] = 50) {
  if (!isFeedbackEnabled()) return;
  try {
    navigator?.vibrate?.(pattern);
  } catch {}
}

/** Combined feedback for notifications */
export function notifyFeedback() {
  playNotificationSound();
  triggerHaptic([30, 50, 30]);
}

/** Play a gentle warning tone (descending) for nudges */
export function playWarningSound() {
  if (!isFeedbackEnabled()) return;
  try {
    const vol = getFeedbackVolume() / 100;
    if (vol === 0) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(440, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.12 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

/** Combined feedback for warning nudges */
export function nudgeFeedback() {
  playWarningSound();
  triggerHaptic([40, 30, 60]);
}
