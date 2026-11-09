import { afterAll, describe, expect, it } from "vitest";
import i18n, { changeAppLanguage, i18nReady, resolveSupportedLanguage } from "./index";
import { isSupportedLanguageLocale } from "./languages";

describe("resolveSupportedLanguage", () => {
  it("keeps English through its regional variants", () => {
    expect(resolveSupportedLanguage("en")).toBe("en");
    expect(resolveSupportedLanguage("en-US")).toBe("en");
    expect(resolveSupportedLanguage("en-GB")).toBe("en");
    expect(resolveSupportedLanguage("EN_gb")).toBe("en");
    expect(resolveSupportedLanguage("  en-AU  ")).toBe("en");
  });

  /**
   * Given a locale the game used to ship, or one it only announces as coming soon
   * When it is resolved
   * Then it is English. A save written by an older version stores codes like `de` and `zh-CN`;
   * without this fallback those players would get raw keys instead of text.
   */
  it("falls back to English for every language the game does not ship", () => {
    for (const locale of [
      "de",
      "fr",
      "es-419",
      "pt-BR",
      "ru-RU",
      "zh-CN",
      "zh-Hans",
      "cs-CZ",
      "tr-TR",
      "id",
      "it",
      "ar",
      "ar-EG",
      "nl-NL",
    ]) {
      expect(resolveSupportedLanguage(locale), locale).toBe("en");
    }
  });
});

describe("isSupportedLanguageLocale", () => {
  /**
   * Given a locale that resolves to English only by fallback
   * When it is asked whether the game ships it
   * Then the answer is no: a world package's German bundle must not be installed as English.
   */
  it("distinguishes a shipped locale from one that merely falls back", () => {
    expect(isSupportedLanguageLocale("en")).toBe(true);
    expect(isSupportedLanguageLocale("en-GB")).toBe(true);
    expect(isSupportedLanguageLocale("de")).toBe(false);
    expect(isSupportedLanguageLocale("ar")).toBe(false);
  });
});

describe("i18n resource loading", () => {
  afterAll(async () => {
    await changeAppLanguage("en");
  });

  it("loads the English resources the game ships", async () => {
    await i18nReady;

    expect(i18n.hasResourceBundle("en", "translation")).toBe(true);
    expect(i18n.t("settings.language")).toBe("Language");
  });

  /**
   * Given a save whose stored language is German
   * When the app switches to it
   * Then English is used and its strings are present, rather than a rejected locale module.
   */
  it("serves English when asked for a language that no longer ships", async () => {
    await i18nReady;

    expect(await changeAppLanguage("de")).toBe("en");
    expect(i18n.language).toBe("en");
    expect(i18n.t("settings.language")).toBe("Language");
  });
});
