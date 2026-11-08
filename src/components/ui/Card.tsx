import type { ReactNode } from "react";

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
      className={`
        flex min-h-0 flex-col overflow-hidden
        bg-panel
        ${accent === "none" ? accentBorder : `border ${accentBorder} border-line`}
        rounded-panel shadow-sm dark:shadow-md
        transition-colors duration-300
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
  className?: string;
}

export function CardHeader({ children, action, className = "" }: CardHeaderProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2.5 ${className}`}
    >
      <h3 className="flex min-w-0 items-center gap-2 text-lead font-bold font-heading uppercase tracking-label text-fg [&>svg]:shrink-0">
        {children}
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
  return (
    <div
      className={`scrollbar-thin min-h-0 flex-1 overflow-auto ${padded ? "p-4" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
