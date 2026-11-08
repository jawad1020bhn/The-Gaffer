import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SeasonAwardEntryData, SeasonManagerAwardEntryData } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import { Card, CardHeader, CardBody } from "../ui";
import {
  buildViewProfileMenuItem,
  buildViewTeamMenuItem,
} from "../playerActions/playerContextMenuItems";

type AwardEntry = SeasonAwardEntryData | SeasonManagerAwardEntryData;

function entryId(entry: AwardEntry): string {
  return "player_id" in entry ? entry.player_id : entry.manager_id;
}

function entryName(entry: AwardEntry): string {
  return "player_name" in entry ? entry.player_name : entry.manager_name;
}

/** Manager awards are ranked on win rate; player awards on their raw tally. */
function entryValue(entry: AwardEntry): number {
  return "win_rate" in entry ? entry.win_rate : entry.value;
}

interface TournamentsAwardCardProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  entries: AwardEntry[];
  unit: string;
  emptyText: string;
  decimal?: boolean;
  onSelectPlayer?: (id: string) => void;
  onSelectTeam: (id: string) => void;
}

/**
 * One end-of-season award leaderboard: top scorers, best manager, and so on.
 *
 * Entries are either player awards or manager awards, so every field that only
 * one of the two carries is reached through an `in` check.
 */
export default function TournamentsAwardCard({
  icon,
  title,
  subtitle,
  entries,
  unit,
  emptyText,
  decimal,
  onSelectPlayer,
  onSelectTeam,
}: TournamentsAwardCardProps) {
  const { t } = useTranslation();
  const buildAwardMenuItems = (entry: AwardEntry) => {
    const items = [buildViewTeamMenuItem(t, () => onSelectTeam(entry.team_id))];

    if (typeof onSelectPlayer === "function" && "player_id" in entry) {
      items.unshift(buildViewProfileMenuItem(t, () => onSelectPlayer(entry.player_id)));
    }

    return items;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <span>{title}</span>
            <p className="text-caption text-fg-subtle font-normal normal-case tracking-normal">
              {subtitle}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {entries.length === 0 ? (
          <p className="p-4 text-body text-fg-subtle text-center">{emptyText}</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-navy-600">
            {entries.map((entry, i) => (
              <ContextMenu items={buildAwardMenuItems(entry)} key={entryId(entry)}>
                <div
                  className="flex items-center px-4 py-2.5 gap-3"
                  data-testid={`tournaments-award-entry-${entryId(entry)}`}
                >
                  <span
                    className={`font-heading font-bold text-body w-5 text-center ${
                      i === 0 ? "text-accent-500 dark:text-accent-400" : "text-fg-subtle"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-body font-semibold truncate ${
                        i === 0 ? "text-gray-900 dark:text-gray-100" : "text-fg"
                      }`}
                    >
                      {entryName(entry)}
                    </p>
                    <p className="text-caption text-fg-subtle">{entry.team_name}</p>
                  </div>
                  <span
                    className={`font-heading font-bold tabular-nums ${
                      i === 0
                        ? "text-lead text-accent-500 dark:text-accent-400"
                        : "text-body text-fg-muted"
                    }`}
                  >
                    {decimal ? entryValue(entry).toFixed(2) : `${Math.round(entryValue(entry))}`}
                  </span>
                  <span className="text-caption text-fg-subtle w-12">{unit}</span>
                </div>
              </ContextMenu>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
