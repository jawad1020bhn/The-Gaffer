import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { countryName } from "../../lib/countries";
import { calcAge, formatVal, getTeamName } from "../../lib/helpers";
import { naturalPositionOf } from "../../lib/positions";
import type { PlayersPageQuery } from "../../services/playersService";
import type { PlayerData, TeamData } from "../../store/gameStore";
import PlayerListFilters from "../players/PlayerListFilters";
import { PLAYER_SORT_OPTIONS } from "../players/playerSortOptions";
import ContextMenu, { type ContextMenuItem } from "../ContextMenu";
import {
  buildDividerMenuItem,
  buildOfferFreeAgentContractMenuItem,
  buildMakeTransferBidMenuItem,
  buildScoutPlayerMenuItem,
  buildViewProfileMenuItem,
  buildViewTeamMenuItem,
} from "../playerActions/playerContextMenuItems";
import {
  Card,
  CardBody,
  CardHeader,
  CountryFlag,
  PlayerAvatar,
  SortControl,
  ViewSwitch,
} from "../ui";
import { useListView } from "../../hooks/useListView";
import ScoutingPlayerCards, { ScoutAction } from "./ScoutingPlayerCards";
import PlayerPositionBadge from "../PlayerPositionBadge";

interface ScoutingPlayerSearchCardProps {
  players: PlayerData[];
  teams: TeamData[];
  query: PlayersPageQuery;
  errorMessage?: string | null;
  alreadyScoutingIds: Set<string>;
  availableScoutCount: number;
  sendingPlayerId: string | null;
  safePage: number;
  totalPages: number;
  totalPlayers: number;
  pageSize: number;
  onFilterChange: (patch: Partial<PlayersPageQuery>) => void;
  onBidPlayer?: (player: PlayerData) => void;
  onOfferFreeAgent?: (player: PlayerData) => void;
  onSelectPlayer?: (id: string) => void;
  onSelectTeam?: (id: string) => void;
  onSendScout: (playerId: string) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export default function ScoutingPlayerSearchCard({
  players,
  teams,
  query,
  errorMessage,
  alreadyScoutingIds,
  availableScoutCount,
  sendingPlayerId,
  safePage,
  totalPages,
  totalPlayers,
  pageSize,
  onFilterChange,
  onBidPlayer,
  onOfferFreeAgent,
  onSelectPlayer,
  onSelectTeam,
  onSendScout,
  onPreviousPage,
  onNextPage,
}: ScoutingPlayerSearchCardProps) {
  const { t, i18n } = useTranslation();
  const [view, setView] = useListView();

  const contextItemsFor = (player: PlayerData): ContextMenuItem[] => {
    const isScouting = alreadyScoutingIds.has(player.id);
    const scoutState = isScouting
      ? "already-assigned"
      : sendingPlayerId === player.id
        ? "busy"
        : availableScoutCount === 0
          ? "unavailable"
          : "ready";
    const contextItems = [
      ...(onSelectPlayer
        ? [
            buildViewProfileMenuItem(t, () => {
              onSelectPlayer(player.id);
            }),
          ]
        : []),
      ...(player.team_id && onSelectTeam
        ? [
            buildViewTeamMenuItem(t, () => {
              onSelectTeam(player.team_id!);
            }),
          ]
        : []),
      buildDividerMenuItem(),
      ...(player.team_id && onBidPlayer
        ? [
            buildMakeTransferBidMenuItem(t, () => {
              onBidPlayer(player);
            }),
          ]
        : !player.team_id && onOfferFreeAgent
          ? [
              buildOfferFreeAgentContractMenuItem(t, () => {
                onOfferFreeAgent(player);
              }),
            ]
          : []),
      buildScoutPlayerMenuItem(t, scoutState, () => {
        onSendScout(player.id);
      }),
    ];
    return contextItems;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 w-full">
          <span>{t("scouting.findPlayers")}</span>
        </div>
      </CardHeader>
      <CardBody>
        <PlayerListFilters
          query={query}
          onChange={onFilterChange}
          statusOptions={[]}
          searchPlaceholder={t("scouting.searchPlaceholder")}
          trailing={<ViewSwitch value={view} onChange={setView} />}
        />

        {errorMessage ? (
          <p
            role="alert"
            className="mb-3 text-caption font-heading font-bold uppercase tracking-label text-red-500"
          >
            {errorMessage}
          </p>
        ) : null}

        {view === "cards" ? (
          <>
            <div className="mb-3 flex justify-end">
              <SortControl
                options={PLAYER_SORT_OPTIONS.map(({ key, labelKey }) => ({
                  key,
                  label: t(labelKey),
                }))}
                sortKey={query.sort_key}
                ascending={query.sort_asc}
                defaultAscending={(key) => key === "name"}
                onChange={(key, ascending) =>
                  onFilterChange({ sort_key: key, sort_asc: ascending })
                }
              />
            </div>
            <ScoutingPlayerCards
              players={players}
              teams={teams}
              alreadyScoutingIds={alreadyScoutingIds}
              availableScoutCount={availableScoutCount}
              sendingPlayerId={sendingPlayerId}
              contextItemsFor={contextItemsFor}
              onSelectPlayer={onSelectPlayer}
              onSelectTeam={onSelectTeam}
              onSendScout={onSendScout}
            />
          </>
        ) : null}
        {view === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="text-caption text-fg-muted font-heading uppercase tracking-label border-b border-line">
                  <th className="text-left py-2 px-2">{t("scouting.player")}</th>
                  <th className="text-left py-2 px-1">{t("scouting.pos")}</th>
                  <th className="text-center py-2 px-1">{t("scouting.age")}</th>
                  <th className="text-left py-2 px-1">{t("scouting.team")}</th>
                  <th className="text-center py-2 px-1">{t("scouting.value")}</th>
                  <th className="text-right py-2 px-2">{t("scouting.action")}</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => {
                  const isScouting = alreadyScoutingIds.has(player.id);
                  const team = player.team_id
                    ? getTeamName(teams, player.team_id)
                    : t("common.freeAgent");
                  const contextItems = contextItemsFor(player);

                  const row = (
                    <tr
                      key={player.id}
                      className="border-b border-gray-50 dark:border-navy-700/50 hover:bg-hover/30 transition-colors"
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <PlayerAvatar
                            player={player}
                            className="h-8 w-8 shrink-0 overflow-hidden rounded-control bg-gray-100 dark:bg-navy-700 flex items-center justify-center text-caption font-heading font-bold text-gray-500 dark:text-gray-300"
                          />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onSelectPlayer?.(player.id)}
                              className="font-heading font-bold text-fg hover:text-primary-500 transition-colors text-left"
                            >
                              {player.full_name}
                            </button>
                            <div className="text-caption text-gray-400 mt-0.5 flex items-center gap-1">
                              <CountryFlag
                                code={player.nationality}
                                locale={i18n.language}
                                className="text-caption leading-none"
                              />
                              <span>{countryName(player.nationality, i18n.language)}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-1">
                        <PlayerPositionBadge position={naturalPositionOf(player)} />
                      </td>
                      <td className="text-center py-2 px-1 text-fg-muted">
                        {calcAge(player.date_of_birth)}
                      </td>
                      <td className="py-2 px-1 text-fg-muted text-caption truncate max-w-[120px]">
                        {team}
                      </td>
                      <td className="text-center py-2 px-1 text-fg-muted text-caption">
                        {formatVal(player.market_value)}
                      </td>
                      <td className="text-right py-2 px-2">
                        <ScoutAction
                          isScouting={isScouting}
                          availableScoutCount={availableScoutCount}
                          sending={sendingPlayerId === player.id}
                          onSendScout={() => onSendScout(player.id)}
                        />
                      </td>
                    </tr>
                  );

                  return (
                    <ContextMenu items={contextItems} key={player.id}>
                      {row}
                    </ContextMenu>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {players.length === 0 && (
          <p className="text-center text-body text-gray-400 py-4">{t("scouting.noPlayersFound")}</p>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-line mt-3">
            <span className="text-caption text-fg-subtle">
              {t("scouting.showingRange", {
                from: safePage * pageSize + 1,
                to: Math.min((safePage + 1) * pageSize, totalPlayers),
                total: totalPlayers,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t("scouting.previousPage")}
                disabled={safePage === 0}
                onClick={onPreviousPage}
                className="p-1.5 rounded-control bg-gray-100 dark:bg-navy-700 text-fg-muted hover:bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-caption font-heading font-bold text-fg-muted tabular-nums">
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                aria-label={t("scouting.nextPage")}
                disabled={safePage >= totalPages - 1}
                onClick={onNextPage}
                className="p-1.5 rounded-control bg-gray-100 dark:bg-navy-700 text-fg-muted hover:bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
