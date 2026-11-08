import { useTranslation } from "react-i18next";

import ContextMenu from "../ContextMenu";
import {
  buildViewProfileMenuItem,
  buildViewTeamMenuItem,
} from "../playerActions/playerContextMenuItems";
import { Card, CardHeader, CardBody } from "../ui";
import type { TopScorerEntry } from "./TournamentsTab.helpers";

interface TournamentsTopScorersProps {
  topScorers: TopScorerEntry[];
  onSelectTeam: (id: string) => void;
  onSelectPlayer?: (id: string) => void;
}

export default function TournamentsTopScorers({
  topScorers,
  onSelectTeam,
  onSelectPlayer,
}: TournamentsTopScorersProps) {
  const { t } = useTranslation();

  const menuItems = (playerId: string, teamId?: string | null) => {
    const items = [];

    if (typeof onSelectPlayer === "function") {
      items.push(buildViewProfileMenuItem(t, () => onSelectPlayer(playerId)));
    }

    if (teamId) {
      items.push(buildViewTeamMenuItem(t, () => onSelectTeam(teamId)));
    }

    return items;
  };

  return (
    <Card>
      <CardHeader>{t("tournaments.topScorers")}</CardHeader>
      <CardBody className="p-0">
        {topScorers.length === 0 ? (
          <p className="p-4 text-body text-fg-subtle text-center">{t("tournaments.noGoals")}</p>
        ) : (
          <div className="divide-y divide-line">
            {topScorers.map((entry, i) => (
              <ContextMenu
                items={menuItems(entry.playerId, entry.playerName!.team_id)}
                key={entry.playerId}
              >
                <div
                  className="flex items-center px-4 py-2.5 gap-3"
                  data-testid={`tournaments-top-scorer-${entry.playerId}`}
                >
                  <span className="font-heading font-bold text-body text-fg-subtle w-5 text-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-body font-semibold text-fg truncate">
                      {entry.playerName!.full_name}
                    </p>
                    <p className="text-caption text-fg-subtle">
                      {entry.playerName!.team_name ?? entry.playerName!.team_id ?? ""}
                    </p>
                  </div>
                  <span className="font-heading font-bold text-lead text-warning tabular-nums">
                    {entry.goals}
                  </span>
                </div>
              </ContextMenu>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
