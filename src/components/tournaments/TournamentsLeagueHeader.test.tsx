import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TournamentsLeagueHeader from "./TournamentsLeagueHeader";
import type { LeagueData } from "../../store/types";

vi.mock("react-i18next", async () => {
  const { useRef } = await import("react");
  return {
    useTranslation: () => {
      useRef(null);
      return { t: (key: string) => key };
    },
  };
});

const league: LeagueData = {
  id: "eng-premier-league",
  name: "Premier League",
  season: 2027,
  fixtures: [],
  standings: [],
};

function renderHeader(competition: LeagueData) {
  return render(
    <TournamentsLeagueHeader
      league={competition}
      activeCompetitions={[competition]}
      onSelectCompetition={vi.fn()}
      participantCount={20}
      progress={{
        sortedMatchdays: [],
        completedMatchdays: 3,
        totalMatchdays: 38,
        totalGoals: 81,
        completedMatches: 30,
      }}
      worldCupChampion={null}
    />,
  );
}

describe("TournamentsLeagueHeader", () => {
  it("draws the competition's own logo beside its name", () => {
    const { container } = renderHeader({ ...league, logo: "/assets/competitions/premier.png" });

    expect(screen.getByRole("heading", { name: "Premier League" })).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/competitions/premier.png",
    );
    // The logo takes the trophy's place; it is not drawn on top of it.
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("keeps the trophy for a competition that has no logo", () => {
    const { container } = renderHeader(league);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
