export type GuidanceMode = "guided" | "quick";
export type ManagerBackground = "legend" | "formerPro" | "youthCoach" | "outsider";
export type TacticalPhilosophy = "Balanced" | "Possession" | "HighPress" | "Counter";
export type BoardPromise = "europe" | "attractive" | "survival";

/** The pre-club beats the main menu owns. Later beats are shown by the rail but owned by the career. */
export type CareerSetupStep =
  | "world"
  | "season"
  | "identity"
  | "philosophy"
  | "club"
  | "board"
  | "sign"
  | "welcome";

export interface CareerPresentation {
  guidance: GuidanceMode;
  background: ManagerBackground;
  philosophy: TacticalPhilosophy;
}

export interface CareerSetupDraft extends CareerPresentation {
  step: CareerSetupStep;
  furthestStep: CareerSetupStep;
  firstName: string;
  lastName: string;
  nationality: string;
  startYear: string;
  startPhase: "seasonStart" | "midSeason";
  historyDepthYears: number;
  packageIds: string[];
}

export const SETUP_BEATS: ReadonlyArray<{ id: CareerSetupStep; labelKey: string }> = [
  { id: "world", labelKey: "careerSetup.beats.world" },
  { id: "season", labelKey: "careerSetup.beats.season" },
  { id: "identity", labelKey: "careerSetup.beats.identity" },
  { id: "philosophy", labelKey: "careerSetup.beats.philosophy" },
  { id: "club", labelKey: "careerSetup.beats.club" },
  { id: "board", labelKey: "careerSetup.beats.board" },
  { id: "sign", labelKey: "careerSetup.beats.sign" },
  { id: "welcome", labelKey: "careerSetup.beats.welcome" },
];

export const MANAGER_BACKGROUNDS: ReadonlyArray<{
  id: ManagerBackground;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    id: "legend",
    labelKey: "careerSetup.backgrounds.legend",
    descriptionKey: "careerSetup.backgrounds.legendDesc",
  },
  {
    id: "formerPro",
    labelKey: "careerSetup.backgrounds.formerPro",
    descriptionKey: "careerSetup.backgrounds.formerProDesc",
  },
  {
    id: "youthCoach",
    labelKey: "careerSetup.backgrounds.youthCoach",
    descriptionKey: "careerSetup.backgrounds.youthCoachDesc",
  },
  {
    id: "outsider",
    labelKey: "careerSetup.backgrounds.outsider",
    descriptionKey: "careerSetup.backgrounds.outsiderDesc",
  },
];

export const PHILOSOPHY_OPTIONS: ReadonlyArray<{
  id: TacticalPhilosophy;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    id: "Possession",
    labelKey: "careerSetup.philosophies.possession",
    descriptionKey: "careerSetup.philosophies.possessionDesc",
  },
  {
    id: "HighPress",
    labelKey: "careerSetup.philosophies.press",
    descriptionKey: "careerSetup.philosophies.pressDesc",
  },
  {
    id: "Counter",
    labelKey: "careerSetup.philosophies.counter",
    descriptionKey: "careerSetup.philosophies.counterDesc",
  },
  {
    id: "Balanced",
    labelKey: "careerSetup.philosophies.pragmatic",
    descriptionKey: "careerSetup.philosophies.pragmaticDesc",
  },
];

export function createSetupDraft(startYear: number): CareerSetupDraft {
  return {
    step: "world",
    furthestStep: "world",
    guidance: "guided",
    background: "outsider",
    philosophy: "Balanced",
    firstName: "",
    lastName: "",
    nationality: "",
    startYear: String(startYear),
    startPhase: "seasonStart",
    historyDepthYears: 12,
    packageIds: [],
  };
}

export function beatIndex(step: CareerSetupStep): number {
  return SETUP_BEATS.findIndex((beat) => beat.id === step);
}

/** The editable pre-club path. Quick setup skips the optional philosophy beat. */
function editablePath(guidance: GuidanceMode): CareerSetupStep[] {
  return guidance === "quick"
    ? ["world", "season", "identity", "club"]
    : ["world", "season", "identity", "philosophy", "club"];
}

export function nextSetupStep(draft: CareerSetupDraft): CareerSetupStep | null {
  const path = editablePath(draft.guidance);
  const index = path.indexOf(draft.step);
  return index >= 0 && index < path.length - 1 ? path[index + 1] : null;
}

export function previousSetupStep(draft: CareerSetupDraft): CareerSetupStep | null {
  const path = editablePath(draft.guidance);
  const index = path.indexOf(draft.step);
  return index > 0 ? path[index - 1] : null;
}

export function presentationOf(draft: CareerSetupDraft): CareerPresentation {
  return { guidance: draft.guidance, background: draft.background, philosophy: draft.philosophy };
}

export function isCareerPresentation(value: unknown): value is CareerPresentation {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (record.guidance === "guided" || record.guidance === "quick") &&
    MANAGER_BACKGROUNDS.some((entry) => entry.id === record.background) &&
    PHILOSOPHY_OPTIONS.some((entry) => entry.id === record.philosophy)
  );
}
