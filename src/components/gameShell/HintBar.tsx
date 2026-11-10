import { type JSX, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * The bottom bar's hints, most important first.
 *
 * Order is priority order: when the bar is too narrow the list is cut from the end, never
 * mid-word. Continue and Menu survive the longest because they are the two a new player needs.
 */
const HINTS: { keys: string[]; labelKey: string }[] = [
  { keys: ["Space"], labelKey: "dashboard.continue" },
  { keys: ["Esc"], labelKey: "gameHint.menu" },
  { keys: ["F5"], labelKey: "common.save" },
  { keys: ["Ctrl", "K"], labelKey: "gameNav.search" },
  { keys: ["Enter"], labelKey: "gameHint.select" },
  { keys: ["Alt", "1-5"], labelKey: "gameHint.sections" },
  { keys: ["Alt", "←/→"], labelKey: "gameHint.panels" },
];

const GAP_PX = 16;

/**
 * The left half of the bottom bar: what the input device does here.
 *
 * A hint is dropped whole or shown whole. The old bar let flexbox clip the last one, which is how
 * "Sections" became "Sectio" — a truncated word in the chrome reads as a bug even when every other
 * pixel is right. Widths are measured once with every hint laid out, then re-used on resize, so
 * hiding a hint never changes the measurement the next decision is made from.
 */
export default function HintBar(): JSX.Element {
  const { t } = useTranslation();
  const barRef = useRef<HTMLDivElement>(null);
  const widths = useRef<number[]>([]);
  const [visible, setVisible] = useState(HINTS.length);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    function measure(): void {
      const node = barRef.current;
      if (!node) return;
      const items = [...node.children].filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.dataset.hint === "1",
      );
      // Widths are only trustworthy while every hint is laid out. Once some are hidden their
      // offsetWidth is 0, so keep the first full measurement and only refresh it when all show.
      if (items.length === HINTS.length && items.every((item) => item.offsetWidth > 0)) {
        widths.current = items.map((item) => item.offsetWidth);
      }
      if (widths.current.length !== HINTS.length) return;

      const available = node.clientWidth;
      let used = 0;
      let count = 0;
      for (const width of widths.current) {
        const next = used + (count > 0 ? GAP_PX : 0) + width;
        if (next > available) break;
        used = next;
        count += 1;
      }
      setVisible(count);
    }

    // First pass with everything visible, so the widths are real.
    setVisible(HINTS.length);
    const frame = requestAnimationFrame(measure);
    // ResizeObserver is absent in jsdom and in older WebKitGTK; a window resize listener is the
    // fallback and covers the case that matters (the player resizing the window).
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(bar);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      ref={barRef}
      className="no-select flex min-w-0 flex-1 items-center gap-4 overflow-hidden text-caption text-fg-subtle"
    >
      <p className="sr-only">{t("gameHint.title")}</p>
      {HINTS.map((hint, index) => (
        <span
          key={hint.labelKey}
          data-hint="1"
          className={`shrink-0 items-center gap-1.5 ${index < visible ? "flex" : "hidden"}`}
        >
          {hint.keys.map((key) => (
            <kbd key={key} className="kbd">
              {key}
            </kbd>
          ))}
          <span className="whitespace-nowrap">{t(hint.labelKey)}</span>
        </span>
      ))}
    </div>
  );
}
