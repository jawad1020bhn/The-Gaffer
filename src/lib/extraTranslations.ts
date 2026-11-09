import i18n, { isSupportedLanguageLocale, SUPPORTED_LANGUAGES } from "../i18n";

const PKG_NS = "pkgTranslations";

/**
 * Apply extra translation bundles from a world package.
 *
 * Each call first clears all previously-registered package bundles so
 * keys from a previous game session do not leak into the current one.
 * Bundles are registered under the dedicated "pkgTranslations" namespace,
 * which i18next checks as a fallback after the built-in "translation"
 * namespace, keeping built-in keys untouched.
 */
export function applyExtraTranslations(
  extra: Record<string, Record<string, unknown>> | undefined,
): void {
  for (const { code } of SUPPORTED_LANGUAGES) {
    i18n.removeResourceBundle(code, PKG_NS);
  }

  if (!extra) return;
  for (const [rawLocale, bundle] of Object.entries(extra)) {
    if (typeof bundle !== "object" || bundle === null || Array.isArray(bundle)) {
      continue;
    }
    // A package may carry bundles for languages the game no longer ships. Resolving `de` to
    // `en` here would install German text as the English fallback and show it to every player,
    // so a bundle is only taken when its own locale is one the game ships.
    if (!isSupportedLanguageLocale(rawLocale)) continue;

    i18n.addResourceBundle(rawLocale.trim().toLowerCase(), PKG_NS, bundle, true, true);
  }
}
