import type { ReactNode } from "react";
import { useRatingTiers } from "../../hooks/useRatingTiers";
import { ratingTierClass } from "../../lib/ratingTier";
import { Shield } from "lucide-react";
import { countryName } from "../../lib/countries";
import type { PlayerData } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import { buildViewTeamMenuItem } from "../playerActions/playerContextMenuItems";
import { translatePositionLabel } from "../squad/SquadTab.helpers";
import { visibleRatingText } from "../../lib/playerKnowledge";
import { formatPlayerMarketValue } from "./PlayerProfile.helpers";
import type { PlayerProfileScoutStatus, ScoutAvailability } from "./PlayerProfile.scouting";
import PlayerProfileScoutAction from "./PlayerProfileScoutAction";
import { TraitList } from "../TraitBadge";
import { LoadFailedRetryText } from "./ProfileLoadFailed";
import { Badge, Card, CountryFlag, JerseyIcon, PlayerAvatar } from "../ui";
import type { TeamData } from "../../store/types";
import PlayerPositionBadge from "../PlayerPositionBadge";

type TranslateFn = (key: string, options?: Record<string, string | number>) => string;

const NO_DATA = "–";

interface PlayerProfileHeroCardProps {
  player: PlayerData;
  /** Null when the club does not know his rating: the tile reads "–" and takes no tier colour. */
  ovr: number | null;
  primaryPosition: string;
  age: number;
  teamName: string;
  footednessLabel: string;
  weakFootValue: number;
  language: string;
  isOwnClub: boolean;
  scoutAvailability: ScoutAvailability;
  scoutStatus: PlayerProfileScoutStatus;
  scoutError: string | null;
  onScout: () => void;
  onSelectTeam?: (id: string) => void;
  team?: TeamData;
  /** The traits the club may see (`visibleTraits`). */
  traits: string[];
  /** Condition, morale and the exact wage are shown only for the club's own player. */
  showsPrivateState: boolean;
  /** His weekly wage as the club may see it, already written: exact, approximate or "–". */
  wageText: string;
  /** Set when the wage failed to load: the wage then reads as its own retry button. */
  wageRetry?: () => void;
  t: TranslateFn;
}

