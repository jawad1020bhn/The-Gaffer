import { beforeEach, describe, expect, it } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import {
  acknowledgeMilestone,
  advanceArrival,
  createCareerJournal,
  dismissGuide,
  firstDayProgress,
  loadCareerJournal,
  resumeGuide,
  saveCareerJournal,
  skipArrival,
} from "./careerJournal";

function game(overrides: Partial<GameStateData> = {}): GameStateData {
  return {
    clock: { current_date: "2026-07-01T00:00:00Z", start_date: "2026-07-01T00:00:00Z" },
    manager: { id: "mgr-1", team_id: "team-1" },
    teams: [],
    players: [],
    staff: [],
    messages: [
      {
        id: "welcome-1",
        category: "Welcome",
        read: false,
      },
    ],
    news: [],
    league: null,
    board_objectives: [],
    season_context: {},
    scouting_assignments: [],
    ...overrides,
  } as unknown as GameStateData;
}

describe("career journal", () => {
  beforeEach(() => localStorage.clear());

  /** Given a guided appointment, when the journal is created, then the ceremony is pending and no first-day task is falsely complete. */
  it("opens the board meeting without completing guidance tasks", () => {
    const journal = createCareerJournal(game(), {
      guidance: "guided",
      background: "formerPro",
      philosophy: "HighPress",
    });

    expect(journal.arrivalStage).toBe("board");
    expect(journal.briefingMessageId).toBe("welcome-1");
    expect(journal.milestones).toEqual({
      board: false,
      squad: false,
      tactics: false,
      fixture: false,
    });
  });

  /** Given quick setup, when the journal is created, then the ceremony is skipped but the guide remains available. */
  it("skips the ceremony for quick setup", () => {
    const journal = createCareerJournal(game(), {
      guidance: "quick",
      background: "outsider",
      philosophy: "Balanced",
    });

    expect(journal.arrivalStage).toBe("done");
    expect(journal.dismissed).toBe(true);
  });

  /** Given a board promise, when the appointment advances, then the promise is kept and signing follows. */
  it("stores one promise and advances board to signing to welcome", () => {
    const journal = createCareerJournal(game(), {
      guidance: "guided",
      background: "youthCoach",
      philosophy: "Possession",
    });

    const board = advanceArrival(journal, "survival");
    expect(board.promise).toBe("survival");
    expect(board.arrivalStage).toBe("sign");

    const signed = advanceArrival(board);
    expect(signed.arrivalStage).toBe("welcome");

    const welcomed = advanceArrival(signed);
    expect(welcomed.arrivalStage).toBe("done");
    expect(welcomed.milestones.board).toBe(true);
  });

  /** Given a skipped ceremony, when the player lands in the Hub, then the board briefing is still an open task. */
  it("does not mark a skipped briefing as read", () => {
    const journal = createCareerJournal(game(), {
      guidance: "guided",
      background: "legend",
      philosophy: "Counter",
    });

    const skipped = skipArrival(journal);
    expect(skipped.arrivalStage).toBe("done");
    expect(skipped.milestones.board).toBe(false);
  });

  /** Given two saves, when progress is written, then a fresh reader sees only its own career's progress. */
  it("round-trips non-default progress per save", () => {
    const state = game();
    const journal = acknowledgeMilestone(
      createCareerJournal(state, {
        guidance: "guided",
        background: "legend",
        philosophy: "Counter",
      }),
      "squad",
    );

    expect(saveCareerJournal(state, "save-a", journal)).toBe(true);
    expect(loadCareerJournal(state, "save-a")).toEqual(journal);
    expect(loadCareerJournal(state, "save-b")).toBeNull();
  });

  /** Given damaged storage, when progress is read, then the career is not blocked by a broken tutorial record. */
  it("falls back safely on malformed storage", () => {
    localStorage.setItem("ofm-career-journal:v1:save:save-a", "{oops");

    expect(loadCareerJournal(game(), "save-a")).toBeNull();
  });

  /** Given a dismissed guide, when the player resumes it, then the same completed milestones are still there. */
  it("dismisses and resumes without losing progress", () => {
    const journal = acknowledgeMilestone(
      createCareerJournal(game(), {
        guidance: "guided",
        background: "outsider",
        philosophy: "Balanced",
      }),
      "tactics",
    );

    const dismissed = dismissGuide(journal);
    expect(dismissed.dismissed).toBe(true);
    const resumed = resumeGuide(dismissed);
    expect(resumed.dismissed).toBe(false);
    expect(resumed.milestones.tactics).toBe(true);
  });

  /** Given an unrelated read message, when progress is derived, then the board task is not completed by it. */
  it("counts only the captured briefing or an explicit acknowledgment", () => {
    const state = game({
      messages: [
        { id: "welcome-1", category: "Welcome", read: false },
        { id: "other", category: "System", read: true },
      ] as GameStateData["messages"],
    });
    const journal = createCareerJournal(state, {
      guidance: "guided",
      background: "outsider",
      philosophy: "Balanced",
    });

    expect(firstDayProgress(journal, state).completed).toBe(0);
    const read = game({
      messages: [{ id: "welcome-1", category: "Welcome", read: true }] as GameStateData["messages"],
    });
    expect(firstDayProgress(journal, read).completed).toBe(1);
  });
});
