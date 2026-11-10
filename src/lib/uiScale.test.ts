import { describe, expect, it } from "vitest";
import { ROOT_FONT_FLOOR_PX, uiScaleMultiplier, uiScaleValue } from "./uiScale";

/** The two hard minimums from the native-window brief, against the role type sizes. */
const CAPTION_REM = 0.75;
const BODY_REM = 0.875;
const SCALES = ["small", "normal", "large", "xlarge", "nonsense"];

describe("ui scale", () => {
  it("never lets a caption fall below 11px, at any scale setting", () => {
    for (const scale of SCALES) {
      expect(ROOT_FONT_FLOOR_PX * CAPTION_REM).toBeGreaterThanOrEqual(11);
      expect(uiScaleMultiplier(scale)).toBeGreaterThan(0);
    }
  });

  it("never lets body text fall below 12px", () => {
    expect(ROOT_FONT_FLOOR_PX * BODY_REM).toBeGreaterThanOrEqual(12);
  });

  it("keeps the player's scale ordering", () => {
    expect(uiScaleMultiplier("small")).toBeLessThan(uiScaleMultiplier("normal"));
    expect(uiScaleMultiplier("normal")).toBeLessThan(uiScaleMultiplier("large"));
    expect(uiScaleMultiplier("large")).toBeLessThan(uiScaleMultiplier("xlarge"));
  });

  it("falls back to normal for an unknown setting", () => {
    expect(uiScaleValue("nonsense")).toBe(uiScaleValue("normal"));
  });

  it("emits a bare number, so the CSS clamp can multiply by it", () => {
    for (const scale of SCALES) expect(uiScaleValue(scale)).toMatch(/^\d+(\.\d+)?$/);
  });
});
