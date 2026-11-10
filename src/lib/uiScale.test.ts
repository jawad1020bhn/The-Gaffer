import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ROOT_FONT_CEILING_PX,
  ROOT_FONT_FLOOR_PX,
  uiScaleMultiplier,
  uiScaleValue,
} from "./uiScale";

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

  it("checks the floor and the ceiling the stylesheet's clamp really uses", () => {
    // The clamp lives in App.css. The path is relative to the Vitest root, the repository root.
    const appCss = readFileSync("src/App.css", "utf-8");
    const clamp = /font-size:\s*clamp\(([\d.]+)px,[^;]*,\s*([\d.]+)px\);/.exec(appCss);

    expect(clamp?.slice(1).map(Number)).toEqual([ROOT_FONT_FLOOR_PX, ROOT_FONT_CEILING_PX]);
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
