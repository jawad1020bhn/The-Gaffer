export const GAME_SECTIONS = [
  { id: "career", labelKey: "gameNav.career", icon: "home" },
  { id: "team", labelKey: "gameNav.team", icon: "squad" },
  { id: "transfers", labelKey: "gameNav.transfers", icon: "transfers" },
  { id: "competitions", labelKey: "gameNav.competitions", icon: "trophy" },
  { id: "office", labelKey: "gameNav.office", icon: "office" },
] as const;

export type GameSectionId = (typeof GAME_SECTIONS)[number]["id"];

export interface DashboardDestination {
  tab: string;
  section: GameSectionId;
  labelKey: string;
  icon: string;
  clubOnly: boolean;
}

/** The single inventory behind the game shell. Every pre-redesign sidebar destination is kept. */
export const DASHBOARD_DESTINATIONS = [
  { tab: "Home", section: "career", labelKey: "dashboard.home", icon: "home", clubOnly: false },
  {
    tab: "Manager",
    section: "career",
    labelKey: "dashboard.manager",
    icon: "user",
    clubOnly: false,
  },
  { tab: "Squad", section: "team", labelKey: "dashboard.squad", icon: "squad", clubOnly: true },
  {
    tab: "Tactics",
    section: "team",
    labelKey: "dashboard.tactics",
    icon: "tactics",
    clubOnly: true,
  },
  {
    tab: "Training",
    section: "team",
    labelKey: "dashboard.training",
    icon: "training",
    clubOnly: true,
  },
  { tab: "Staff", section: "team", labelKey: "dashboard.staff", icon: "staff", clubOnly: true },
  {
    tab: "Youth",
    section: "team",
    labelKey: "dashboard.youthAcademy",
    icon: "youth",
    clubOnly: true,
  },
  {
    tab: "Transfers",
    section: "transfers",
    labelKey: "dashboard.transfers",
    icon: "transfers",
    clubOnly: true,
  },
  {
    tab: "TransferCentre",
    section: "transfers",
    labelKey: "transfers.centre",
    icon: "market",
    clubOnly: false,
  },
  {
    tab: "Scouting",
    section: "transfers",
    labelKey: "dashboard.scouting",
    icon: "scouting",
    clubOnly: true,
  },
  {
    tab: "Players",
    section: "transfers",
    labelKey: "dashboard.players",
    icon: "players",
    clubOnly: false,
  },
  {
    tab: "Schedule",
    section: "competitions",
    labelKey: "dashboard.schedule",
    icon: "calendar",
    clubOnly: false,
  },
  {
    tab: "Tournaments",
    section: "competitions",
    labelKey: "dashboard.tournaments",
    icon: "trophy",
    clubOnly: false,
  },
  {
    tab: "Teams",
    section: "competitions",
    labelKey: "dashboard.teams",
    icon: "club",
    clubOnly: false,
  },
  {
    tab: "Managers",
    section: "competitions",
    labelKey: "dashboard.managers",
    icon: "managers",
    clubOnly: false,
  },
  {
    tab: "HallOfFame",
    section: "competitions",
    labelKey: "dashboard.hallOfFame",
    icon: "medal",
    clubOnly: false,
  },
  { tab: "Inbox", section: "office", labelKey: "dashboard.inbox", icon: "inbox", clubOnly: false },
  { tab: "News", section: "office", labelKey: "dashboard.news", icon: "news", clubOnly: false },
  {
    tab: "Finances",
    section: "office",
    labelKey: "dashboard.finances",
    icon: "finance",
    clubOnly: true,
  },
] as const satisfies readonly DashboardDestination[];

/** The primary sections that still have a page, in top-bar order. Alt+1…5 counts these. */
export function sectionsWithDestinations(isUnemployed: boolean): (typeof GAME_SECTIONS)[number][] {
  return GAME_SECTIONS.filter(
    (section) => destinationsForSection(section.id, isUnemployed).length > 0,
  );
}

export function destinationsForSection(section: GameSectionId, isUnemployed: boolean): string[] {
  return DASHBOARD_DESTINATIONS.filter(
    (entry) => entry.section === section && (!isUnemployed || !entry.clubOnly),
  ).map((entry) => entry.tab);
}

export function sectionForTab(tab: string): GameSectionId {
  return DASHBOARD_DESTINATIONS.find((entry) => entry.tab === tab)?.section ?? "career";
}

export function destinationForTab(tab: string): DashboardDestination | undefined {
  return DASHBOARD_DESTINATIONS.find((entry) => entry.tab === tab);
}

/** A remembered page is only a hint: availability and the registry remain authoritative. */
export function resolveSectionDestination(
  section: GameSectionId,
  remembered: string | undefined,
  isUnemployed: boolean,
): string {
  const available = destinationsForSection(section, isUnemployed);
  if (remembered && available.includes(remembered)) return remembered;
  return available[0] ?? "Home";
}
