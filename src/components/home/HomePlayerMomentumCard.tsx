import { TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { PlayerData } from "../../store/gameStore";
import { naturalPositionOf } from "../../lib/positions";
import { Badge, Card, CardBody, CardHeader, PlayerAvatar } from "../ui";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";

interface HomePlayerMomentumCardProps {
  hotPlayers: PlayerData[];
  coldPlayers: PlayerData[];
  onNavigate?: (tab: string) => void;
  className?: string;
}

export default function HomePlayerMomentumCard({
  hotPlayers,
  coldPlayers,
  onNavigate,
  className = "",
}: HomePlayerMomentumCardProps) {
  const { t } = useTranslation();

  if (hotPlayers.length === 0 && coldPlayers.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader
        action={
          <button
            type="button"
            onClick={() => onNavigate?.("Squad")}
            className="text-selected text-caption font-heading font-bold uppercase tracking-label hover:text-selected transition-colors"
          >
            {t("dashboard.squad")}
          </button>
        }
      >
        {t("home.playerMomentum")}
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hotPlayers.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-positive" />
                <span className="text-caption font-heading font-bold uppercase tracking-labelst text-positive">
                  {t("home.inForm")}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {hotPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-control bg-positive-tint"
                  >
                    <PlayerAvatar
                      player={player}
                      className="h-7 w-7 shrink-0 overflow-hidden rounded bg-hover flex items-center justify-center text-caption font-heading font-bold text-fg-muted"
                    />
                    <span className="text-caption font-medium text-fg flex-1 truncate">
                      {player.full_name}
                    </span>
                    <Badge variant="success" size="sm">
                      {translatePositionAbbreviation(t, naturalPositionOf(player))}
                    </Badge>
                    <span className="text-caption font-heading font-bold text-positive tabular-nums w-8 text-right">
                      {player.morale}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {coldPlayers.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className="w-3.5 h-3.5 text-danger" />
                <span className="text-caption font-heading font-bold uppercase tracking-labelst text-danger">
                  {t("home.lowMorale")}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {coldPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-control bg-danger-tint"
                  >
                    <PlayerAvatar
                      player={player}
                      className="h-7 w-7 shrink-0 overflow-hidden rounded bg-hover flex items-center justify-center text-caption font-heading font-bold text-fg-muted"
                    />
                    <span className="text-caption font-medium text-fg flex-1 truncate">
                      {player.full_name}
                    </span>
                    <Badge variant="danger" size="sm">
                      {translatePositionAbbreviation(t, naturalPositionOf(player))}
                    </Badge>
                    <span className="text-caption font-heading font-bold text-danger tabular-nums w-8 text-right">
                      {player.morale}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
