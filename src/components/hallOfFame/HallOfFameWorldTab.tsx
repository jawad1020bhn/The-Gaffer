import { Globe, Medal, Trophy, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

import type { GameStateData } from "../../store/gameStore";
import { countryName } from "../../lib/countries";
import { translatePositionLabel } from "../squad/SquadTab.helpers";
import { Badge, Card, CardBody, CardHeader, CountryFlag, TeamLogo } from "../ui";
import { useHallOfFameChampions } from "./useHallOfFameChampions";
import { useHallOfFameLegends } from "./useHallOfFameLegends";

interface HallOfFameWorldTabProps {
  gameState: GameStateData;
  onSelectPlayer?: (id: string) => void;
  onSelectTeam?: (id: string) => void;
}

export default function HallOfFameWorldTab({
  gameState,
  onSelectPlayer,
  onSelectTeam,
}: HallOfFameWorldTabProps) {
  const { t, i18n } = useTranslation();
  // A career switch can keep this tab mounted under an unchanged date.
  const careerToken = gameState.career_token ?? 0;
  const legends = useHallOfFameLegends(gameState.clock.current_date, careerToken);
  const titles = useHallOfFameChampions(gameState.clock.current_date, careerToken);
  // The backend names the titles; the screen only attaches the club it shows.
  const champions = titles.flatMap(({ season, team_id, record }) => {
    const team = gameState.teams.find((candidate) => candidate.id === team_id);
    return team ? [{ season, team, record }] : [];
  });
  const worldCupChampions = gameState.world_history?.world_cup_champions ?? [];

  return (
    <div className="space-y-5">
      <Card accent="primary">
        <CardBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-caption font-heading font-bold uppercase tracking-[0.25em] text-selected">
              {t("hallOfFameWorld.title")}
            </p>
            <h2 className="text-title font-heading font-bold uppercase tracking-label text-fg">
              {t("hallOfFameWorld.subtitle")}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-body md:min-w-[20rem]">
            <SummaryTile
              icon={<UserRound className="h-4 w-4" />}
              label={t("hallOfFameWorld.legendsCount", { count: legends.length })}
              value={legends.length.toString()}
            />
            <SummaryTile
              icon={<Trophy className="h-4 w-4" />}
              label={t("hallOfFameWorld.championsCount", { count: champions.length })}
              value={champions.length.toString()}
            />
          </div>
        </CardBody>
      </Card>

      {worldCupChampions.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lead font-heading font-bold uppercase tracking-label text-fg">
              {t("hallOfFameWorld.worldCupChampions")}
            </h3>
            <Badge variant="accent" size="md">
              {worldCupChampions.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {worldCupChampions.map((champion) => (
              <Card key={champion.year} accent="accent">
                <CardBody className="flex items-center justify-between gap-4">
                  <div data-testid={`world-cup-champion-${champion.year}`}>
                    <p className="text-caption font-heading font-bold uppercase tracking-[0.2em] text-fg-subtle">
                      {t("hallOfFameWorld.worldCupEdition", { year: champion.year })}
                    </p>
                    <p className="mt-1 text-title font-heading font-bold uppercase tracking-label text-warning">
                      {champion.nation_name}
                    </p>
                    {champion.nation_code ? (
                      <div className="mt-2 flex items-center gap-2 text-body text-fg-muted">
                        <CountryFlag
                          code={champion.nation_code}
                          locale={i18n.language}
                          className="text-body leading-none"
                        />
                        <span>{countryName(champion.nation_code, i18n.language)}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-panel bg-warning-solid p-3 text-warning bg-warning-tint">
                    <Globe className="h-6 w-6" />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lead font-heading font-bold uppercase tracking-label text-fg">
            {t("hallOfFameWorld.legends")}
          </h3>
          <Badge variant="primary" size="md">
            {legends.length}
          </Badge>
        </div>

        {legends.length === 0 ? (
          <Card>
            <CardBody className="py-10 text-center text-body text-fg-muted">
              {t("hallOfFameWorld.noLegends")}
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {legends.map((legend) => {
              const footballNation = legend.football_nation || legend.nationality;

              return (
                <Card key={legend.player_id} accent="primary">
                  <CardHeader
                    action={
                      <Badge variant="accent">{`${t("hallOfFameWorld.titles")}: ${legend.titles}`}</Badge>
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onSelectPlayer?.(legend.player_id)}
                      className="text-left transition-colors hover:text-selected"
                    >
                      {legend.full_name}
                    </button>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-body text-fg-muted">
                          <CountryFlag
                            code={footballNation}
                            locale={i18n.language}
                            className="text-body leading-none"
                          />
                          <span>{countryName(footballNation, i18n.language)}</span>
                        </div>
                        <p className="mt-2 text-title font-heading font-bold uppercase tracking-label text-fg">
                          {translatePositionLabel(t, legend.position)}
                        </p>
                        {legend.last_club_name ? (
                          <p className="mt-1 text-body text-selected">
                            {`${t("hallOfFameWorld.lastClub")}: ${legend.last_club_name}`}
                          </p>
                        ) : null}
                      </div>
                      <div className="rounded-panel p-3 text-selected bg-selected-tint/40">
                        <Medal className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-body">
                      <StatTile
                        label={t("hallOfFameWorld.appearances")}
                        value={legend.appearances.toString()}
                      />
                      <StatTile
                        label={t("hallOfFameWorld.goals")}
                        value={legend.goals.toString()}
                      />
                      <StatTile
                        label={t("hallOfFameWorld.assists")}
                        value={legend.assists.toString()}
                      />
                      <StatTile
                        label={t("hallOfFameWorld.finalSeason")}
                        value={legend.final_season?.toString() ?? "-"}
                      />
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lead font-heading font-bold uppercase tracking-label text-fg">
            {t("hallOfFameWorld.pastChampions")}
          </h3>
          <Badge variant="accent" size="md">
            {champions.length}
          </Badge>
        </div>

        {champions.length === 0 ? (
          <Card>
            <CardBody className="py-10 text-center text-body text-fg-muted">
              {t("hallOfFameWorld.noChampions")}
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {champions.map((champion) => (
              <Card key={`${champion.team.id}-${champion.season}`} accent="accent">
                <CardBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-caption font-heading font-bold uppercase tracking-[0.2em] text-fg-subtle">
                      {t("hallOfFameWorld.seasonLabel", { season: champion.season })}
                    </p>
                    <button
                      type="button"
                      onClick={() => onSelectTeam?.(champion.team.id)}
                      className="mt-1 text-left text-title font-heading font-bold uppercase tracking-label text-warning transition-colors hover:text-warning"
                    >
                      {champion.team.name}
                    </button>
                    <div className="mt-2 flex items-center gap-2 text-body text-fg-muted">
                      <CountryFlag
                        code={champion.team.country}
                        locale={i18n.language}
                        className="text-body leading-none"
                      />
                      <span>{countryName(champion.team.country, i18n.language)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <TeamLogo
                      team={champion.team}
                      className="h-14 w-14 shrink-0 overflow-hidden rounded-panel bg-warning-solid bg-warning-tint flex items-center justify-center text-body font-heading font-bold text-warning"
                      imageClassName="h-11 w-11 object-contain drop-shadow"
                      fallback={<span>{champion.team.short_name.charAt(0)}</span>}
                    />
                    <div className="grid grid-cols-2 gap-3 text-body md:min-w-[16rem]">
                      <StatTile
                        label={t("hallOfFameWorld.played")}
                        value={champion.record.played.toString()}
                      />
                      <StatTile
                        label={t("hallOfFameWorld.goals")}
                        value={champion.record.goals_for.toString()}
                      />
                      <StatTile
                        label={t("hallOfFameWorld.record")}
                        value={`${champion.record.won}-${champion.record.drawn}-${champion.record.lost}`}
                      />
                      <StatTile
                        label={t("hallOfFameWorld.goalDifference")}
                        value={(
                          champion.record.goals_for - champion.record.goals_against
                        ).toString()}
                      />
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface SummaryTileProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function SummaryTile({ icon, label, value }: SummaryTileProps) {
  return (
    <div className="rounded-panel bg-sunken p-3">
      <div className="mb-2 flex items-center gap-2 text-fg-subtle">
        {icon}
        <span className="text-caption font-heading font-bold uppercase tracking-[0.18em]">
          {label}
        </span>
      </div>
      <p className="text-lead font-heading font-bold text-fg">{value}</p>
    </div>
  );
}

interface StatTileProps {
  label: string;
  value: string;
}

function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="rounded-control bg-sunken p-3">
      <p className="text-caption font-heading font-bold uppercase tracking-[0.18em] text-fg-subtle">
        {label}
      </p>
      <p className="mt-2 text-lead font-heading font-bold text-fg">{value}</p>
    </div>
  );
}
