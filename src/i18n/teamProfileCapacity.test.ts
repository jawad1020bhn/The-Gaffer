import { describe, expect, it } from "vitest";

import en from "./locales/en.json";

/**
 * A key named `capacity` exists twice (the stadium label and a report-upload error), and an edit
 * aimed at one overwrote the other in three locales once. Pin the stadium label's words.
 *
 * Those three locales no longer ship; English carries both keys too, so the collision is still
 * reachable here and the guard still bites.
 */
describe("teamProfile.capacity", () => {
  /**
   * Given the stadium capacity label, which shares its name with a report-upload key
   * When the English file is read
   * Then it still says "capacity" of a stadium, not a report-server message
   */
  it("stays the stadium label", () => {
    expect(en.teamProfile.capacity).toBe("Capacity");
  });
});
