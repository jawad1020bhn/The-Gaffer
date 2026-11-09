import { describe, expect, it } from "vitest";

import {
  SETUP_BEATS,
  createSetupDraft,
  nextSetupStep,
  previousSetupStep,
  type CareerSetupStep,
} from "./careerSetupModel";

describe("career setup step model", () => {
  /** Given a new career, when the draft is created, then guided defaults are explicit and simulation-neutral. */
  it("starts a guided draft with a balanced approach and no invented reputation", () => {
    const draft = createSetupDraft(2026);

    expect(draft.step).toBe("world");
    expect(draft.guidance).toBe("guided");
    expect(draft.background).toBe("outsider");
    expect(draft.philosophy).toBe("Balanced");
    expect(draft.startYear).toBe("2026");
    expect(draft.historyDepthYears).toBe(12);
  });

  /** Given the guided path, when advancing from identity, then philosophy is its own beat. */
  it("includes philosophy in the guided path", () => {
    const draft = { ...createSetupDraft(2026), step: "identity" as CareerSetupStep };

    expect(nextSetupStep(draft)).toBe("philosophy");
  });

  /** Given quick setup, when advancing from identity, then optional philosophy and ceremony are skipped. */
  it("lets quick setup go straight from identity to the club", () => {
    const draft = {
      ...createSetupDraft(2026),
      guidance: "quick" as const,
      step: "identity" as CareerSetupStep,
    };

    expect(nextSetupStep(draft)).toBe("club");
  });

  /** Given a completed beat, when going back, then the previous editable beat is returned without resetting choices. */
  it("walks back through the same beats", () => {
    const draft = { ...createSetupDraft(2026), step: "philosophy" as CareerSetupStep };

    expect(previousSetupStep(draft)).toBe("identity");
    expect(previousSetupStep({ ...draft, step: "world" })).toBeNull();
  });

  /** Given the rail, when it is drawn, then every beat has a stable translated label and the club commitment is visible. */
  it("names every beat in order", () => {
    expect(SETUP_BEATS.map((beat) => beat.id)).toEqual([
      "world",
      "season",
      "identity",
      "philosophy",
      "club",
      "board",
      "sign",
      "welcome",
    ]);
    expect(SETUP_BEATS.every((beat) => beat.labelKey.startsWith("careerSetup.beats."))).toBe(true);
  });
});
