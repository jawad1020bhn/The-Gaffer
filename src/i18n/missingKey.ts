/**
 * A display fallback for a backend-driven label with no translation yet.
 *
 * A raw `news.categories.general` on screen is a bug the player can see. Categories, trait families
 * and package-supplied labels arrive from the backend faster than the locale files do, so the
 * caller passes this as i18next's `defaultValue`: "general" becomes "General", "StandingsUpdate"
 * becomes "Standings Update".
 *
 * Deliberately NOT a global `parseMissingKeyHandler`. Two contracts depend on `t(key)` returning
 * the key itself when it is unknown: `resolveTranslatedErrorMessage` uses that identity to pass a
 * backend message through untouched, and interpolated money strings contain dots that a global
 * humaniser would mangle ("€1.8M" became "8 M"). This is opt-in per call site instead.
 */
export function humaniseMissingKey(key: string): string {
  const last = key.split(":").pop()?.split(".").pop() ?? key;
  const words = last
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
