import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TeamSelectionScopePanel from "./TeamSelectionScopePanel";
import type { LeagueData } from "../store/gameStore";

vi.mock("react-i18next", async () => {
  const { useRef } = await import("react");
  return {
    useTranslation: () => {
      useRef(null);
      return { t: (key: string) => key, i18n: { language: "en" } };
    },
  };
});

const competition = (id: string, name: string, logo?: string): LeagueData => ({
  id,
  name,
  season: 2027,
  fixtures: [],
  standings: [],
  logo,
});

function renderPanel(competitions: LeagueData[]) {
  return render(
    <TeamSelectionScopePanel
      scopeExpanded
      onToggleScopeExpanded={vi.fn()}
      regions={[]}
      selectedHomeRegionId={null}
      onSelectHomeRegion={vi.fn()}
      selectedCountryCode={null}
      onSelectCountry={vi.fn()}
      regionCountries={[]}
      regionSelection={{}}
      onRegionToggle={vi.fn()}
      availableCompetitions={competitions}
      competitionSelection={{}}
      mandatoryCompetitionIds={new Set()}
      activeRegionIds={[]}
      onCompetitionToggle={vi.fn()}
    />,
  );
}

describe("TeamSelectionScopePanel", () => {
  it("draws each competition's logo beside its name, and a trophy where it has none", () => {
    renderPanel([
      competition("eng-premier-league", "Premier League", "/assets/competitions/premier.png"),
      competition("cup-1", "National Cup"),
    ]);

    const league = screen.getByRole("button", { name: /Premier League/ });
    expect(league.querySelector("img")).toHaveAttribute("src", "/assets/competitions/premier.png");
    expect(league.querySelector("svg")).not.toBeInTheDocument();

    const cup = screen.getByRole("button", { name: /National Cup/ });
    expect(cup.querySelector("img")).not.toBeInTheDocument();
    expect(cup.querySelector("svg")).toBeInTheDocument();
  });
});
