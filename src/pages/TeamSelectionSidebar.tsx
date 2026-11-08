import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { LeagueData, PlayerData, TeamData } from "../store/gameStore";
import { visibleRatingText } from "../lib/playerKnowledge";
import { naturalPositionOf } from "../lib/positions";
import { translatePositionLabel } from "../components/squad/SquadTab.helpers";
import { competitionDisplayName } from "../lib/competitionName";
import { Badge, Card, CardBody, TeamLocation } from "../components/ui";
import { Globe, Shield, Target, Users } from "lucide-react";

interface TeamSelectionSidebarProps {
  selectedTeam: TeamData | null;
  selectedTeamXi: PlayerData[];
  selectedTeamCompetitions: LeagueData[];
  getTeamAvgOvr: (teamId: string) => number | null;
  getPlayerRating: (playerId: string) => number | null;
}

export default function TeamSelectionSidebar({
  selectedTeam,
  selectedTeamXi,
  selectedTeamCompetitions,
  getTeamAvgOvr,
  getPlayerRating,
}: TeamSelectionSidebarProps) {
  const { t, i18n } = useTranslation();
  const compName = (c: LeagueData) => competitionDisplayName(c, t);

  return (
    <Card accent="accent" className="h-fit">
      <CardBody className="space-y-5 p-5">
        {selectedTeam ? (
          <>
            <div>
              <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
                {t("teamSelect.selectedClub")}
              </p>
              <h2 className="mt-1 font-heading text-title font-bold text-fg">
                {selectedTeam.name}
              </h2>
              <TeamLocation
                city={selectedTeam.city}
                countryCode={selectedTeam.country}
                locale={i18n.language}
                className="mt-2 text-body text-fg-muted"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DetailTile
                icon={<Target className="h-4 w-4" />}
                label={t("teamSelect.formation")}
                value={selectedTeam.formation}
              />
              <DetailTile
                icon={<Shield className="h-4 w-4" />}
                label={t("teamSelect.overall")}
                value={visibleRatingText(getTeamAvgOvr(selectedTeam.id))}
              />
              <DetailTile
                icon={<Users className="h-4 w-4" />}
                label={t("teamSelect.likelyXi")}
                value={
                  // The likely eleven is the backend's; until it answers the list is empty, and
                  // "0 players" would misreport a full squad.
                  getTeamAvgOvr(selectedTeam.id) === null
                    ? visibleRatingText(null)
                    : t("teamSelect.playersCount", { count: selectedTeamXi.length })
                }
              />
              <DetailTile
                icon={<Globe className="h-4 w-4" />}
                label={t("teamSelect.competitions")}
                value={String(selectedTeamCompetitions.length)}
              />
            </div>

            <div>
              <p className="mb-3 text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
                {t("teamSelect.keyPlayers")}
              </p>
              <div className="space-y-2">
                {selectedTeamXi.slice(0, 5).map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-control bg-sunken px-3 py-2"
                  >
                    <div>
                      <p className="font-semibold text-fg">{player.match_name}</p>
                      <p className="text-caption text-fg-muted">
                        {translatePositionLabel(t, naturalPositionOf(player))}
                      </p>
                    </div>
                    <Badge variant="accent">{visibleRatingText(getPlayerRating(player.id))}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
                {t("teamSelect.activeCompetitions")}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedTeamCompetitions.map((competition) => (
                  <Badge key={competition.id} variant="primary">
                    {compName(competition)}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-caption text-fg-muted">
                {t("teamSelect.clubCompetitionsAlwaysSimulated")}
              </p>
            </div>
          </>
        ) : (
          <p className="text-body text-fg-muted">{t("teamSelect.selectClubPrompt")}</p>
        )}
      </CardBody>
    </Card>
  );
}

function DetailTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-control bg-sunken px-3 py-3">
      <p className="flex items-center gap-1 text-caption text-fg-subtle">
        {icon} {label}
      </p>
      <p className="mt-1 font-heading font-bold text-fg">{value}</p>
    </div>
  );
}
