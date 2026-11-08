import type { JSX, ReactNode } from "react";

interface GameActionDockProps {
  /** Continue and Save; the dashboard builds these from its advance/save state. */
  children?: ReactNode;
}

/**
 * The career's primary actions, floated over the workspace's bottom-right corner like a HUD.
 *
 * A dock rather than a full-width bottom bar: Continue stays a thumb's reach away, the workspace
 * keeps every pixel of height, and the hint strip below it stays readable. The wrapper ignores the
 * pointer so the page underneath is still clickable everywhere the dock isn't.
 */
export default function GameActionDock({ children }: GameActionDockProps): JSX.Element | null {
  if (!children) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--spacing-game-hint)+0.75rem)] z-20 flex justify-end pr-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-panel border border-line bg-panel p-1.5 shadow-2xl">
        {children}
      </div>
    </div>
  );
}
