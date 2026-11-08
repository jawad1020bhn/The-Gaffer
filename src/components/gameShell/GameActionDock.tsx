import type { JSX, ReactNode } from "react";

interface GameActionDockProps {
  /** Continue and Save; the dashboard builds these from its advance/save state. */
  children?: ReactNode;
}

/**
 * The career's primary actions, docked in the bottom bar's right corner like a HUD panel.
 *
 * Right-aligned in the bar rather than floating over the workspace: Continue stays a thumb's reach
 * away, and the board or a squad table never ends up underneath it. It costs the bar nothing — the
 * hint strip beside it is 28px and the buttons set its height.
 */
export default function GameActionDock({ children }: GameActionDockProps): JSX.Element | null {
  if (!children) return null;

  return (
    <div className="flex shrink-0 items-center gap-2 rounded-panel border border-line bg-panel p-1 shadow-lg">
      {children}
    </div>
  );
}
