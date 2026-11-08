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
        "gameNav.club": "Club",
        "gameNav.menu": "Menu",
        "gameNav.search": "Search",
        "gameNav.noClub": "No club",
        "gameNav.noFixture": "No upcoming fixture",
        "gameNav.unknownBudget": "Budget unavailable",
        "gameNav.date": "Date",
        "gameNav.transferBudget": "Transfer budget",
        "gameHint.title": "Keyboard shortcuts",
        "gameHint.select": "Select",
        "gameHint.sections": "Sections",
        "pause.title": "Paused",
        "pause.resume": "Resume",
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
        "dashboard.schedule": "Schedule",
        "dashboard.settings": "Settings",
        "dashboard.saveGame": "Save game",
        "dashboard.exitToMenu": "Exit to menu",
        "dashboard.continue": "Continue",
        "home.nextMatch": "Next Match",
        "common.back": "Back",
        "common.save": "Save",
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
    currentDate: "Sun 8 Nov 2026",
    nextFixtureLabel: "Alpha FC vs Beta FC",
    transferBudgetLabel: "€2.5M",
    unreadMessagesCount: 3,
    hasProfileHistory: false,
    title: "Hub",
    onNavigate: vi.fn(),
    onBack: vi.fn(),
    onNavigateSettings: vi.fn(),
    onExitClick: vi.fn(),
    onSave: vi.fn(),
    onContinue: vi.fn(),
    toolbar: <button type="button">Search field</button>,
    commands: <button type="button">Continue</button>,
    children: <p>Workspace content</p>,
    ...overrides,
  };
  return { ...render(<GameShell {...props} />), props };
}

describe("GameShell", () => {
  /** Given an active career, when the shell renders, then the one bar, the rail, the chips and the workspace are all present. */
  it("renders one top bar, the section rail and the workspace", () => {
    renderShell();

    expect(screen.getByRole("navigation", { name: "Main game sections" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Section pages" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Club · Alpha FC/ })).toHaveTextContent(
      "Premier League",
    );
    expect(screen.getByRole("button", { name: /€2.5M/ })).toBeInTheDocument();
    expect(screen.getByText("Workspace content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  /** Given a career with actions, when the shell renders, then Continue sits in the bottom bar, not the top one. */
  it("docks the career's actions in the bottom bar instead of the top bar", () => {
    renderShell();

    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton.closest("header")).toBeNull();
    expect(continueButton.closest("footer")).not.toBeNull();
    expect(screen.getByText("Workspace content")).toBeInTheDocument();
  });

  /** Given the Career section, when Team is chosen, then navigation opens the section's first page. */
  it("navigates through sections and the rail", () => {
    const { props } = renderShell({ activeTab: "Squad" });

    fireEvent.click(screen.getByRole("button", { name: "Team" }));
    expect(props.onNavigate).toHaveBeenCalledWith("Squad");

    const rail = screen.getByRole("navigation", { name: "Section pages" });
    fireEvent.click(within(rail).getByRole("button", { name: "Tactics" }));
    expect(props.onNavigate).toHaveBeenCalledWith("Tactics");
  });

  /** Given an unemployed manager, when the shell renders, then club-only sections are absent. */
  it("does not offer club-only sections while unemployed", () => {
    renderShell({ isUnemployed: true, teamName: null, competitionName: null });

    expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Club · No club/ })).toBeInTheDocument();
  });

  /** Given a profile with history, when Back is pressed, then the existing return handler is used. */
  it("offers the profile return path in a slim strip, not a second bar", () => {
    const { props } = renderShell({ hasProfileHistory: true });

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Hub" })).toBeInTheDocument();
  });

  /** Given no open profile, then the shell spends no height on a page title bar. */
  it("draws no page title bar when no profile is open", () => {
    renderShell();

    expect(screen.queryByRole("heading", { name: "Hub" })).not.toBeInTheDocument();
  });

  /** Given the inbox count, when Office is open, then the count stays discoverable on the rail. */
  it("keeps unread counts on the section rail", () => {
    renderShell({ activeTab: "Inbox" });
    const rail = screen.getByRole("navigation", { name: "Section pages" });
    expect(within(rail).getByRole("button", { name: /Inbox/ })).toHaveTextContent("3");
  });

  /** Given Escape, when no overlay owns the keys, then the pause menu opens with the game's actions. */
  it("opens the pause menu on Escape and runs its actions", () => {
    const { props } = renderShell();

    fireEvent.keyDown(window, { key: "Escape" });

    const menu = screen.getByRole("dialog", { name: "Paused" });
    fireEvent.click(within(menu).getByRole("button", { name: /Save game/ }));
    expect(props.onSave).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Paused" })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Paused" })).getByRole("button", {
        name: "Settings",
      }),
    );
    expect(props.onNavigateSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Paused" })).not.toBeInTheDocument();
  });

  /** Given Ctrl+K, then the career search opens in a palette over the canvas. */
  it("opens the search palette on Ctrl+K", () => {
    renderShell();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const palette = screen.getByRole("dialog", { name: /Search/ });
    expect(within(palette).getByRole("button", { name: "Search field" })).toBeInTheDocument();
  });

  /** Given Alt and a section digit, then the matching section opens. */
  it("reaches sections with Alt and a digit", () => {
    const { props } = renderShell();

    fireEvent.keyDown(window, { key: "3", altKey: true });

    expect(props.onNavigate).toHaveBeenCalledWith("Transfers");
  });

  /** Given Space with nothing interactive focused, then Continue runs. */
  it("continues on Space", () => {
    const { props } = renderShell();

    fireEvent.keyDown(window, { key: " ", target: document.body });

    expect(props.onContinue).toHaveBeenCalledTimes(1);
  });

  /** Given F5, then the game saves. */
  it("quick-saves on F5", () => {
    const { props } = renderShell();

    fireEvent.keyDown(window, { key: "F5" });

    expect(props.onSave).toHaveBeenCalledTimes(1);
  });
});
