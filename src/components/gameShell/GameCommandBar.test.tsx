import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MatchModeType } from "../../hooks/useAdvanceTime";
import GameCommandBar, { type DashboardMatchModeMeta } from "./GameCommandBar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "common.save": "Save",
        "dashboard.saved": "Saved!",
        "dashboard.saving": "Saving…",
        "dashboard.saveGame": "Save game",
        "dashboard.continue": "Continue",
        "dashboard.simulating": "Simulating…",
        "dashboard.matchModeMenu": "Choose match mode",
        "endOfSeason.seasonComplete": "Season complete",
        "continueMenu.skipToMatchDay": "Skip to match day",
        "continueMenu.skipToMatchDayDesc": "Advance to the next fixture",
      };
      return labels[key] ?? key;
    },
  }),
}));

function modeMeta(): Record<MatchModeType, DashboardMatchModeMeta> {
  return {
    live: { desc: "Play live", icon: <span>L</span>, label: "Live" },
    spectator: { desc: "Watch", icon: <span>S</span>, label: "Spectator" },
    delegate: { desc: "Delegate", icon: <span>D</span>, label: "Delegate" },
  };
}

function renderBar(overrides: Partial<Parameters<typeof GameCommandBar>[0]> = {}) {
  const props: Parameters<typeof GameCommandBar>[0] = {
    hasMatchToday: false,
    isAdvancing: false,
    isUnemployed: false,
    isSaving: false,
    matchMode: "live",
    modeMeta: modeMeta(),
    onContinue: vi.fn(),
    onSave: vi.fn(),
    onSelectMatchMode: vi.fn(),
    onSkipToMatchDay: vi.fn(),
    onToggleContinueMenu: vi.fn(),
    saveFlash: false,
    seasonComplete: false,
    showContinueMenu: false,
    ...overrides,
  };
  return { ...render(<GameCommandBar {...props} />), props };
}

describe("GameCommandBar", () => {
  /** Given the command bar, when Save and Continue are pressed, then the existing handlers run. */
  it("keeps save and continue reachable", () => {
    const { props } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onContinue).toHaveBeenCalledTimes(1);
  });

  /** Given the mode menu open, when a mode and skip are chosen, then their handlers run. */
  it("offers match modes and skip to match day", () => {
    const { props } = renderBar({ showContinueMenu: true });
    fireEvent.click(screen.getByRole("button", { name: /Spectator/ }));
    fireEvent.click(screen.getByRole("button", { name: /Skip to match day/ }));
    expect(props.onSelectMatchMode).toHaveBeenCalledWith("spectator");
    expect(props.onSkipToMatchDay).toHaveBeenCalledTimes(1);
  });

  /** Given the dropdown toggle, then it is named for screen readers and has a focus ring. */
  it("names the Continue dropdown toggle", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Choose match mode" })).toHaveClass(
      "focus-visible:ring-focus",
    );
  });

  /** Given saving or saved state, then the button says so and disables while saving. */
  it("announces save progress", () => {
    const { rerender, props } = renderBar({ isSaving: true });
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    rerender(<GameCommandBar {...props} isSaving={false} saveFlash />);
    expect(screen.getByRole("button", { name: "Saved!" })).toBeInTheDocument();
  });

  /** Given season complete, then Continue is disabled and labelled by the backend state. */
  it("does not advance a completed season", () => {
    renderBar({ seasonComplete: true });
    expect(screen.getByRole("button", { name: /Season complete/ })).toBeDisabled();
  });
});
