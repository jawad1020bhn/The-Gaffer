/**
 * The language registry, with no i18next import.
 *
 * Kept apart from `index.ts` so a caller that only needs to validate a code — the settings store
 * normalising a saved language, the dev harness reading `?lang=` — does not start an i18next
 * instance as a side effect of the import.
 */

/** The languages the game ships. English only: see `UPCOMING_LANGUAGES` for what is planned. */
export const SUPPORTED_LANGUAGES = [{ code: "en", labelKey: "settings.languages.en" }] as const;

/**
 * Languages the picker announces but cannot switch to yet.
 *
 * These have a label and no locale file, on purpose: the option is rendered disabled so a player
 * can see the language is planned without the game offering a translation it does not have.
 * Shipping one means moving its code into `SUPPORTED_LANGUAGES` and adding `locales/<code>.json`;
 * `localeCoverage.test.ts` fails until both halves are done.
 */
export const UPCOMING_LANGUAGES = [{ code: "ar", labelKey: "settings.languages.ar" }] as const;

/** A language code the game ships, as named in `SUPPORTED_LANGUAGES`. */
export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const SUPPORTED_CODES = new Map(
  SUPPORTED_LANGUAGES.map((language) => [language.code.toLowerCase(), language.code]),
);

/**
 * Whether `locale` names a shipped language itself, rather than falling back to one.
 *
 * `resolveSupportedLanguage("de")` answers `"en"`, which is right for choosing a display language
 * and wrong for deciding whether a bundle of German strings may be installed as English. Callers
 * that install text keyed by locale (a world package's own translations) ask this first.
 */
export function isSupportedLanguageLocale(locale: string): boolean {
  const normalized = locale.trim().replace(/_/g, "-").toLowerCase();
  return SUPPORTED_CODES.has(normalized) || SUPPORTED_CODES.has(normalized.split("-")[0]);
}

/**
 * The shipped language a locale resolves to, or English.
 *
 * Regional variants resolve through their base language (`en-GB` -> `en`). Everything else —
 * including a language the game used to ship, and one it only announces as coming soon — is
 * English, so a save written by an older version still opens in a language that has strings.
 */
export function resolveSupportedLanguage(locale: string): string {
  const normalized = locale.trim().replace(/_/g, "-").toLowerCase();
  const exactMatch = SUPPORTED_CODES.get(normalized);
  if (exactMatch) return exactMatch;

  const base = normalized.split("-")[0];
  return SUPPORTED_CODES.get(base) ?? "en";
}