export default function PlayerProfileHeroCard({
  player,
  ovr,
  primaryPosition,
  age,
  teamName,
  footednessLabel,
  weakFootValue,
  language,
  isOwnClub,
  scoutAvailability,
  scoutStatus,
  scoutError,
  onScout,
  onSelectTeam,
  team,
  traits,
  showsPrivateState,
  wageText,
  wageRetry,
  t,
}: PlayerProfileHeroCardProps) {
  // A failed wage reads as its own retry, coloured for the surface it sits on: the desktop stats
  // sit on the always-dark chrome, the narrow layout's on a page-coloured card.
  const wageValue = (tone: "page" | "chrome"): ReactNode =>
    wageRetry ? (
      <LoadFailedRetryText
        t={t}
        onRetry={wageRetry}
        description={t("playerProfile.retryWage")}
        tone={tone}
      />
    ) : (
      wageText
    );
  const tierOf = useRatingTiers();
  const teamContextItems =
    player.team_id && onSelectTeam
      ? [buildViewTeamMenuItem(t, () => onSelectTeam(player.team_id!))]
      : [];

  return (
    <Card accent="primary" className="mb-5">
      <div className="bg-panel p-8 rounded-t-xl">
        <div className="flex flex-wrap items-start gap-6">
          <PlayerAvatar
            player={player}
            className="w-24 h-24 shrink-0 rounded-panel flex items-center justify-center font-heading font-bold text-display border-2 border-line/10 bg-panel/5 text-fg-subtle overflow-hidden"
          />
          <div
            className={`flex h-24 w-20 shrink-0 flex-col items-center justify-center rounded-panel border-2 font-heading ${ovr === null ? "border-line/10 bg-panel/5 text-chrome-fg-muted" : ratingTierClass(tierOf(ovr), "hero")}`}
          >
            <span className="text-caption font-bold uppercase tracking-label">
              {t("common.ovr")}
            </span>
            <span className="text-display font-bold leading-none">{visibleRatingText(ovr)}</span>
          </div>
          {player.jersey_number != null && team != null && (
            <JerseyIcon
              primaryColor={team.colors.primary}
              secondaryColor={team.colors.secondary}
              pattern={team.kit_pattern ?? "Solid"}
              number={player.jersey_number}
              size="lg"
              className="flex-shrink-0 self-center"
            />
          )}
          <div className="min-w-0 flex-1 basis-64">
            <h2 className="text-display font-heading font-bold text-fg uppercase tracking-label break-words">
              {player.full_name}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              <PlayerPositionBadge position={primaryPosition} long />
              {player.alternate_positions?.map((alternatePosition) => (
                <Badge key={alternatePosition} variant="neutral">
                  {translatePositionLabel(t, alternatePosition)}
                </Badge>
              ))}
              <span className="whitespace-nowrap text-fg-subtle text-body">
                <CountryFlag
                  code={player.nationality}
                  locale={language}
                  className="mr-1 text-body leading-none"
                />
                {countryName(player.nationality, language)}
              </span>
              <span className="text-fg-muted">•</span>
              <span className="whitespace-nowrap text-fg-subtle text-body">
                {t("common.age")} {age}
              </span>
              <span className="text-fg-muted">•</span>
              <span className="whitespace-nowrap text-fg-subtle text-body">
                {t("common.footednessLabel")}: {footednessLabel}
              </span>
              <span className="text-fg-muted">•</span>
              <span className="whitespace-nowrap text-fg-subtle text-body">
                {t("common.weakFoot")}: {weakFootValue}/5
              </span>
            </div>
            <p className="text-fg-subtle text-body mt-2 flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              {player.team_id && onSelectTeam ? (
                <ContextMenu items={teamContextItems}>
                  <button
                    type="button"
                    data-testid="player-profile-team-link"
                    onClick={() => onSelectTeam(player.team_id!)}
                    className="hover:text-selected transition-colors underline underline-offset-2"
                  >
                    {teamName}
                  </button>
                </ContextMenu>
              ) : (
                <span>{teamName}</span>
              )}
            </p>
            {traits.length > 0 ? (
              <div className="mt-3">
                <TraitList traits={traits} size="sm" />
              </div>
            ) : null}
          </div>

          {!isOwnClub ? (
            <div className="mt-3">
              <PlayerProfileScoutAction
                availability={scoutAvailability}
                scoutStatus={scoutStatus}
                scoutError={scoutError}
                onScout={onScout}
              />
            </div>
          ) : null}

          <div className="hidden md:grid grid-cols-2 gap-3 shrink-0">
            <QuickStat
              label={t("common.condition")}
              value={showsPrivateState ? `${player.condition}%` : NO_DATA}
              color={
                !showsPrivateState
                  ? "text-chrome-fg-muted"
                  : player.condition >= 70
                    ? "text-selected"
                    : "text-danger"
              }
            />
            <QuickStat
              label={t("common.morale")}
              value={showsPrivateState ? `${player.morale}%` : NO_DATA}
              color={
                !showsPrivateState
                  ? "text-chrome-fg-muted"
                  : player.morale >= 70
                    ? "text-selected"
                    : "text-warning"
              }
            />
            <QuickStat
              label={t("common.value")}
              value={formatPlayerMarketValue(player.market_value)}
              color="text-fg"
            />
            <QuickStat
              label={t("common.wage")}
              value={wageValue("chrome")}
              color={wageText === NO_DATA || wageRetry ? "text-chrome-fg-muted" : "text-fg"}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-hover md:hidden">
        <MobileQuickStat
          label={t("common.condition")}
          value={showsPrivateState ? `${player.condition}%` : NO_DATA}
          color={
            !showsPrivateState
              ? "text-fg-muted"
              : player.condition >= 70
                ? "text-selected"
                : "text-danger"
          }
        />
        <MobileQuickStat
          label={t("common.morale")}
          value={showsPrivateState ? `${player.morale}%` : NO_DATA}
          color={
            !showsPrivateState
              ? "text-fg-muted"
              : player.morale >= 70
                ? "text-selected"
                : "text-warning"
          }
        />
        <MobileQuickStat
          label={t("common.value")}
          value={formatPlayerMarketValue(player.market_value)}
          color="text-fg"
        />
        <MobileQuickStat
          label={t("common.wage")}
          value={wageValue("page")}
          color={wageText === NO_DATA || wageRetry ? "text-fg-muted" : "text-fg"}
        />
      </div>
    </Card>
  );
}

function QuickStat({ label, value, color }: { label: string; value: ReactNode; color: string }) {
  return (
    <div className="bg-panel/5 rounded-panel px-5 py-3 text-center min-w-25">
      <p className="text-caption text-fg-subtle font-heading uppercase tracking-label">{label}</p>
      <p className={`font-heading font-bold text-heading mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function MobileQuickStat({
  label,
  value,
  color,
}: {
  label: string;
  value: ReactNode;
  color: string;
}) {
  return (
    <div className="bg-panel p-3 text-center">
      <p className="text-caption text-fg-subtle font-heading uppercase tracking-label">{label}</p>
      <p className={`font-heading font-bold text-heading mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}
