import type { JSX } from "react";
import { useTranslation } from "react-i18next";

const HINTS: { keys: string[]; labelKey: string }[] = [
  { keys: ["Enter"], labelKey: "gameHint.select" },
  { keys: ["Esc"], labelKey: "gameHint.menu" },
  { keys: ["Space"], labelKey: "dashboard.continue" },
  { keys: ["Ctrl", "K"], labelKey: "gameNav.search" },
  { keys: ["F5"], labelKey: "common.save" },
  { keys: ["Alt", "1-5"], labelKey: "gameHint.sections" },
];

/**
 * The bottom strip: what the input device does here, in 28 pixels. It replaces the old footer,
 * which repeated the manager and the club and held the two buttons the top bar now owns.
 */
export default function HintBar(): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="no-select flex h-game-hint shrink-0 items-center gap-4 overflow-hidden border-t border-line bg-chrome px-4 text-caption text-fg-subtle">
      <p className="sr-only">{t("gameHint.title")}</p>
      {HINTS.map((hint) => (
        <span key={hint.labelKey} className="flex shrink-0 items-center gap-1.5">
          {hint.keys.map((key) => (
            <kbd key={key} className="kbd">
              {key}
            </kbd>
          ))}
          <span className="truncate">{t(hint.labelKey)}</span>
        </span>
      ))}
    </div>
  );
}
