import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import i18n, { changeAppLanguage, i18nReady } from "../i18n";
import { useSettingsStore } from "../store/settingsStore";
import { formatWeeklyWage } from "./valueFormatting";

const speak = async (language: string) => {
  await changeAppLanguage(language);
  useSettingsStore.setState((state) => ({ settings: { ...state.settings, language } }));
};

describe("formatWeeklyWage", () => {
  beforeAll(async () => {
    await i18nReady;
  });

  // A first assertion must not depend on the machine's own language.
  beforeEach(async () => {
    await speak("en");
  });

  afterEach(async () => {
    await speak("en");
  });

  /**
   * Given a weekly wage on a decision surface
   * When it is shown exactly
   * Then every digit is there and the unit is per week.
   */
  it("shows the exact amount with the per-week unit", () => {
    expect(formatWeeklyWage(12_345)).toBe("€12,345/wk");
  });

  /**
   * Given a weekly wage in an overview tile
   * When it is shown compactly
   * Then it is shortened but still carries the per-week unit.
   */
  it("shortens the amount but keeps the unit when compact", () => {
    expect(formatWeeklyWage(12_345, "compact")).toBe("€12K/wk");
    expect(formatWeeklyWage(1_250_000, "compact")).toBe("€1.3M/wk");
  });

  /**
   * Given the shipped language
   * When a wage is shown
   * Then the unit is read from the catalogue by the formatter, not written by the caller.
   */
  it("takes the unit from the active language", async () => {
    await speak("en");

    expect(formatWeeklyWage(12_345)).toBe("\u20ac12,345/wk");
    expect(i18n.t("finances.perWeekSuffix")).toBe("/wk");
  });

  /**
   * Given a language setting that groups digits with a dot
   * When an exact wage is shown
   * Then the grouping follows that setting. The setting is set directly here: `de` is no longer a
   * language the picker offers, but `Intl` still formats any tag, and this pins that the
   * formatter reads the setting rather than hardcoding en-US.
   */
  it("groups digits the way the language setting does", () => {
    useSettingsStore.setState((state) => ({ settings: { ...state.settings, language: "de" } }));

    expect(formatWeeklyWage(1_234_567)).toContain("1.234.567");
  });

  /**
   * Given a negative amount
   * When shown
   * Then the sign leads the whole figure, before the currency symbol.
   */
  it("puts the sign before the symbol", () => {
    expect(formatWeeklyWage(-500)).toBe("-€500/wk");
  });
});
