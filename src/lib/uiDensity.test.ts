import { describe, expect, it } from "vitest";
import { densityClassFor } from "./uiDensity";

describe("densityClassFor", () => {
  it("uses the compact root class only for compact density", () => {
    expect(densityClassFor("compact")).toBe("density-compact");
  });

  it("falls back to comfortable for default and unknown values", () => {
    expect(densityClassFor("comfortable")).toBe("");
    expect(densityClassFor("")).toBe("");
    expect(densityClassFor("ultra")).toBe("");
  });
});
