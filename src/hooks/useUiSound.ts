import { useCallback } from "react";

/**
 * The single place UI sound is triggered.
 *
 * It is deliberately a no-op. The brief asks for a central hook so that wiring sound later is one
 * file's work rather than a hunt through every component, and shipping actual audio now would mean
 * adding assets and a playback path nobody has approved. Call sites are real; the output is silent.
 *
 * To make it audible: load the samples once, keep a small pool of Audio elements per name so rapid
 * repeats do not cut each other off, and gate on a user setting. Respect the same enabling gesture
 * the browser requires — do not play on mount.
 */
export type UiSound = "navigate" | "select" | "confirm" | "back" | "advance" | "error";

/** Names are typed so a typo at a call site is a compile error, not a silent miss. */
export function useUiSound(): (sound: UiSound) => void {
  return useCallback((_sound: UiSound) => {
    // Intentionally silent. See the note above before adding playback.
  }, []);
}
