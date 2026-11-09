import type { TFunction } from "i18next";
import { humaniseMissingKey } from "../i18n/missingKey";

/**
 * A news category's label, never its key.
 *
 * Categories come from the backend, so a new one can arrive before its translation does. The
 * fallback is the key's last segment in words rather than the dotted key on screen.
 */
export function newsCategoryLabel(t: TFunction, category: string): string {
  const key = `news.categories.${category}`;
  return t(key, { defaultValue: humaniseMissingKey(key) });
}
