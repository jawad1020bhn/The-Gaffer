import type { KeyboardEvent } from "react";

/** Alt+arrows moves between visible panels without stealing editing/table arrow keys. */
export function navigatePanels(event: KeyboardEvent<HTMLElement>) {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  const target = event.target as HTMLElement;
  if (target.closest('[role="dialog"]')) return;
  const panels = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-panel]")].filter(
    (panel) => panel.getClientRects().length > 0 && !panel.closest("[hidden], [inert]"),
  );
  if (!panels.length) return;
  const current = panels.findIndex((panel) => panel === target || panel.contains(target));
  const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
  const next =
    current < 0
      ? step > 0
        ? 0
        : panels.length - 1
      : (current + step + panels.length) % panels.length;
  event.preventDefault();
  panels[next].focus({ preventScroll: true });
  panels[next].scrollIntoView?.({ block: "nearest", inline: "nearest" });
}
