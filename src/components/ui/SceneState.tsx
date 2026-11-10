import type { JSX, ReactNode } from "react";
import { SceneBackdrop } from "./SceneBackdrop";

interface SceneStateProps {
  /**
   * `empty` is a room with nothing in it yet, `loading` is the same room being prepared, `error`
   * is a room the game could not open. They share one stage so the three read as one family
   * rather than three unrelated widgets.
   */
  variant?: "empty" | "loading" | "error";
  /** The headline, in the player's language. Condensed and uppercase by the house style. */
  title: string;
  detail?: string;
  /** The one thing to do about it. An empty state without a way out is a dead end. */
  action?: ReactNode;
  className?: string;
}

/**
 * A full-panel state: the empty stadium before dawn, a headline, and one way forward.
 *
 * Every string arrives from the caller so this holds no copy of its own and needs no translation
 * keys. The stage is decorative; the text is real content and is what a screen reader reaches.
 * `role="status"` on the loading variant announces the wait without stealing focus; the error
 * variant asserts, because the player has to know the room did not open.
 */
export function SceneState({
  variant = "empty",
  title,
  detail,
  action,
  className = "",
}: SceneStateProps): JSX.Element {
  return (
    <div
      role={variant === "loading" ? "status" : variant === "error" ? "alert" : undefined}
      aria-live={variant === "empty" ? undefined : "polite"}
      className={`relative isolate flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-panel border border-line bg-panel surface-panel px-6 py-10 text-center shadow-panel ${className}`}
    >
      <SceneBackdrop scene="empty" strength="ambient" />

      <h3
        className={`animate-panel-in font-heading text-title font-bold uppercase tracking-label motion-reduce:animate-none ${
          variant === "error" ? "text-danger" : "text-fg"
        }`}
      >
        {title}
      </h3>

      {detail ? <p className="max-w-prose text-body text-fg-muted">{detail}</p> : null}

      {variant === "loading" ? (
        // A track being swept, not a spinner: the room is being got ready. Indeterminate by design,
        // so it never claims a percentage the backend has not given.
        <div className="mt-1 h-1 w-48 overflow-hidden rounded-full bg-sunken shadow-well">
          <div className="h-full w-1/3 animate-live-pulse rounded-full bg-selected-fill motion-reduce:animate-none" />
        </div>
      ) : null}

      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
