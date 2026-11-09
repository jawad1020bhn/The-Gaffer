export type UiCue = "move" | "confirm";

const STORAGE_KEY = "ofm-ui-sound-enabled";
let context: AudioContext | null = null;

/** Optional UI sound is off by default and never required to play. */
export function isUiSoundEnabled(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setUiSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Sound is cosmetic; storage failure must not block the game.
  }
}

/** A short synthesized console-style cue. No asset download, no autoplay before a user gesture. */
export function playUiCue(cue: UiCue): void {
  if (
    !isUiSoundEnabled() ||
    typeof window === "undefined" ||
    typeof window.AudioContext !== "function"
  )
    return;
  try {
    context ??= new window.AudioContext();
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(cue === "confirm" ? 660 : 440, now);
    if (cue === "confirm") oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.13);
  } catch {
    // Audio is optional; a blocked context is silent, not an error screen.
  }
}
