import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import { createPlayer, createTeam } from "../../test-utils/factories";
import ArrivalSequence from "./ArrivalSequence";
import { createCareerJournal } from "./careerJournal";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === "arrival.appointedHeadline") return `Appointed: ${options?.manager}`;
      return options?.defaultValue ?? key;
    },
    i18n: { language: "en" },
  }),
}));

vi.mock("../ui", async () => ({
  Dialog: ({ children, labelledBy }: { children: React.ReactNode; labelledBy: string }) => (
    <div role="dialog" aria-labelledby={labelledBy}>
      {children}
    </div>
  ),
  Button: ({ children, ...props }: React.ComponentPropsWithoutRef<"button">) => (
    <button {...props}>{children}</button>
  ),
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TeamLogo: () => <span data-testid="team-logo" />,
  PlayerAvatar: () => <span data-testid="player-avatar" />,
}));

function state(): GameStateData {
  const team = createTeam({
    id: "team-1",
    name: "Northbridge United",
    match_roles: {
      captain: "p1",
      vice_captain: null,
      penalty_taker: null,
      free_kick_taker: null,
      corner_taker: null,
    },
  });
  return {
    clock: { current_date: "2026-07-01T00:00:00Z", start_date: "2026-07-01T00:00:00Z" },
    manager: {
      id: "mgr-1",
      display_name: "Alex Mercer",
      team_id: "team-1",
      first_name: "Alex",
      last_name: "Mercer",
    },
    teams: [team],
    players: [
      createPlayer({
        id: "p1",
        team_id: "team-1",
        full_name: "Leo Carter",
        match_name: "L. Carter",
      }),
    ],
    staff: [],
    messages: [],
    news: [],
    league: null,
    competitions: [],
    board_objectives: [
      {
        id: "obj-1",
        description: "Finish in the top half",
        target: 10,
        objective_type: "LeaguePosition",
        met: false,
      },
    ],
    season_context: {},
    scouting_assignments: [],
  } as unknown as GameStateData;
}

describe("ArrivalSequence", () => {
  /** Given the board meeting, when a promise is chosen and confirmed, then the signing scene follows. */
  it("moves from the board meeting to the signing moment with one promise", () => {
    const game = state();
    const journal = createCareerJournal(game, {
      guidance: "guided",
      background: "formerPro",
      philosophy: "HighPress",
    });
    const onAdvance = vi.fn();

    render(
      <ArrivalSequence
        gameState={game}
        journal={journal}
        onAdvance={onAdvance}
        onSkip={() => {}}
      />,
    );

    expect(screen.getByRole("dialog", { name: "arrival.board.title" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /arrival.promises.survival/ }));
    fireEvent.click(screen.getByRole("button", { name: "arrival.board.continue" }));

    expect(onAdvance).toHaveBeenCalledWith("survival");
  });

  /** Given the signing scene, when the player signs, then the ceremony advances without inventing contract terms. */
  it("shows the appointment and advances on sign", async () => {
    const game = state();
    const journal = {
      ...createCareerJournal(game, {
        guidance: "guided",
        background: "legend",
        philosophy: "Counter",
      }),
      arrivalStage: "sign" as const,
    };
    const onAdvance = vi.fn();

    render(
      <ArrivalSequence
        gameState={game}
        journal={journal}
        onAdvance={onAdvance}
        onSkip={() => {}}
      />,
    );

    expect(screen.getByText("arrival.sign.title")).toBeInTheDocument();
    expect(screen.queryByText(/salary|contract length/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "arrival.sign.action" }));
    await waitFor(() => expect(onAdvance).toHaveBeenCalledTimes(1));
  });

  /** Given the welcome scene, when entering the office, then the real club and a key player are shown. */
  it("welcomes the manager with the actual squad", () => {
    const game = state();
    const journal = {
      ...createCareerJournal(game, {
        guidance: "guided",
        background: "outsider",
        philosophy: "Balanced",
      }),
      arrivalStage: "welcome" as const,
    };
    const onAdvance = vi.fn();

    render(
      <ArrivalSequence
        gameState={game}
        journal={journal}
        onAdvance={onAdvance}
        onSkip={() => {}}
      />,
    );

    expect(screen.getAllByText("Northbridge United").length).toBeGreaterThan(0);
    expect(screen.getByText("L. Carter")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "arrival.welcome.action" }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});
