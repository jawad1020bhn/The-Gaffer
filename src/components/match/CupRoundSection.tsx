import { useId } from "react";
import { useTranslation } from "react-i18next";
import { localizedRoundName } from "../tournaments/TournamentsTab.helpers";
import type { CupRoundSummary } from "./types";

interface CupRoundSectionProps {
  summary: CupRoundSummary;
}

/** The user's cup ties of the day, shown beside the league round on a cup day. */
export default function CupRoundSection({ summary }: CupRoundSectionProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const heading = summary.round_name
    ? `${summary.competition_name} · ${localizedRoundName(t, summary.round_name)}`
    : summary.competition_name;

  return (
    <section
      aria-labelledby={headingId}
      className="bg-panel rounded-panel border border-line shadow-sm p-4 transition-colors duration-300"
    >
      <h2
        id={headingId}
        className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-3"
      >
        {heading}
      </h2>
      <ul className="flex flex-col gap-2">
        {summary.results.map((tie) => (
          <li key={tie.fixture_id} className="text-body text-fg">
            <span className="font-heading font-bold">
              {tie.home_team_name} {tie.home_goals} – {tie.away_goals} {tie.away_team_name}
            </span>
            {tie.home_penalties !== null && tie.away_penalties !== null && (
              <span className="ml-2 text-caption text-fg-muted">
                {t("match.cupPenalties", { home: tie.home_penalties, away: tie.away_penalties })}
              </span>
            )}
            {tie.advancing_team_name && (
              <span className="ml-2 text-caption font-heading font-bold uppercase tracking-label text-selected">
                {t("match.cupAdvances", { team: tie.advancing_team_name })}
              </span>
            )}
          </li>
        ))}
      </ul>
      {!summary.is_complete && (
        <p className="mt-3 text-caption text-fg-muted">{t("match.cupTiesPending")}</p>
      )}
    </section>
  );
}
