import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

export interface ContextChipProps {
  icon: LucideIcon;
  /** The full name of what the chip shows; also its tooltip, so it survives a truncation. */
  label: string;
  value: string;
  /** A second, quieter line: the league and manager under the club, the venue under the fixture. */
  sub?: string | null;
  onClick?: () => void;
  /** Responsive visibility: the shell keeps Club and Continue, and drops the rest first. */
  className?: string;
  /** Draws attention for a moment when the value changes (the budget after a bid). */
  highlight?: boolean;
}

const CHIP_BASE =
  "group flex h-10 min-w-0 max-w-56 items-center gap-2 rounded-control border border-transparent px-2 text-left transition-colors motion-reduce:transition-none";

/**
 * One fact about the career, in the top bar: icon, value, and an optional quieter line under it.
 *
 * The anti-wrap rule lives here — one line per part, ellipsis when it does not fit, and a tooltip
 * that carries the full text — so four chips can share a 56px bar at any supported width.
 */
export default function ContextChip({
  icon: Icon,
  label,
  value,
  sub,
  onClick,
  className = "",
  highlight = false,
}: ContextChipProps): JSX.Element {
  const className2 = `${CHIP_BASE} ${
    onClick
      ? "cursor-pointer hover:border-line hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-chrome"
      : "cursor-default"
  } ${highlight ? "border-selected/60 bg-selected-tint" : ""} ${className}`;

  const content = (
    <>
      <Icon
        className={`h-4 w-4 shrink-0 ${highlight ? "text-selected" : "text-fg-subtle group-hover:text-selected"}`}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block truncate font-heading text-body font-bold uppercase tracking-label text-fg">
          {value}
        </span>
        {sub ? <span className="block truncate text-caption text-fg-subtle">{sub}</span> : null}
      </span>
    </>
  );

  const title = sub ? `${label} · ${value} · ${sub}` : `${label} · ${value}`;

  return onClick ? (
    <button type="button" onClick={onClick} className={className2} title={title} aria-label={title}>
      {content}
    </button>
  ) : (
    <div className={className2} title={title}>
      {content}
    </div>
  );
}
