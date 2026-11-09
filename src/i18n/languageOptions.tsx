import type { ComponentProps, ReactElement } from "react";

import { SUPPORTED_LANGUAGES, UPCOMING_LANGUAGES } from "./languages";

/** Enough of `useTranslation`'s `t` for a label lookup, so a caller can pass a stub in a test. */
type Translate = (key: string) => string;

/**
 * The `<option>` list every language picker offers: the shipped languages, then the planned ones
 * as disabled rows carrying a "Coming soon" suffix.
 *
 * A function returning an array, not a component: `Select` reads its options from its direct
 * children (`child.type === "option"`), and `Children.toArray` flattens arrays but does not look
 * inside a custom component. Wrapping these rows in one would leave both pickers empty.
 *
 * Both pickers call this so the announced-but-unavailable languages cannot drift between Settings
 * and the World Editor.
 */
export function languageOptions(t: Translate): ReactElement<ComponentProps<"option">>[] {
  const comingSoon = t("settings.languageComingSoon");

  return [
    ...SUPPORTED_LANGUAGES.map(({ code, labelKey }) => (
      <option key={code} value={code}>
        {t(labelKey)}
      </option>
    )),
    ...UPCOMING_LANGUAGES.map(({ code, labelKey }) => (
      // Disabled, so the row can be read but never committed: the game has no strings for it.
      <option key={code} value={code} disabled>
        {`${t(labelKey)} (${comingSoon})`}
      </option>
    )),
  ];
}
