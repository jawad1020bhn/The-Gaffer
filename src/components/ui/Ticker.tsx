import { useEffect, useRef, useState } from "react";

interface TickerProps {
  /** The value to arrive at. */
  value: number;
  /** Formats both the in-between frames and the resting value, so money stays money mid-count. */
  format?: (value: number) => string;
  /** Count length. Short: a number changing is feedback, not an animation to watch. */
  durationMs?: number;
  className?: string;
}

const defaultFormat = (value: number) => String(Math.round(value));

/** True when the player has asked for less movement. Read live, so toggling the OS setting works. */
function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A number that counts to its new value instead of jumping.
 *
 * Only the digits move: the element keeps its box and uses tabular numerals, so a changing figure
 * never reflows the panel around it. Under reduced motion it renders the final value immediately.
 * The first render shows `value` as-is — a screen arriving should not count up from zero.
 */
export function Ticker({
  value,
  format = defaultFormat,
  durationMs = 420,
  className = "",
}: TickerProps) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    if (durationMs <= 0 || reducedMotion() || typeof requestAnimationFrame !== "function") {
      fromRef.current = value;
      setShown(value);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease-out: fast away from the old value, settling into the new one.
      const eased = 1 - (1 - t) ** 3;
      const next = from + (value - from) * eased;
      fromRef.current = next;
      setShown(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
        frameRef.current = null;
      }
    };
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      // Resume from wherever it got to, so a rapid second change does not snap back.
      frameRef.current = null;
    };
  }, [value, durationMs]);

  return <span className={`tabular-nums ${className}`}>{format(shown)}</span>;
}
