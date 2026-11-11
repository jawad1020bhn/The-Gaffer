import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import KnockoutBracket from "./KnockoutBracket";
import StandingsTable from "./StandingsTable";
import TournamentsGroupTable from "./TournamentsGroupTable";
import TournamentsPreseasonNote from "./TournamentsPreseasonNote";
import { localizedRoundName } from "./TournamentsTab.helpers";
import type { TournamentsTeamLookup } from "./teamLookup";
import { competitionDisplayName } from "../../lib/competitionName";
import { Card, CardBody, CompetitionLogo } from "../ui";
import type { LeagueData, StandingData } from "../../store/gameStore";

type Group = NonNullable<LeagueData["groups"]>[number];
type KnockoutRound = NonNullable<LeagueData["knockout_rounds"]>[number];

interface TournamentsStandingsViewProps {
  league: LeagueData;
  standings: StandingData[];
  groups: Group[];
  /** The groups are a league phase: see `rules.group_stage_rounds`. */
  leaguePhase?: boolean;
  knockoutRounds: KnockoutRound[];
  isKnockout: boolean;
  isPreseason: boolean;
  zones: { promotionSlots: number; relegationSlots: number };
  teams: TournamentsTeamLookup;
}

/**
 * How a competition stands, in whichever shape it has.
 *
 * A cup shows its bracket, and its group stage above it while one is running.
 * A qualifying competition is groups alone. Everything else is a league table.
 */
export default function TournamentsStandingsView({
  league,
  standings,
  groups,
  leaguePhase = false,
  knockoutRounds,
  isKnockout,
  isPreseason,
  zones,
  teams,
}: TournamentsStandingsViewProps) {
  const { t } = useTranslation();

  const groupGrid = (
    <Card>
      <CardBody className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {groups.map((group) => (
            <TournamentsGroupTable
              key={group.id}
              group={group}
              teams={teams}
              leaguePhase={leaguePhase}
            />
          ))}
        </div>
      </CardBody>
    </Card>
  );

  if (isKnockout) {
    // Before the draw a cup has neither a bracket nor groups. Saying so beats
    // rendering an empty panel with no explanation.
    if (knockoutRounds.length === 0 && groups.length === 0) {
      return (
        <Card>
          <CardBody>
            <TournamentsPreseasonNote className="py-6" />
          </CardBody>
        </Card>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        {groups.length > 0 && groupGrid}
        {knockoutRounds.length > 0 && (
          <KnockoutBracket
            rounds={knockoutRounds}
            fixtures={league.fixtures}
            resolveTeamName={teams.resolveTeamName}
            localizedRoundName={(name) => localizedRoundName(t, name)}
            userTeamId={teams.userTeamId}
            roundCompleteLabel={t("tournaments.roundComplete")}
            roundInProgressLabel={t("tournaments.roundInProgress")}
            byeLabel={t("tournaments.bye")}
            tbdLabel={t("tournaments.tbd")}
          />
        )}
      </div>
    );
  }

  // Group tables for non-knockout competitions, e.g. World Cup qualifying.
  if (groups.length > 0) {
    return groupGrid;
  }

  if (isPreseason) {
    return (
      <Card>
        <CardBody>
          <TournamentsPreseasonNote className="py-6" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-5 border-b border-line bg-panel rounded-t-xl">
        <h3 className="text-lead font-heading font-bold text-fg flex items-center gap-2 uppercase tracking-label">
          <CompetitionLogo
            logo={league.logo}
            className="h-7 w-7"
            fallback={<Trophy className="text-warning w-5 h-5" />}
          />
          {competitionDisplayName(league, t)} — {t("schedule.season", { number: league.season })}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <StandingsTable
          standings={standings}
          variant="full"
          teams={teams}
          testIdPrefix="tournaments-standing"
          zones={zones}
        />
        {(zones.promotionSlots > 0 || zones.relegationSlots > 0) && (
          <div className="flex gap-5 border-t border-line px-4 py-2.5 text-caption text-fg-muted">
            {zones.promotionSlots > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-selected-fill" />
                {t("schedule.promotionZone")}
              </span>
            )}
            {zones.relegationSlots > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-danger-solid" />
                {t("schedule.relegationZone")}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
