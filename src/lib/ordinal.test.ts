import { beforeAll, describe, expect, it } from "vitest";

import i18n, { SUPPORTED_LANGUAGES, i18nReady } from "../i18n";
import { formatOrdinal } from "./ordinal";

async function ordinalIn(language: string, value: number): Promise<string> {
  await i18n.loadLanguages(language);
  const t = i18n.getFixedT(language);
  return formatOrdinal(value, language, t);
}

describe("formatOrdinal", () => {
  beforeAll(async () => {
    await i18nReady;
  });

  /**
   * Given the game in English
   * When ranks that exercise every suffix rule are formatted
   * Then 1, 2, 3 and 4 take st, nd, rd and th, and 11 to 13 and 111 take th
   */
  it("writes English ordinals with the right suffix", async () => {
    const written = await Promise.all(
      [1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map((n) => ordinalIn("en", n)),
    );

    expect(written).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "101st",
      "111th",
    ]);
  });

  /**
   * Given a language whose ordinal rule has no "two" category
   * When a rank of 2 is formatted
   * Then the translator is asked for the `other` form, not English's `two`. Portuguese carried
   *      this case while the game shipped it; the rule lookup is the point, so the language is
   *      passed straight to the formatter here rather than loaded from a locale file.
   */
  it("asks for the form the language's own plural rule picks", () => {
    const asked: string[] = [];
    const translate = (key: string, options: { n: number }) => {
      asked.push(key);
      return `${options.n}`;
    };

    expect(formatOrdinal(2, "pt", translate)).toBe("2");
    expect(asked).toEqual(["common.ordinal.other"]);

    asked.length = 0;
    expect(formatOrdinal(2, "en", translate)).toBe("2");
    expect(asked).toEqual(["common.ordinal.two"]);
  });

  /**
   * Given each language the game ships
   * When a rank of 2 is formatted
   * Then the catalogue writes it, so no screen shows a raw key
   */
  it("resolves a written ordinal in every shipped language", async () => {
    for (const { code } of SUPPORTED_LANGUAGES) {
      const written = await ordinalIn(code, 2);

      expect(written, code).toContain("2");
      expect(written, code).not.toContain("common.ordinal");
    }
  });
});
