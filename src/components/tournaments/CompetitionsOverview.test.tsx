import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FixtureData, LeagueData } from "../../store/gameStore";
import CompetitionsOverview, { getCompetitionStatus } from "./CompetitionsOverview";

vi.mock("react-i18next", async () => {
  const { useRef } = await import("react");
  return {
    useTranslation: () => {
      useRef(null);
      return { t: (key: string) => key };
    },
  };
});

function fixture(
  status: "Scheduled" | "Completed",
  competition: FixtureData["competition"] = "League",
  competitive = true,
): FixtureData {
  return {
    competitive,
    advancing_team_id: null,
    id: `f-${Math.random()}`,
    matchday: 1,
    date: "2026-08-01",
    home_team_id: "t1",
    away_team_id: "t2",
    competition,
    status,
    result:
      status === "Completed"
        ? { home_goals: 1, away_goals: 0, home_scorers: [], away_scorers: [] }
        : null,
  };
}

describe("getCompetitionStatus", () => {
  it("returns notStarted when there are no competitive fixtures", () => {
    expect(
      getCompetitionStatus({
        fixtures: [],
        id: "c1",
        name: "X",
        season: 1,
        standings: [],
      } as never),
    ).toBe("notStarted");
  });

  it("returns notStarted when all competitive fixtures are scheduled", () => {
    expect(
      getCompetitionStatus({
        fixtures: [fixture("Scheduled"), fixture("Scheduled")],
        id: "c1",
        name: "X",
        season: 1,
        standings: [],
      } as never),
    ).toBe("notStarted");
  });

  it("returns inProgress when some but not all competitive fixtures are completed", () => {
    expect(
      getCompetitionStatus({
        fixtures: [fixture("Completed"), fixture("Scheduled")],
        id: "c1",
        name: "X",
        season: 1,
        standings: [],
      } as never),
    ).toBe("inProgress");
  });

  it("returns completed when all competitive fixtures are completed", () => {
    expect(
      getCompetitionStatus({
        fixtures: [fixture("Completed"), fixture("Completed")],
        id: "c1",
        name: "X",
        season: 1,
        standings: [],
      } as never),
    ).toBe("completed");
  });

  it("ignores Friendly fixtures when determining status", () => {
    // Only a Friendly is present — no competitive fixtures → notStarted
    expect(
      getCompetitionStatus({
        fixtures: [fixture("Completed", "Friendly", false)],
        id: "c1",
        name: "X",
        season: 1,
        standings: [],
      } as never),
    ).toBe("notStarted");
  });

  it("ignores FriendlyCup fixtures when determining status", () => {
    // A friendly cup is not competitive either (the backend says so on the fixture)
    expect(
      getCompetitionStatus({
        fixtures: [fixture("Completed", "FriendlyCup", false), fixture("Scheduled")],
        id: "c1",
        name: "X",
        season: 1,
        standings: [],
      } as never),
    ).toBe("notStarted");
  });

  it("ignores PreseasonTournament fixtures when determining status", () => {
    // Preseason completed + one real scheduled → notStarted (preseason not counted)
    expect(
      getCompetitionStatus({
        fixtures: [fixture("Completed", "PreseasonTournament", false), fixture("Scheduled")],
        id: "c1",
        name: "X",
        season: 1,
        standings: [],
      } as never),
    ).toBe("notStarted");
  });
});

describe("CompetitionsOverview", () => {
  const competition = (id: string, name: string, logo?: string): LeagueData => ({
    id,
    name,
    season: 2027,
    fixtures: [],
    standings: [],
    logo,
  });

  it("draws each competition's logo in its row, and a trophy where it has none", () => {
    render(
      <CompetitionsOverview
        competitions={[
          competition("eng-premier-league", "Premier League", "/assets/competitions/premier.png"),
          // The game generates this one itself, so no package gave it a logo.
          competition("cup-1", "National Cup"),
        ]}
        userTeamId={null}
        onSelect={vi.fn()}
      />,
    );

    const league = screen.getByRole("button", { name: /Premier League/ });
    expect(league.querySelector("img")).toHaveAttribute("src", "/assets/competitions/premier.png");
    expect(league.querySelector("svg")).not.toBeInTheDocument();

    // Still a mark, so the names in a mixed list start on one line.
    const cup = screen.getByRole("button", { name: /National Cup/ });
    expect(cup.querySelector("img")).not.toBeInTheDocument();
    expect(cup.querySelector("svg")).toBeInTheDocument();
  });
});
