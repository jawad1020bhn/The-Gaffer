import { Calendar, Users } from "lucide-react";

import { visibleRatingText } from "../../lib/playerKnowledge";
import { Card, TeamLocation, TeamLogo } from "../ui";
import type { TeamProfileTranslate } from "./TeamProfile.types";
import { QuickStat } from "./TeamProfile.primitives";
import type { TeamProfileViewModel } from "./TeamProfile.types";
import type { TeamData } from "../../store/gameStore";

interface TeamProfileHeroCardProps {
  team: TeamData;
  viewModel: TeamProfileViewModel;
  /** The squad's average rating as the backend gives it; null when the club may not see it. */
  averageRating: number | null;
  locale: string;
  t: TeamProfileTranslate;
}

export default function TeamProfileHeroCard({
  team,
  viewModel,
  averageRating,
  locale,
  t,
}: TeamProfileHeroCardProps) {
  return (
    <Card className="mb-5 overflow-hidden">
      <div
        className="p-8 relative"
        style={{
          background: `linear-gradient(135deg, ${team.colors.primary}, ${team.colors.secondary}40)`,
        }}
      >
        <div className="flex items-start gap-6">
          <TeamLogo
            team={team}
            className="w-24 h-24 rounded-panel flex items-center justify-center font-heading font-bold text-display text-fg border-2 border-line/30 overflow-hidden"
            imageClassName="h-20 w-20 object-contain drop-shadow"
            style={{ backgroundColor: team.colors.primary }}
          />
          <div className="flex-1">
            <h2 className="text-display font-heading font-bold text-fg uppercase tracking-label drop-shadow">
              {team.name}
            </h2>
            <div className="flex items-center gap-4 mt-2 text-fg/80 text-body">
              <TeamLocation
                city={team.city}
                countryCode={team.country}
                locale={locale}
                className="text-fg/80"
              />
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> {t("teams.est")} {team.founded_year}
              </span>
            </div>
            {viewModel.manager && (
              <p className="text-fg/70 text-body mt-1 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> {t("teamProfile.managerLabel")}{" "}
                {viewModel.manager.display_name}
              </p>
            )}
          </div>

          <div className="hidden md:grid grid-cols-2 gap-3">
            <QuickHeroStat label={t("teams.avgOvr")} value={visibleRatingText(averageRating)} />
            <QuickHeroStat
              label={t("manager.reputation")}
              value={String(team.reputation)}
              valueClassName="text-warning"
            />
            <QuickHeroStat
              label={t("teamProfile.leaguePos")}
              value={viewModel.leaguePos > 0 ? `#${viewModel.leaguePos}` : "—"}
            />
            <QuickHeroStat label={t("teams.squad")} value={String(viewModel.roster.length)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-hover md:hidden">
        <QuickStat
          label={t("teams.avgOvr")}
          value={visibleRatingText(averageRating)}
          color="text-selected"
        />
        <QuickStat label={t("teams.rep")} value={String(team.reputation)} color="text-warning" />
        <QuickStat
          label={t("common.position")}
          value={viewModel.leaguePos > 0 ? `#${viewModel.leaguePos}` : "—"}
          color="text-fg"
        />
        <QuickStat
          label={t("teams.squad")}
          value={String(viewModel.roster.length)}
          color="text-fg"
        />
      </div>
    </Card>
  );
}

function QuickHeroStat({
  label,
  value,
  valueClassName = "text-fg",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="bg-overlay/20 backdrop-blur rounded-panel px-5 py-3 text-center min-w-[100px]">
      <p className="text-caption text-fg/60 font-heading uppercase tracking-label">{label}</p>
      <p className={`font-heading font-bold text-title mt-0.5 ${valueClassName}`}>{value}</p>
    </div>
  );
}
