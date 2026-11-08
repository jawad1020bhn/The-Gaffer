import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import type { Momentum } from "./momentum";

interface MomentumBarProps extends Momentum {
  homeTeam: string;
  awayTeam: string;
}

/**
 * The last few minutes of pressure, under the scoreline: the home end in the selection colour (the
 * same lime the possession bar uses), the away end in info blue, and the middle left neutral.
 *
 * A bar, so it carries no text of its own — the label reads the split for anyone who can't see it.
 */
export default function MomentumBar({
  home,
  even,
  away,
  homeTeam,
  awayTeam,
}: MomentumBarProps): JSX.Element {
  const { t } = useTranslation();
  const label = t("match.momentumLabel", { homeTeam, awayTeam, home, even, away });

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-caption text-fg-muted">
        <span className="font-heading font-bold uppercase tracking-label">
          {t("match.momentum")}
        </span>
        <span className="tabular-nums">{t("match.momentumWindow")}</span>
      </div>
      {/* Who the two ends belong to, so the bar under the possession bar is not a second mystery. */}
      <div className="flex items-baseline justify-between gap-3 text-caption">
        <span className="truncate font-heading font-bold uppercase tracking-label text-fg">
          {homeTeam} <span className="tabular-nums text-selected">{home}%</span>
        </span>
        <span className="truncate font-heading font-bold uppercase tracking-label text-fg">
          <span className="tabular-nums text-info">{away}%</span> {awayTeam}
        </span>
      </div>
      <div
        role="img"
        aria-label={label}
        title={label}
        className="mt-1 flex h-1.5 overflow-hidden rounded-control bg-line-strong"
      >
        <div
          className="h-full bg-selected-fill transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${home}%` }}
        />
        <div
          className="h-full bg-line-strong transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${even}%` }}
        />
        <div
          className="h-full bg-info-solid transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${away}%` }}
        />
      </div>
    </div>
  );
}
