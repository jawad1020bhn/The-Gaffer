import { useTranslation } from "react-i18next";

import { byTablePosition } from "./TournamentsTab.helpers";
import type { TournamentsTeamLookup } from "./teamLookup";
import type { LeagueData } from "../../store/gameStore";

type Group = NonNullable<LeagueData["groups"]>[number];

interface TournamentsGroupTableProps {
  group: Group;
  teams: TournamentsTeamLookup;
}

/**
 * A group's mini table: place, team, played, points.
 *
 * Deliberately not the shared StandingsTable. A group has no header row, no
 * context menu, and rows that only open when the team is a club — a World Cup
 * group is national teams, which have no page to go to.
 */
export default function TournamentsGroupTable({ group, teams }: TournamentsGroupTableProps) {
  const { t } = useTranslation();
  const { userTeamId, isClubTeam, resolveTeamName, onSelectTeam } = teams;
  const groupStandings = [...group.standings].sort(byTablePosition);

  return (
    <div data-testid={`tournaments-group-${group.id}`}>
      <div className="px-4 py-2 border-b border-line bg-sunken">
        <h5 className="font-heading font-bold text-caption uppercase tracking-label text-fg-muted">
          {t("tournaments.group", { name: group.name })}
        </h5>
      </div>
      <table className="w-full text-left border-collapse">
        {/*
          The group table shows its columns by position alone — four narrow
          cells under a heading, with no room for a visible header row. Screen
          readers still need the names, so they are here and hidden.
        */}
        <thead className="sr-only">
          <tr>
            <th scope="col">{t("common.position")}</th>
            <th scope="col">{t("common.team")}</th>
            <th scope="col">{t("common.played")}</th>
            <th scope="col">{t("common.pts")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {groupStandings.map((entry, idx) => {
            const isUser = entry.team_id === userTeamId;
            const clickable = isClubTeam(entry.team_id);
            return (
              <tr
                key={entry.team_id}
                onClick={clickable ? () => onSelectTeam(entry.team_id) : undefined}
                className={`${clickable ? "cursor-pointer" : ""} transition-colors ${isUser ? "bg-selected-tint" : "hover:bg-hover/50"}`}
                data-testid={`tournaments-group-standing-${entry.team_id}`}
              >
                <td className="py-1.5 px-3 font-heading font-bold text-caption text-fg-subtle w-6">
                  {idx + 1}
                </td>
                <td
                  className={`py-1.5 px-3 font-semibold text-body ${isUser ? "text-selected" : "text-fg"}`}
                >
                  {clickable ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        // The row is clickable too; without this the team opens twice.
                        event.stopPropagation();
                        onSelectTeam(entry.team_id);
                      }}
                      className="text-left hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel rounded"
                    >
                      {resolveTeamName(entry.team_id)}
                    </button>
                  ) : (
                    resolveTeamName(entry.team_id)
                  )}
                </td>
                <td className="py-1.5 px-3 text-center text-caption text-fg-muted tabular-nums">
                  {entry.played}
                </td>
                <td className="py-1.5 px-3 text-center font-heading font-bold text-body text-fg tabular-nums">
                  {entry.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
