import { describe, expect, it } from "vitest";

import { languageOptions } from "./languageOptions";
import { SUPPORTED_LANGUAGES, UPCOMING_LANGUAGES } from "./languages";

/** The labels the picker reads, as `en.json` writes them. */
const LABELS: Record<string, string> = {
  "settings.languages.en": "English",
  "settings.languages.ar": "العربية",
  "settings.languageComingSoon": "Coming soon",
};

const t = (key: string) => LABELS[key] ?? key;

/** The props `Select` reads off each `<option>` child. */
function rows() {
  return languageOptions(t).map((option) => ({
    value: option.props.value as string,
    disabled: option.props.disabled === true,
    label: option.props.children,
  }));
}

describe("languageOptions", () => {
  /**
   * Given the shipped and announced registries
   * When the picker rows are built
   * Then every language appears once, shipped ones first, so the selectable option is not buried
   *      below one that cannot be chosen
   */
  it("lists the shipped languages before the announced ones", () => {
    expect(rows().map(({ value }) => value)).toEqual([
      ...SUPPORTED_LANGUAGES.map(({ code }) => code),
      ...UPCOMING_LANGUAGES.map(({ code }) => code),
    ]);
  });

  /**
   * Given English, which the game ships
   * When its row is built
   * Then it is selectable and carries no suffix
   */
  it("leaves the shipped language selectable", () => {
    expect(rows()[0]).toEqual({ value: "en", disabled: false, label: "English" });
  });

  /**
   * Given Arabic, which has no locale file
   * When its row is built
   * Then it is disabled and says so. An enabled row would switch the game to a language with no
   *      strings, and a row without the suffix would look like a language that silently failed.
   */
  it("marks the announced language disabled and coming soon", () => {
    expect(rows()[1]).toEqual({
      value: "ar",
      disabled: true,
      label: "العربية (Coming soon)",
    });
  });

  /**
   * Given the rows
   * When their labels are read
   * Then none is a raw key: every label the registries name exists in the catalogue.
   */
  it("renders no raw translation keys", () => {
    for (const { label } of rows()) {
      expect(String(label)).not.toContain("settings.");
    }
  });
});
