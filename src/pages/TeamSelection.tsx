import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../store/gameStore";
import { buildRegionLabel } from "../lib/teamRegions";
import { Badge, Card, CardBody } from "../components/ui";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import TeamSelectionScopePanel from "./TeamSelectionScopePanel";
import TeamSelectionGrid from "./TeamSelectionGrid";
import TeamSelectionSidebar from "./TeamSelectionSidebar";
import { useTeamSelection } from "./useTeamSelection";

export default function TeamSelection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { gameState, setGameState, setGameActive } = useGameStore();

  const {
    clubSearch,
    setClubSearch,
    scopeExpanded,
    setScopeExpanded,
    selectedHomeRegionId,
    setSelectedHomeRegionId,
    selectedCountryCode,
    setSelectedCountryCode,
    regionSelection,
    setSelectedTeamId,
    scopeMessage,
    setScopeMessage,
    isConfirming,
    regions,
    regionCountries,
    activeRegionIds,
    availableCompetitions,
    filteredTeams,
    teamGroups,
    getTeamPlayers,
    getTeamAvgOvr,
    getPlayerRating,
    selectedTeam,
    selectedTeamXi,
    selectedTeamCompetitions,
    mandatoryCompetitionIds,
    competitionSelection,
    enabledCompetitionIds,
    handleRegionToggle,
    handleCompetitionToggle,
    handleConfirm,
  } = useTeamSelection({ gameState, setGameState, setGameActive, navigate });

  if (!gameState) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="flex items-center justify-between border-b border-line bg-panel px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label={t("common.back")}
            className="rounded-control p-2 text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-heading text-title font-bold uppercase tracking-label text-fg">
              {t("teamSelect.title")}
            </h1>
            <p className="mt-0.5 text-caption text-fg-muted">{t("teamSelect.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedTeam && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirming}
              className={`flex items-center gap-2 rounded-control bg-selected px-6 py-2.5 font-heading text-body font-bold uppercase tracking-label text-on-brand transition-colors hover:bg-selected/90 ${
                isConfirming ? "cursor-wait opacity-70" : ""
              }`}
            >
              <span>
                {isConfirming
                  ? t("teamSelect.confirming")
                  : t("teamSelect.manage", { name: selectedTeam.short_name })}
              </span>
              {isConfirming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </header>

      <div className="space-y-5 p-6">
        {scopeMessage && (
          <Card accent="accent">
            <CardBody className="py-3">
              <p className="text-body text-fg">{t(scopeMessage.key, scopeMessage.values)}</p>
            </CardBody>
          </Card>
        )}

        <TeamSelectionScopePanel
          scopeExpanded={scopeExpanded}
          onToggleScopeExpanded={() => setScopeExpanded((value) => !value)}
          regions={regions}
          selectedHomeRegionId={selectedHomeRegionId}
          onSelectHomeRegion={(regionId) => {
            setSelectedHomeRegionId(regionId);
            setScopeMessage(null);
          }}
          selectedCountryCode={selectedCountryCode}
          onSelectCountry={setSelectedCountryCode}
          regionCountries={regionCountries}
          regionSelection={regionSelection}
          onRegionToggle={handleRegionToggle}
          availableCompetitions={availableCompetitions}
          competitionSelection={competitionSelection}
          mandatoryCompetitionIds={mandatoryCompetitionIds}
          activeRegionIds={activeRegionIds}
          onCompetitionToggle={handleCompetitionToggle}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <TeamSelectionGrid
            clubSearch={clubSearch}
            onClubSearchChange={setClubSearch}
            filteredTeamsCount={filteredTeams.length}
            teamGroups={teamGroups}
            selectedTeamId={selectedTeam?.id ?? null}
            onSelectTeam={setSelectedTeamId}
            getTeamAvgOvr={getTeamAvgOvr}
            getTeamPlayerCount={(teamId) => getTeamPlayers(teamId).length}
          />

          <TeamSelectionSidebar
            selectedTeam={selectedTeam}
            selectedTeamXi={selectedTeamXi}
            selectedTeamCompetitions={selectedTeamCompetitions}
            getTeamAvgOvr={getTeamAvgOvr}
            getPlayerRating={getPlayerRating}
          />
        </div>

        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="text-body text-fg-muted">
              {t("teamSelect.scopeSummary", {
                regionsCount: activeRegionIds.length,
                competitionsCount: enabledCompetitionIds.length,
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {activeRegionIds.map((regionId) => (
                <Badge key={regionId} variant="neutral">
                  {buildRegionLabel(t, regionId)}
                </Badge>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
