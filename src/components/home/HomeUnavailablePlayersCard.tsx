import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { naturalPositionOf } from "../../lib/positions";
import type { PlayerData } from "../../store/gameStore";
import { translatePositionLabel } from "../squad/SquadTab.helpers";
import { Badge, Card, CardBody, CardHeader, PlayerAvatar } from "../ui";

interface HomeUnavailablePlayersCardProps {
  players: PlayerData[];
  resolveInjuryName: (injuryName: string) => string;
  onNavigate?: (tab: string) => void;
}

export default function HomeUnavailablePlayersCard({
  players,
  resolveInjuryName,
  onNavigate,
}: HomeUnavailablePlayersCardProps) {
  const { t } = useTranslation();

  if (players.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader
        action={
          <button
            type="button"
            onClick={() => onNavigate?.("Squad")}
            className="text-primary-500 dark:text-primary-400 text-caption font-heading font-bold uppercase tracking-label hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
          >
            {t("dashboard.squad")}
          </button>
        }
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          {t("home.unavailablePlayers")}
        </div>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col gap-2.5">
          {players.map((player) => (
            <div
              key={player.id}
              className="flex flex-col gap-2 rounded-control border border-gray-100 px-3 py-2.5 dark:border-navy-700 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex items-center gap-3">
                <PlayerAvatar player={player} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-body font-heading font-bold text-fg">
                      {player.full_name}
                    </span>
                    <Badge variant="danger" size="sm">
                      {t("common.injured")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-caption text-fg-muted">
                    {player.injury ? `${resolveInjuryName(player.injury.name)} - ` : ""}
                    {t("home.daysUnavailable", {
                      count: player.injury?.days_remaining ?? 0,
                    })}
                  </p>
                </div>
              </div>
              <div className="text-caption font-heading font-bold uppercase tracking-label text-fg-subtle">
                {translatePositionLabel(t, naturalPositionOf(player))}
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
