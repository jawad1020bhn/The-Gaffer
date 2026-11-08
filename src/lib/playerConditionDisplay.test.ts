import { describe, expect, it } from "vitest";
import { condBgColor } from "./playerConditionDisplay";

describe("condition fills", () => {
  /** Given a condition bucket, when its fill renders in either theme,
   * then the same severity has one role token, which the dark theme resolves. */
  it.each([
    [75, "bg-selected-fill"],
    [50, "bg-warning-solid"],
    [49, "bg-danger-solid"],
  ] as const)("keeps the %s percent condition warning on its token", (condition, token) => {
    expect(condBgColor(condition)).toBe(token);
  });
});
