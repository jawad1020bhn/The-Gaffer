import type { ReactNode } from "react";
import { Briefcase, Star, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  GameStateData,
  NewsArticle,
  SeasonAwardEntryData,
  SeasonAwardsData,
  SeasonManagerAwardEntryData,
} from "../../store/gameStore";
import { Badge, Card, CardBody } from "../ui";

interface AwardsCeremonyScreenProps {
  season: number;
  leagueName: string;
  gameState: GameStateData;
  awards?: SeasonAwardsData;
  article?: NewsArticle;
  onBack?: () => void;
  onContinue?: () => void;
  onSelectPlayer?: (id: string) => void;
  onSelectTeam?: (id: string) => void;
}

interface ResolvedPlayerWinner {
  entry: SeasonAwardEntryData | null;
  playerName: string;
  teamName: string;
  value: string;
  playerId: string | null;
  teamId: string | null;
}

interface ResolvedManagerWinner {
  entry: SeasonManagerAwardEntryData | null;
  managerName: string;
  teamName: string;
  winRate: string;
  teamId: string | null;
}

export default function AwardsCeremonyScreen({
  season,
  leagueName,
  gameState,
  awards,
  article,
  onBack,
  onContinue,
  onSelectPlayer,
  onSelectTeam,
}: AwardsCeremonyScreenProps) {
  const { t } = useTranslation();
  const goldenBoot = resolvePlayerWinner(
    awards?.golden_boot[0] ?? null,
    article,
    gameState,
    "goldenBoot",
  );
  const playerOfYear = resolvePlayerWinner(
    awards?.player_of_year[0] ?? null,
    article,
    gameState,
    "poty",
  );
  const hasPlayerOfYear = awards
    ? awards.player_of_year.length > 0
    : playerOfYear.playerName !== "-" && playerOfYear.playerName !== "";
  const managerOfSeason = resolveManagerWinner(
    awards?.manager_of_season[0] ?? null,
    article,
    gameState,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 py-6">
      <Card accent="accent">
        <CardBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-caption font-heading font-bold uppercase tracking-[0.25em] text-warning">
              {t("awardsCeremony.title")}
            </p>
            <h2 className="text-title font-heading font-bold uppercase tracking-label text-fg">
              {t("awardsCeremony.subtitle", { season, league: leagueName })}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 text-caption">
            <Badge variant="accent" size="md">
              {t("awardsCeremony.managerOfSeason")}
            </Badge>
            <Badge variant="primary" size="md">
              {t("awardsCeremony.goldenBoot")}
            </Badge>
            {hasPlayerOfYear && (
              <Badge variant="neutral" size="md">
                {t("awardsCeremony.playerOfYear")}
              </Badge>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <WinnerCard
          icon={<Briefcase className="h-6 w-6" />}
          accent="accent"
          title={t("awardsCeremony.managerOfSeason")}
          name={managerOfSeason.managerName}
          teamName={managerOfSeason.teamName}
          valueLabel={t("awardsCeremony.winRate")}
          value={managerOfSeason.winRate}
          onSelectTeam={
            managerOfSeason.teamId && onSelectTeam
              ? () => onSelectTeam(managerOfSeason.teamId!)
              : undefined
          }
        />
        <WinnerCard
          icon={<Trophy className="h-6 w-6" />}
          accent="primary"
          title={t("awardsCeremony.goldenBoot")}
          name={goldenBoot.playerName}
          teamName={goldenBoot.teamName}
          valueLabel={t("awardsCeremony.goals")}
          value={goldenBoot.value}
          onSelectName={
            goldenBoot.playerId && onSelectPlayer
              ? () => onSelectPlayer(goldenBoot.playerId!)
              : undefined
          }
          onSelectTeam={
            goldenBoot.teamId && onSelectTeam ? () => onSelectTeam(goldenBoot.teamId!) : undefined
          }
        />
        {hasPlayerOfYear && (
          <WinnerCard
            icon={<Star className="h-6 w-6" />}
            accent="none"
            title={t("awardsCeremony.playerOfYear")}
            name={playerOfYear.playerName}
            teamName={playerOfYear.teamName}
            valueLabel={t("awardsCeremony.rating")}
            value={playerOfYear.value}
            onSelectName={
              playerOfYear.playerId && onSelectPlayer
                ? () => onSelectPlayer(playerOfYear.playerId!)
                : undefined
            }
            onSelectTeam={
              playerOfYear.teamId && onSelectTeam
                ? () => onSelectTeam(playerOfYear.teamId!)
                : undefined
            }
          />
        )}
      </div>

      {(onBack || onContinue) && (
        <div className="flex flex-wrap justify-end gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-panel border border-line px-4 py-2 font-heading font-bold uppercase tracking-label text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              {t("awardsCeremony.back")}
            </button>
          ) : null}
          {onContinue ? (
            <button
              type="button"
              onClick={onContinue}
              className="rounded-panel bg-selected-fill px-4 py-2 font-heading font-bold uppercase tracking-label text-on-brand transition-colors hover:bg-selected-fill"
            >
              {t("awardsCeremony.continue")}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function resolvePlayerWinner(
  entry: SeasonAwardEntryData | null,
  article: NewsArticle | undefined,
  gameState: GameStateData,
  prefix: "goldenBoot" | "poty",
): ResolvedPlayerWinner {
  if (entry) {
    return {
      entry,
      playerName: entry.player_name,
      teamName: entry.team_name,
      value: prefix === "goldenBoot" ? entry.value.toFixed(0) : entry.value.toFixed(1),
      playerId: entry.player_id || null,
      teamId: entry.team_id || null,
    };
  }

  const params = article?.i18n_params ?? {};
  const playerName = params[`${prefix}Winner`] ?? "-";
  const teamName = params[`${prefix}Team`] ?? "-";
  const playerId =
    gameState.players.find((player) => {
      return player.full_name === playerName || player.match_name === playerName;
    })?.id ?? null;
  const teamId = gameState.teams.find((team) => team.name === teamName)?.id ?? null;
  const value =
    prefix === "goldenBoot" ? (params.goldenBootGoals ?? "-") : (params.potyRating ?? "-");

  return {
    entry: null,
    playerName,
    teamName,
    value,
    playerId,
    teamId,
  };
}

function resolveManagerWinner(
  entry: SeasonManagerAwardEntryData | null,
  article: NewsArticle | undefined,
  gameState: GameStateData,
): ResolvedManagerWinner {
  if (entry) {
    return {
      entry,
      managerName: entry.manager_name,
      teamName: entry.team_name,
      winRate: `${Math.round(entry.win_rate)}%`,
      teamId: entry.team_id || null,
    };
  }

  const params = article?.i18n_params ?? {};
  const teamName = params.managerTeam ?? "-";

  return {
    entry: null,
    managerName: params.managerWinner ?? "-",
    teamName,
    winRate: params.managerWinRate ? `${params.managerWinRate}%` : "-",
    teamId: gameState.teams.find((team) => team.name === teamName)?.id ?? null,
  };
}

interface WinnerCardProps {
  icon: ReactNode;
  accent: "none" | "primary" | "accent";
  title: string;
  name: string;
  teamName: string;
  valueLabel: string;
  value: string;
  onSelectName?: () => void;
  onSelectTeam?: () => void;
}

function WinnerCard({
  icon,
  accent,
  title,
  name,
  teamName,
  valueLabel,
  value,
  onSelectName,
  onSelectTeam,
}: WinnerCardProps) {
  return (
    <Card accent={accent}>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-caption font-heading font-bold uppercase tracking-[0.2em] text-fg-subtle">
              {title}
            </p>
            {onSelectName ? (
              <button
                type="button"
                onClick={onSelectName}
                className="mt-1 text-left text-title font-heading font-bold uppercase tracking-label text-fg transition-colors hover:text-selected"
              >
                {name}
              </button>
            ) : (
              <p className="mt-1 text-title font-heading font-bold uppercase tracking-label text-fg">
                {name}
              </p>
            )}
          </div>
          <div className="rounded-panel bg-hover p-3 text-fg">{icon}</div>
        </div>

        <div className="space-y-3">
          {onSelectTeam ? (
            <button
              type="button"
              onClick={onSelectTeam}
              className="text-left text-body font-heading font-bold uppercase tracking-label text-warning transition-colors hover:text-warning"
            >
              {teamName}
            </button>
          ) : (
            <p className="text-body font-heading font-bold uppercase tracking-label text-fg-muted">
              {teamName}
            </p>
          )}
          <div className="rounded-control bg-sunken p-3">
            <p className="text-caption font-heading font-bold uppercase tracking-[0.18em] text-fg-subtle">
              {valueLabel}
            </p>
            <p className="mt-2 text-heading font-heading font-bold text-fg">{value}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
