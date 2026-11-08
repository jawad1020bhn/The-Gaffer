import { Search } from "lucide-react";
import { type JSX, type MouseEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getTeamName } from "../../lib/helpers";
import { naturalPositionOf } from "../../lib/positions";
import type { PlayerData, TeamData } from "../../store/gameStore";
import ContextMenu, { type ContextMenuItem } from "../ContextMenu";
import {
  buildViewProfileMenuItem,
  buildViewTeamMenuItem,
} from "../playerActions/playerContextMenuItems";
import { PlayerAvatar, TeamLogo } from "../ui";
import PlayerPositionBadge from "../PlayerPositionBadge";

interface DashboardSearchProps {
  matchedPlayers: PlayerData[];
  matchedTeams: TeamData[];
  onSearchBlur: () => void;
  onSearchFocus: () => void;
  onSearchQueryChange: (query: string) => void;
  onSelectSearchPlayer: (playerId: string) => void;
  onSelectSearchTeam: (teamId: string) => void;
  searchOpen: boolean;
  searchQuery: string;
  teams: TeamData[];
}

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel";
const MENU_FOCUS =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus";
const MENU_ROW = `flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-hover ${MENU_FOCUS}`;

/** A mouse press on a result must not blur the field before the click lands. */
function keepFocusInSearch(event: MouseEvent): void {
  event.preventDefault();
}

function renderSearchResults(props: {
  matchedPlayers: PlayerData[];
  matchedTeams: TeamData[];
  onSelectSearchPlayer: (playerId: string) => void;
  onSelectSearchTeam: (teamId: string) => void;
  teams: TeamData[];
  t: (key: string) => string;
}): JSX.Element {
  const { matchedPlayers, matchedTeams, onSelectSearchPlayer, onSelectSearchTeam, t, teams } =
    props;

  if (matchedPlayers.length === 0 && matchedTeams.length === 0) {
    return <p className="p-3 text-caption text-fg-subtle">{t("dashboard.noResults")}</p>;
  }

  return (
    <>
      {matchedTeams.length > 0 && (
        <div>
          <p className="px-3 pb-1 pt-2 text-caption font-semibold text-fg-muted">
            {t("dashboard.searchTeams")}
          </p>
          {matchedTeams.map((team) => {
            const contextItems = [buildViewTeamMenuItem(t, () => onSelectSearchTeam(team.id))];
            return (
              <ContextMenu items={contextItems} key={team.id}>
                <button
                  type="button"
                  onMouseDown={keepFocusInSearch}
                  onClick={() => onSelectSearchTeam(team.id)}
                  className={MENU_ROW}
                  data-testid={`dashboard-search-team-${team.id}`}
                >
                  <TeamLogo
                    team={team}
                    className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md"
                    imageClassName="h-5 w-5 object-contain"
                  />
                  <span className="text-body font-medium text-fg">{team.name}</span>
                  <span className="ml-auto text-caption text-fg-subtle">{team.city}</span>
                </button>
              </ContextMenu>
            );
          })}
        </div>
      )}
      {matchedPlayers.length > 0 && (
        <div>
          <p className="px-3 pb-1 pt-2 text-caption font-semibold text-fg-muted">
            {t("dashboard.searchPlayers")}
          </p>
          {matchedPlayers.map((player) => {
            const contextItems: ContextMenuItem[] = [
              buildViewProfileMenuItem(t, () => onSelectSearchPlayer(player.id)),
            ];
            const teamId = player.team_id;
            if (teamId) {
              contextItems.push(buildViewTeamMenuItem(t, () => onSelectSearchTeam(teamId)));
            }
            return (
              <ContextMenu items={contextItems} key={player.id}>
                <button
                  type="button"
                  onMouseDown={keepFocusInSearch}
                  onClick={() => onSelectSearchPlayer(player.id)}
                  className={MENU_ROW}
                  data-testid={`dashboard-search-player-${player.id}`}
                >
                  <PlayerAvatar
                    player={player}
                    className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sunken font-heading text-caption font-bold text-fg-muted"
                  />
                  <PlayerPositionBadge position={naturalPositionOf(player)} />
                  <span className="text-body font-medium text-fg">{player.full_name}</span>
                  <span className="ml-auto text-caption text-fg-subtle">
                    {getTeamName(teams, player.team_id ?? "")}
                  </span>
                </button>
              </ContextMenu>
            );
          })}
        </div>
      )}
    </>
  );
}

/** The career-wide entity search, kept reachable from the game shell's screen toolbar. */
export default function DashboardSearch({
  matchedPlayers,
  matchedTeams,
  onSearchBlur,
  onSearchFocus,
  onSearchQueryChange,
  onSelectSearchPlayer,
  onSelectSearchTeam,
  searchOpen,
  searchQuery,
  teams,
}: DashboardSearchProps): JSX.Element {
  const { t } = useTranslation();
  const showSearchResults = searchOpen && searchQuery.length >= 2;
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchExpanded) searchInput.current?.focus();
  }, [searchExpanded]);

  return (
    <div className="@container/search relative min-w-0 flex-1">
      <div
        role="search"
        aria-label={t("common.search")}
        data-search-field
        className={`relative min-w-0 ${searchExpanded ? "" : "hidden @3xl/search:block"}`}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setSearchExpanded(false);
          onSearchBlur();
        }}
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        <input
          ref={searchInput}
          type="text"
          placeholder={t("dashboard.searchPlaceholder")}
          aria-label={t("common.search")}
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          onFocus={onSearchFocus}
          className={`w-full rounded-control border border-line bg-sunken py-2 pl-9 pr-3 text-body text-fg placeholder:text-fg-subtle ${FOCUS_RING}`}
        />
        {showSearchResults && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-panel border border-line bg-panel shadow-lg">
            {renderSearchResults({
              matchedPlayers,
              matchedTeams,
              onSelectSearchPlayer,
              onSelectSearchTeam,
              t,
              teams,
            })}
          </div>
        )}
      </div>
      {searchExpanded ? null : (
        <button
          type="button"
          onClick={() => setSearchExpanded(true)}
          className={`rounded-control p-2 text-fg-muted transition-colors hover:bg-hover hover:text-fg @3xl/search:hidden ${FOCUS_RING}`}
          aria-label={t("common.search")}
          title={t("common.search")}
        >
          <Search className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
