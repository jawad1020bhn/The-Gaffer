import { useState, type ReactNode } from "react";
import { visibleRatingText } from "../lib/playerKnowledge";
import { useTranslation } from "react-i18next";

import type { TeamData } from "../store/gameStore";
import { formatVal } from "../lib/helpers";
import { Badge, Card, CardBody, TeamLocation, TeamLogo } from "../components/ui";
import { Landmark, Star, Trophy, Users } from "lucide-react";

interface TeamGroup {
  id: string;
  name: string;
  order: number;
  teams: TeamData[];
}

type StoryPreset = "all" | "contenders" | "sleepingGiants" | "newStories";

const STORY_PRESETS: ReadonlyArray<{ id: StoryPreset; labelKey: string }> = [
  { id: "all", labelKey: "teamSelect.presets.all" },
  { id: "contenders", labelKey: "teamSelect.presets.contenders" },
  { id: "sleepingGiants", labelKey: "teamSelect.presets.sleepingGiants" },
  { id: "newStories", labelKey: "teamSelect.presets.newStories" },
];

/** Honest story filters derived only from the club's recorded history. */
export function matchesStoryPreset(team: TeamData, preset: StoryPreset): boolean {
  if (preset === "all") return true;
  const history = team.history ?? [];
  if (preset === "newStories") return history.length === 0;
  const last = history.reduce<TeamData["history"][number] | null>(
    (latest, record) => (!latest || record.season > latest.season ? record : latest),
    null,
  );
  if (preset === "contenders") return last?.league_position === 1;
  return history.some((record) => record.league_position === 1) && last?.league_position !== 1;
}

interface TeamSelectionGridProps {
  clubSearch: string;
  onClubSearchChange: (value: string) => void;
  filteredTeamsCount: number;
  teamGroups: TeamGroup[];
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  getTeamAvgOvr: (teamId: string) => number | null;
  getTeamPlayerCount: (teamId: string) => number;
}

export default function TeamSelectionGrid({
  clubSearch,
  onClubSearchChange,
  filteredTeamsCount,
  teamGroups,
  selectedTeamId,
  onSelectTeam,
  getTeamAvgOvr,
  getTeamPlayerCount,
}: TeamSelectionGridProps) {
  const { t, i18n } = useTranslation();
  const [preset, setPreset] = useState<StoryPreset>("all");
  const visibleGroups = teamGroups
    .map((group) => ({
      ...group,
      teams: group.teams.filter((team) => matchesStoryPreset(team, preset)),
    }))
    .filter((group) => group.teams.length > 0);
  const visibleCount = visibleGroups.reduce((count, group) => count + group.teams.length, 0);

  const getReputationLabel = (
    rep: number,
  ): {
    label: string;
    variant: "primary" | "accent" | "success" | "danger" | "neutral";
  } => {
    if (rep >= 750) return { label: t("teamSelect.repWorldClass"), variant: "accent" };
    if (rep >= 600) return { label: t("teamSelect.repStrong"), variant: "success" };
    if (rep >= 400) return { label: t("teamSelect.repAverage"), variant: "neutral" };
    return { label: t("teamSelect.repDeveloping"), variant: "danger" };
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={clubSearch}
          onChange={(event) => onClubSearchChange(event.target.value)}
          placeholder={t("teamSelect.searchClubs")}
          className="min-w-0 flex-1 rounded-control border border-line bg-sunken px-3 py-2 text-body text-fg placeholder:text-fg-subtle"
        />
        <span className="shrink-0 text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
          {t("teamSelect.clubCount", { n: preset === "all" ? filteredTeamsCount : visibleCount })}
        </span>
      </div>
      <div
        role="group"
        aria-label={t("teamSelect.presets.label")}
        className="mb-4 flex flex-wrap gap-2"
      >
        {STORY_PRESETS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={preset === entry.id}
            onClick={() => setPreset(entry.id)}
            className={`min-h-9 rounded-control border px-3 py-1.5 font-heading text-caption font-bold uppercase tracking-label transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page ${preset === entry.id ? "border-selected bg-selected-tint text-selected" : "border-line bg-panel text-fg-muted hover:bg-hover hover:text-fg"}`}
          >
            {t(entry.labelKey)}
          </button>
        ))}
      </div>
      {visibleCount === 0 ? (
        <p className="py-10 text-center text-body text-fg-muted">{t("teamSelect.noClubsMatch")}</p>
      ) : (
        <div className="max-h-[640px] space-y-5 overflow-y-auto pr-1">
          {visibleGroups.map((group) => (
            <div key={group.id}>
              <p className="mb-2 text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
                {group.name}
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {group.teams.map((team) => {
                  const isSelected = selectedTeamId === team.id;
                  const avgOvr = getTeamAvgOvr(team.id);
                  const repInfo = getReputationLabel(team.reputation);
                  const playerCount = getTeamPlayerCount(team.id);

                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => onSelectTeam(team.id)}
                      aria-pressed={isSelected}
                      className={`rounded-panel text-left transition-colors duration-150 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page ${
                        isSelected ? "ring-2 ring-selected" : "hover:ring-1 hover:ring-line-strong"
                      }`}
                    >
                      <Card accent={isSelected ? "primary" : "none"} className="h-full">
                        <div
                          className={`rounded-t-panel p-4 ${isSelected ? "bg-selected-tint" : "bg-panel"}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <TeamLogo
                                team={team}
                                className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-control font-heading text-lead font-bold ${
                                  isSelected ? "bg-panel/20 text-fg" : "bg-panel/10 text-fg-subtle"
                                }`}
                              />
                              <div>
                                <h3 className="font-heading text-body font-bold uppercase tracking-label text-fg">
                                  {team.name}
                                </h3>
                                <TeamLocation
                                  city={team.city}
                                  countryCode={team.country}
                                  locale={i18n.language}
                                  className="mt-0.5 text-caption text-fg-subtle"
                                  iconClassName="w-3 h-3"
                                  flagClassName="text-caption leading-none"
                                />
                              </div>
                            </div>
                            {isSelected && <Star className="h-5 w-5 fill-current text-warning" />}
                          </div>
                        </div>

                        <CardBody className="p-4">
                          <div className="grid grid-cols-2 gap-3">
                            <InfoStat
                              icon={<Trophy className="h-3.5 w-3.5" />}
                              label={t("teamSelect.reputation")}
                              value={
                                <Badge variant={repInfo.variant} size="sm">
                                  {repInfo.label}
                                </Badge>
                              }
                            />
                            <InfoStat
                              icon={<Users className="h-3.5 w-3.5" />}
                              label={t("teamSelect.squad")}
                              value={
                                <span className="font-heading font-bold text-fg">
                                  {playerCount}
                                </span>
                              }
                            />
                            <InfoStat
                              icon={<Landmark className="h-3.5 w-3.5" />}
                              label={t("teamSelect.finances")}
                              value={
                                <span className="font-heading font-bold text-fg">
                                  {formatVal(team.finance)}
                                </span>
                              }
                            />
                            <InfoStat
                              icon={<Star className="h-3.5 w-3.5" />}
                              label={t("teamSelect.avgOvr")}
                              value={
                                <span className="font-heading text-lead font-bold text-selected">
                                  {visibleRatingText(avgOvr)}
                                </span>
                              }
                            />
                          </div>
                        </CardBody>
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoStat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-caption text-fg-subtle">
        {icon} {label}
      </span>
      {value}
    </div>
  );
}
