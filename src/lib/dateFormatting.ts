import type { SupportedLanguageCode } from "../i18n";
import { useSettingsStore } from "../store/settingsStore";

/**
 * The BCP-47 tag `Intl` should use for each language we ship.
 *
 * Typed against the language registry, so adding a locale to `SUPPORTED_LANGUAGES` without
 * deciding its date format is a compile error. English is the only shipped language today;
 * `getLocale` still passes an unknown code through, so a save written by a version that shipped
 * more languages keeps formatting its dates until the player picks a language.
 */
const LANG_LOCALE: Record<SupportedLanguageCode, string> = {
  en: "en-US",
};

export function getLocale(lang?: string): string {
  if (!lang) {
    return "en-US";
  }
  return LANG_LOCALE[lang as SupportedLanguageCode] ?? lang;
}

function parseDateInput(dateStr: string): Date | null {
  const dateOnly = dateStr.substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return null;
  }
  const value = new Date(`${dateOnly}T12:00:00`);
  if (Number.isNaN(value.getTime())) {
    return null;
  }
  return value;
}

export function formatMatchDate(dateStr: string, locale?: string): string {
  const date = parseDateInput(dateStr);
  if (!date) {
    return dateStr;
  }
  const resolvedLocale = locale ?? useSettingsStore.getState().settings.language;
  return date.toLocaleDateString(getLocale(resolvedLocale), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDate(
  dateStr: string,
  locale?: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const date = parseDateInput(dateStr);
  if (!date) {
    return dateStr;
  }
  return date.toLocaleDateString(
    getLocale(locale),
    opts || { year: "numeric", month: "long", day: "numeric" },
  );
}

export function formatDateFull(dateStr: string, locale?: string): string {
  const date = parseDateInput(dateStr);
  if (!date) {
    return dateStr;
  }
  return date.toLocaleDateString(getLocale(locale), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(dateStr: string, locale?: string): string {
  const date = parseDateInput(dateStr);
  if (!date) {
    return dateStr;
  }
  return date.toLocaleDateString(getLocale(locale), {
    month: "short",
    day: "numeric",
  });
}
