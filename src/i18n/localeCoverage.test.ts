import { describe, expect, it } from "vitest";

import { LOCALE_FILES } from "./i18nTestHelpers";
import { SUPPORTED_LANGUAGES, UPCOMING_LANGUAGES } from "./index";
import en from "./locales/en.json";

/**
 * The game ships English only. These assertions replace the per-locale coverage loops that used
 * to live here: with one locale there is no second tree to compare against, and a loop over an
 * empty set passes no matter what is broken. So the policy itself is what is pinned — in both
 * directions, because a file with no registry entry is dead weight nobody can select, and a
 * registry entry with no file is a language the picker offers and cannot load.
 *
 * Adding a language back is a deliberate act: register it, add its file, and restore the
 * translation-coverage gates from git history — the `collectMissingKeys` / `collectUntranslatedKeys`
 * walkers and `INTENTIONAL_SAME.json` were removed with the locales they checked. `collectOrphanKeys`
 * survives in `i18nTestHelpers.ts`, and `scripts/audit-i18n.mjs` keeps its own missing-key walker.
 */
describe("the shipped language set", () => {
  it("ships English, and nothing else", () => {
    expect(SUPPORTED_LANGUAGES.map(({ code }) => code)).toEqual(["en"]);
  });

  it("names exactly the locales that have a file", () => {
    const registered = SUPPORTED_LANGUAGES.map((language) => language.code).sort();
    const onDisk = Object.keys(LOCALE_FILES).sort();

    expect(onDisk).toEqual(registered);
  });

  /**
   * Given the English file
   * When it is measured
   * Then it is a whole game's worth of text. A registry pointing at a stub would satisfy every
   * assertion above, so the reference locale is checked to actually carry the strings.
   */
  it("keeps English as a complete locale, not a stub", () => {
    const countLeaves = (node: unknown): number =>
      typeof node === "string"
        ? 1
        : node !== null && typeof node === "object"
          ? Object.values(node).reduce((total, child) => total + countLeaves(child), 0)
          : 0;

    expect(countLeaves(en)).toBeGreaterThan(1000);
  });
});

describe("announced-but-unshipped languages", () => {
  /**
   * Given the coming-soon registry
   * When it is compared with the shipped one
   * Then Arabic is announced and is not selectable: the picker renders it disabled, and a code
   * listed in both would offer a language with no strings behind it.
   */
  it("announces Arabic without shipping it", () => {
    expect(UPCOMING_LANGUAGES.map(({ code }) => code)).toEqual(["ar"]);

    const shipped = new Set<string>(SUPPORTED_LANGUAGES.map(({ code }) => code));
    for (const { code } of UPCOMING_LANGUAGES) {
      expect(shipped.has(code), `${code} is both shipped and coming soon`).toBe(false);
      expect(LOCALE_FILES[code], `${code} has a locale file but is not registered`).toBeUndefined();
    }
  });

  /**
   * Given each announced language
   * When its picker label is looked up
   * Then English names it, and the suffix that marks it unavailable exists, so the row cannot
   * render as a raw key.
   */
  it("has an English label for every announced language", () => {
    for (const { labelKey } of [...SUPPORTED_LANGUAGES, ...UPCOMING_LANGUAGES]) {
      const [, table, code] = labelKey.split(".");
      expect(table).toBe("languages");
      expect((en.settings.languages as Record<string, string>)[code], labelKey).toBeTruthy();
    }

    expect(en.settings.languageComingSoon).toBeTruthy();
  });
});
