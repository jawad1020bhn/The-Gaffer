import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Badge } from "./Badge";

interface CardProps {
  children: ReactNode;
  className?: string;
  accent?: "primary" | "accent" | "success" | "danger" | "none";
}

/**
 * A panel on the game canvas: a raised surface with an optional accent strip along its top edge.
 *
 * A card is a column that owns its own scroll. Its parent (a dashboard grid band) decides the
 * height, the header stays put and the body scrolls inside the panel, so a screen never grows past
 * the window. Outside a sized parent the card is as tall as its content, exactly as before.
 */
export function Card({ children, className = "", accent = "none" }: CardProps) {
  const accentBorder = {
    primary: "border-t-4 border-t-primary-500",
    accent: "border-t-4 border-t-accent-400",
    success: "border-t-4 border-t-success-400",
    danger: "border-t-4 border-t-danger-solid",
    none: "border border-line",
  }[accent];

  return (
    <div
      data-panel
      tabIndex={-1}
      className={`
        flex min-h-0 flex-col overflow-hidden
        bg-panel-glass surface-panel
        ${accent === "none" ? accentBorder : `border ${accentBorder} border-line`}
        rounded-panel shadow-panel
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-shadow duration-200 motion-reduce:transition-none
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  action?: ReactNode;
  /** A count beside the title — messages, reports, results. Drawn as a badge, not in the title. */
  count?: number;
  className?: string;
  /**
   * The header's band of its own colour. On by default. Turn it off when the card carries a
   * SceneBackdrop: an opaque band would cover the plate across the top, which is the only part of
   * an art-headed panel where the veil is thin enough to see it. A prop rather than a `bg-*` class
   * so the winner is not decided by the order of the stylesheet.
   */
  banded?: boolean;
}

export function CardHeader({
  children,
  action,
  count,
  className = "",
  banded = true,
}: CardHeaderProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-3 border-b border-line ${banded ? "bg-card-band" : ""} edge-lit px-4 py-2.5 ${className}`}
    >
      <h3 className="flex min-w-0 items-center gap-2 text-lead font-bold font-heading uppercase tracking-label text-fg [&>svg]:shrink-0">
        {children}
        {count !== undefined ? (
          <Badge variant="neutral" size="sm" className="shrink-0 font-sans tabular-nums">
            {count}
          </Badge>
        ) : null}
      </h3>
      {action}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
  /**
   * The default inset. Off for a body that holds a table or a list running edge to edge — a caller
   * that wants no padding passes `p-0` and gets `p-0`, not `p-4 p-0` with the winner decided by
   * the order of the stylesheet.
   */
  padded?: boolean;
}

/** The panel's content. Scrolls on its own once the parent has given the card a height. */
export function CardBody({ children, className = "", padded = true }: CardBodyProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setScrollable(node.scrollHeight > node.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    return () => observer.disconnect();
  }, [children]);
  return (
    <div
      ref={ref}
      tabIndex={scrollable ? 0 : undefined}
      className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus scrollbar-thin scroll-fade min-h-0 flex-1 overflow-auto ${padded ? "p-4" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

/**
 * A panel's footer: a summary line or a quick action that belongs to the panel rather than to the
 * screen. Stays put while the body scrolls, so it is always reachable.
 */
export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div
      className={`flex shrink-0 items-center gap-2 border-t border-line bg-card-band px-4 py-2 ${className}`}
    >
      {children}
    </div>
  );
}
