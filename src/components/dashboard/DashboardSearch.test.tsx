import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createPlayer, createTeam } from "../../test-utils/factories";
import DashboardSearch from "./DashboardSearch";

vi.mock("../../services/positionService", () => ({ getPositionGroups: vi.fn(async () => []) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const labels: Record<string, string> = {
        "dashboard.noResults": "No results",
        "dashboard.searchPlayers": "Players",
        "dashboard.searchTeams": "Teams",
        "dashboard.searchPlaceholder": "Search",
        "common.search": "Search",
        "squad.viewProfile": "View profile",
        "common.viewTeam": "View team",
      };
      return labels[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

function renderSearch(overrides: Partial<Parameters<typeof DashboardSearch>[0]> = {}) {
  const teams = [createTeam()];
  const props: Parameters<typeof DashboardSearch>[0] = {
    matchedPlayers: [createPlayer()],
    matchedTeams: teams,
    onSearchBlur: vi.fn(),
    onSearchFocus: vi.fn(),
    onSearchQueryChange: vi.fn(),
    onSelectSearchPlayer: vi.fn(),
    onSelectSearchTeam: vi.fn(),
    searchOpen: true,
    searchQuery: "jo",
    teams,
    ...overrides,
  };
  return { ...render(<DashboardSearch {...props} />), props };
}

describe("DashboardSearch", () => {
  /** Given search results, when a result is chosen, then the profile handlers run. */
  it("keeps player and team search selection", () => {
    const { props } = renderSearch();
    fireEvent.click(screen.getByTestId("dashboard-search-player-player-1"));
    fireEvent.click(screen.getByTestId("dashboard-search-team-team-1"));
    expect(props.onSelectSearchPlayer).toHaveBeenCalledWith("player-1");
    expect(props.onSelectSearchTeam).toHaveBeenCalledWith("team-1");
  });

  /** Given a player result, when its context menu offers View team, then the team handler runs. */
  it("offers context actions for player results", () => {
    const { props } = renderSearch();
    fireEvent.contextMenu(screen.getByTestId("dashboard-search-player-player-1"));
    fireEvent.click(screen.getByRole("menuitem", { name: "View team" }));
    expect(props.onSelectSearchTeam).toHaveBeenCalledWith("team-1");
    expect(props.onSelectSearchPlayer).not.toHaveBeenCalled();
  });

  /** Given no matches, then the empty state is named. */
  it("shows the no-results state", () => {
    renderSearch({ matchedPlayers: [], matchedTeams: [] });
    expect(screen.getByText("No results")).toBeInTheDocument();
  });
});
