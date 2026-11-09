import { describe, expect, it } from "vitest";

import { LOCALE_FILES, type LocaleTree } from "./i18nTestHelpers";

// English adds an ordinal suffix (1st, 2nd, ...) to the season-review messages. A translation
// may express ordinal position without that interpolation; when a language ships again, keep any
// such exception tied to each key and locale so a different omission still fails.
const ALLOWED_SUFFIX_OMISSIONS: Record<string, readonly string[]> = {};

function placeholders(text: string): Set<string> {
  return new Set([...text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((match) => match[1].trim()));
}

function placeholderDifferences(
  reference: LocaleTree,
  candidate: LocaleTree,
  locale: string,
  path: string[] = [],
  allowedSuffixOmissions: Record<string, readonly string[]> = ALLOWED_SUFFIX_OMISSIONS,
): string[] {
  return Object.entries(reference).flatMap(([segment, englishValue]) => {
    const nextPath = [...path, segment];
    const key = nextPath.join(".");
    const translatedValue = candidate[segment];

    if (englishValue !== null && typeof englishValue === "object" && !Array.isArray(englishValue)) {
      return placeholderDifferences(
        englishValue as LocaleTree,
        translatedValue !== null &&
          typeof translatedValue === "object" &&
          !Array.isArray(translatedValue)
          ? (translatedValue as LocaleTree)
          : {},
        locale,
        nextPath,
        allowedSuffixOmissions,
      );
    }
    if (typeof englishValue !== "string") return [];

    const expected = placeholders(englishValue);
    const actual = placeholders(typeof translatedValue === "string" ? translatedValue : "");
    const missing = [...expected].filter(
      (name) =>
        !actual.has(name) && !(name === "suffix" && allowedSuffixOmissions[key]?.includes(locale)),
    );
    const extra = [...actual].filter((name) => !expected.has(name));
    return missing.length > 0 || extra.length > 0
      ? [`${key}: missing [${missing.join(", ")}], extra [${extra.join(", ")}]`]
      : [];
  });
}

describe("locale interpolation placeholders", () => {
  it("checks missing and invented placeholders in both directions", () => {
    const en = { message: "{{first}} and {{second}}" };
    expect(placeholderDifferences(en, { message: "{{first}} and {{third}}" }, "fr")).toEqual([
      "message: missing [second], extra [third]",
    ]);
  });

  /**
   * Given a locale allowed to omit the ordinal suffix, and one that is not
   * When both are compared with English
   * Then only the allowed one passes. The allow-list is injected here rather than read from the
   * shipped policy: no language ships today, so the real list is empty and a test against it
   * would prove nothing about the mechanism a future translation depends on.
   */
  it("allows a suffix omission only for the locale named in the allow-list", () => {
    const key = "be.msg.seasonReview.body.topFour";
    const exceptions = { [key]: ["fr"] };
    const en = {
      be: { msg: { seasonReview: { body: { topFour: "{{position}}{{suffix}} {{points}}" } } } },
    };
    const withoutSuffix = {
      be: { msg: { seasonReview: { body: { topFour: "{{position}} {{points}}" } } } },
    };

    expect(placeholderDifferences(en, withoutSuffix, "fr", [], exceptions)).toEqual([]);
    expect(placeholderDifferences(en, withoutSuffix, "ru", [], exceptions)).toEqual([
      `${key}: missing [suffix], extra []`,
    ]);
    expect(
      placeholderDifferences(
        en,
        { be: { msg: { seasonReview: { body: { topFour: "{{position}} {{surprise}}" } } } } },
        "fr",
        [],
        exceptions,
      ),
    ).toEqual([`${key}: missing [points], extra [surprise]`]);
  });

  /**
   * Given no language ships besides English
   * When the shipped allow-list is read
   * Then it is empty: an exception naming a locale that no longer exists would silently permit a
   * missing placeholder in whatever language is added next.
   */
  it("carries no exceptions for languages the game does not ship", () => {
    expect(ALLOWED_SUFFIX_OMISSIONS).toEqual({});
  });

  /**
   * Given English is the only shipped locale
   * When its own placeholders are compared against themselves
   * Then nothing is reported — and the scan is proven to have read the real file, so a glob that
   * matched nothing cannot pass this silently. The two cases above pin the comparison itself;
   * this one runs it over every locale on disk, so a language added later is checked on arrival.
   */
  it("matches every shipped locale's placeholder set to English", () => {
    expect(Object.keys(LOCALE_FILES)).toContain("en");

    const differences = Object.fromEntries(
      Object.entries(LOCALE_FILES)
        .map(([locale, translations]) => [
          locale,
          placeholderDifferences(LOCALE_FILES.en, translations, locale),
        ])
        .filter(([, mismatches]) => (mismatches as string[]).length > 0),
    );
    expect(differences).toEqual({});
  });
});
