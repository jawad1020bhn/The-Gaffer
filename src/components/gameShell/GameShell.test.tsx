import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GameShell from "./GameShell";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        "gameNav.career": "Career",
        "gameNav.team": "Team",
        "gameNav.transfers": "Transfers",
        "gameNav.competitions": "Competitions",
        "gameNav.office": "Office",
        "gameNav.main": "Main game sections",
        "gameNav.context": "Section pages",
        "gameNav.careerStatus": "Career status",
        "gameNav.commands": "Career commands",
        "gameNav.noClub": "No club",
        "gameNav.noFixture": "No upcoming fixture",
        "gameNav.unknownBudget": "Budget unavailable",
        "dashboard.home": "Hub",
        "dashboard.manager": "Manager",
        "dashboard.squad": "Squad",
        "dashboard.tactics": "Tactics",
        "dashboard.training": "Training",
        "dashboard.staff": "Staff",
        "dashboard.youthAcademy": "Youth",
        "dashboard.inbox": "Inbox",
        "dashboard.news": "News",
        "dashboard.finances": "Finances",
        "dashboard.settings": "Settings",
        "dashboard.exitToMenu": "Exit to menu",
        "common.back": "Back",
      };
      return labels[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

function renderShell(overrides: Partial<Parameters<typeof GameShell>[0]> = {}) {
  const props: Parameters<typeof GameShell>[0] = {
    activeTab: "Home",
    isUnemployed: false,
    managerName: "Jane Doe",
    teamName: "Alpha FC",
    competitionName: "Premier League",
    currentDate: "Sunday, 8 November 2026",
    nextFixtureLabel: "Alpha FC vs Beta FC",
    transferBudgetLabel: "€2.5M",
    unreadMessagesCount: 3,
    hasProfileHistory: false,
    title: "Hub",
    onNavigate: vi.fn(),
    onBack: vi.fn(),
    onNavigateSettings: vi.fn(),
    onExitClick: vi.fn(),
    toolbar: <button type="button">Search</button>,
    commands: <button type="button">Continue</button>,
    children: <p>Workspace content</p>,
    ...overrides,
  };
  return { ...render(<GameShell {...props} />), props };
}

describe("GameShell", () => {
  /** Given an active career, when the shell renders, then section navigation, status, workspace and commands are present. */
  it("renders the game frame without dropping the workspace or commands", () => {
    renderShell();

    expect(screen.getByRole("navigation", { name: "Main game sections" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Section pages" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Career status" })).toHaveTextContent("Alpha FC");
    expect(screen.getByRole("region", { name: "Career status" })).toHaveTextContent("€2.5M");
    expect(screen.getByText("Workspace content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  /** Given the Career section, when Team is chosen, then navigation opens the section's first page. */
  it("navigates through sections and contextual destinations", () => {
    const { props, rerender } = renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Team" }));
    expect(props.onNavigate).toHaveBeenCalledWith("Squad");

    rerender(<GameShell {...props} activeTab="Squad" />);
    fireEvent.click(screen.getByRole("button", { name: "Tactics" }));
    expect(props.onNavigate).toHaveBeenCalledWith("Tactics");
  });

  /** Given an unemployed manager, when the shell renders, then club-only navigation is absent. */
  it("does not offer club-only sections while unemployed", () => {
    renderShell({ isUnemployed: true, teamName: null, competitionName: null });

    expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Career status" })).toHaveTextContent("No club");
  });

  /** Given a profile with history, when Back is pressed, then the existing return handler is used. */
  it("offers the profile return path and utility actions", () => {
    const { props } = renderShell({ hasProfileHistory: true });

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(props.onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(props.onNavigateSettings).toHaveBeenCalledTimes(1);
  });

  /** Given the inbox count, when the Office section is open, then the count remains discoverable. */
  it("keeps unread counts on contextual navigation", () => {
    renderShell({ activeTab: "Inbox" });
    const context = screen.getByRole("navigation", { name: "Section pages" });
    expect(within(context).getByRole("button", { name: /Inbox.*3/ })).toBeInTheDocument();
  });
});
