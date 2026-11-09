import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import FirstDayGuideCard from "./FirstDayGuideCard";
import { acknowledgeMilestone, createCareerJournal } from "./careerJournal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => options?.defaultValue ?? key,
  }),
}));

function game(): GameStateData {
  return {
    clock: { current_date: "2026-07-01", start_date: "2026-07-01" },
    manager: { team_id: "team-1" },
    messages: [{ id: "welcome-1", category: "Welcome", read: true }],
    competitions: [],
  } as unknown as GameStateData;
}

describe("FirstDayGuideCard", () => {
  /** Given partial progress, when the guide renders, then it offers the next real task and a dismiss control. */
  it("shows progress, the next action and dismissal", () => {
    const state = game();
    const journal = acknowledgeMilestone(
      createCareerJournal(state, {
        guidance: "guided",
        background: "outsider",
        philosophy: "Balanced",
      }),
      "squad",
    );
    const onNavigate = vi.fn();
    const onDismiss = vi.fn();

    render(
      <FirstDayGuideCard
        gameState={state}
        journal={journal}
        onNavigate={onNavigate}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText("firstDay.title")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "firstDay.go" }));
    expect(onNavigate).toHaveBeenCalledWith("Tactics", undefined);
    fireEvent.click(screen.getByRole("button", { name: "firstDay.dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  /** Given every essential complete, when the guide renders, then it points to ordinary continuation rather than gating play. */
  it("celebrates readiness without unlocking a withheld feature", () => {
    const state = game();
    let journal = createCareerJournal(state, {
      guidance: "guided",
      background: "outsider",
      philosophy: "Balanced",
    });
    for (const milestone of ["board", "squad", "tactics", "fixture"] as const) {
      journal = acknowledgeMilestone(journal, milestone);
    }

    render(
      <FirstDayGuideCard
        gameState={state}
        journal={journal}
        onNavigate={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByText("firstDay.readyTitle")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "firstDay.go" })).not.toBeInTheDocument();
  });
});
