import type { GameStateData } from "../../store/gameStore";
import {
  MANAGER_BACKGROUNDS,
  PHILOSOPHY_OPTIONS,
  type BoardPromise,
  type CareerPresentation,
} from "../careerSetup/careerSetupModel";

export type ArrivalStage = "board" | "sign" | "welcome" | "done";
export type FirstDayMilestone = "board" | "squad" | "tactics" | "fixture";

export interface CareerJournal extends CareerPresentation {
  version: 1;
  managerId: string;
  arrivalStage: ArrivalStage;
  promise: BoardPromise | null;
  briefingMessageId: string | null;
  dismissed: boolean;
  milestones: Record<FirstDayMilestone, boolean>;
}

export interface FirstDayStep {
  id: FirstDayMilestone;
  labelKey: string;
  descriptionKey: string;
  tab: string;
  done: boolean;
}

export interface FirstDayProgress {
  steps: FirstDayStep[];
  completed: number;
  total: number;
  next: FirstDayStep | null;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_PREFIX = "ofm-career-journal:v1";
const MILESTONES: FirstDayMilestone[] = ["board", "squad", "tactics", "fixture"];

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function careerJournalKey(gameState: GameStateData, saveId?: string | null): string {
  return saveId
    ? `${STORAGE_PREFIX}:save:${saveId}`
    : `${STORAGE_PREFIX}:legacy:${gameState.manager.id}:${gameState.clock.start_date}`;
}

function findBriefingMessage(gameState: GameStateData): string | null {
  return (
    gameState.messages.find((message) => message.category === "Welcome")?.id ??
    gameState.messages.find((message) => message.category === "BoardDirective")?.id ??
    null
  );
}

export function createCareerJournal(
  gameState: GameStateData,
  presentation: CareerPresentation,
): CareerJournal {
  const quick = presentation.guidance === "quick";
  return {
    version: 1,
    managerId: gameState.manager.id,
    ...presentation,
    arrivalStage: quick ? "done" : "board",
    promise: null,
    briefingMessageId: findBriefingMessage(gameState),
    dismissed: quick,
    milestones: { board: false, squad: false, tactics: false, fixture: false },
  };
}

export function advanceArrival(journal: CareerJournal, promise?: BoardPromise): CareerJournal {
  if (journal.arrivalStage === "board") {
    return { ...journal, promise: promise ?? journal.promise, arrivalStage: "sign" };
  }
  if (journal.arrivalStage === "sign") {
    return { ...journal, arrivalStage: "welcome" };
  }
  if (journal.arrivalStage === "welcome") {
    return { ...journal, arrivalStage: "done", milestones: { ...journal.milestones, board: true } };
  }
  return journal;
}

export function skipArrival(journal: CareerJournal): CareerJournal {
  return { ...journal, arrivalStage: "done" };
}

export function acknowledgeMilestone(
  journal: CareerJournal,
  milestone: FirstDayMilestone,
): CareerJournal {
  return { ...journal, milestones: { ...journal.milestones, [milestone]: true } };
}

export function dismissGuide(journal: CareerJournal): CareerJournal {
  return { ...journal, dismissed: true };
}

export function resumeGuide(journal: CareerJournal): CareerJournal {
  return { ...journal, dismissed: false };
}

export function isCareerJournal(value: unknown): value is CareerJournal {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const milestones = record.milestones as Record<string, unknown> | undefined;
  return (
    record.version === 1 &&
    typeof record.managerId === "string" &&
    (record.guidance === "guided" || record.guidance === "quick") &&
    MANAGER_BACKGROUNDS.some((entry) => entry.id === record.background) &&
    PHILOSOPHY_OPTIONS.some((entry) => entry.id === record.philosophy) &&
    (record.arrivalStage === "board" ||
      record.arrivalStage === "sign" ||
      record.arrivalStage === "welcome" ||
      record.arrivalStage === "done") &&
    (record.promise === null ||
      record.promise === "europe" ||
      record.promise === "attractive" ||
      record.promise === "survival") &&
    (record.briefingMessageId === null || typeof record.briefingMessageId === "string") &&
    typeof record.dismissed === "boolean" &&
    !!milestones &&
    MILESTONES.every((milestone) => typeof milestones[milestone] === "boolean")
  );
}

export function loadCareerJournal(
  gameState: GameStateData,
  saveId?: string | null,
  storage: StorageLike | null = defaultStorage(),
): CareerJournal | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(careerJournalKey(gameState, saveId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCareerJournal(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCareerJournal(
  gameState: GameStateData,
  saveId: string | null | undefined,
  journal: CareerJournal,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(careerJournalKey(gameState, saveId), JSON.stringify(journal));
    return true;
  } catch {
    return false;
  }
}

export function firstDayProgress(
  journal: CareerJournal,
  gameState: GameStateData,
): FirstDayProgress {
  const briefingRead = journal.briefingMessageId
    ? gameState.messages.some((message) => message.id === journal.briefingMessageId && message.read)
    : false;
  const steps: FirstDayStep[] = [
    {
      id: "board",
      labelKey: "firstDay.tasks.board.label",
      descriptionKey: "firstDay.tasks.board.description",
      tab: "Inbox",
      done: journal.milestones.board || briefingRead,
    },
    {
      id: "squad",
      labelKey: "firstDay.tasks.squad.label",
      descriptionKey: "firstDay.tasks.squad.description",
      tab: "Squad",
      done: journal.milestones.squad,
    },
    {
      id: "tactics",
      labelKey: "firstDay.tasks.tactics.label",
      descriptionKey: "firstDay.tasks.tactics.description",
      tab: "Tactics",
      done: journal.milestones.tactics,
    },
    {
      id: "fixture",
      labelKey: "firstDay.tasks.fixture.label",
      descriptionKey: "firstDay.tasks.fixture.description",
      tab: "Schedule",
      done: journal.milestones.fixture,
    },
  ];
  const completed = steps.filter((step) => step.done).length;
  return { steps, completed, total: steps.length, next: steps.find((step) => !step.done) ?? null };
}

export type GuidanceHorizon = "week" | "ninety" | "season";

/** The guidance horizon follows the real career clock; it never invents a deadline. */
export function guidanceHorizon(gameState: GameStateData): GuidanceHorizon {
  const start = Date.parse(gameState.clock.start_date);
  const current = Date.parse(gameState.clock.current_date);
  if (Number.isNaN(start) || Number.isNaN(current)) return "week";
  const days = Math.max(0, Math.floor((current - start) / 86_400_000));
  if (days < 7) return "week";
  if (days < 90) return "ninety";
  return "season";
}

export function taskForTab(tab: string): FirstDayMilestone | null {
  if (tab === "Inbox") return "board";
  if (tab === "Squad") return "squad";
  if (tab === "Tactics") return "tactics";
  if (tab === "Schedule") return "fixture";
  return null;
}
