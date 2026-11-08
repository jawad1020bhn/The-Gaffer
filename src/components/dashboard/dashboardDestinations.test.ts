import { describe, expect, it } from "vitest";
import {
  DASHBOARD_DESTINATIONS,
  GAME_SECTIONS,
  destinationsForSection,
  resolveSectionDestination,
  sectionForTab,
} from "./dashboardDestinations";

const CURRENT_TABS = [
  "Home",
  "Manager",
  "Squad",
  "Tactics",
  "Training",
  "Staff",
  "Youth",
  "Transfers",
  "TransferCentre",
  "Scouting",
  "Players",
  "Schedule",
  "Tournaments",
  "Teams",
  "Managers",
  "HallOfFame",
  "Inbox",
  "News",
  "Finances",
];

describe("dashboard destinations", () => {
  /** Given the old sidebar inventory, when the registry is read, then every destination survives once. */
  it("preserves all nineteen current destinations exactly once", () => {
    expect(DASHBOARD_DESTINATIONS.map((entry) => entry.tab).sort()).toEqual(
      [...CURRENT_TABS].sort(),
    );
    expect(new Set(DASHBOARD_DESTINATIONS.map((entry) => entry.tab)).size).toBe(19);
  });

  /** Given the new shell, when sections are read, then there are five football sections. */
  it("groups destinations into five sections", () => {
    expect(GAME_SECTIONS.map((section) => section.id)).toEqual([
      "career",
      "team",
      "transfers",
      "competitions",
      "office",
    ]);
    for (const section of GAME_SECTIONS) {
      expect(destinationsForSection(section.id, false).length).toBeGreaterThan(0);
    }
  });

  /** Given an unemployed manager, when club-only pages are requested, then they are unavailable. */
  it("hides club-only destinations while unemployed", () => {
    expect(destinationsForSection("team", true)).toEqual([]);
    expect(destinationsForSection("office", true)).toEqual(["Inbox", "News"]);
    expect(destinationsForSection("transfers", true)).not.toContain("Transfers");
  });

  /** Given a remembered page, when a section opens, then a valid memory wins and an invalid one falls back. */
  it("resolves section memory against availability", () => {
    expect(resolveSectionDestination("team", "Tactics", false)).toBe("Tactics");
    expect(resolveSectionDestination("team", "Tactics", true)).toBe("Home");
    expect(resolveSectionDestination("office", "NotAPage", false)).toBe("Inbox");
    expect(sectionForTab("Finances")).toBe("office");
    expect(sectionForTab("Unknown")).toBe("career");
  });
});
