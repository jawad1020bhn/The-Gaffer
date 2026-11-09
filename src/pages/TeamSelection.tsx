import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../store/gameStore";
import { buildRegionLabel } from "../lib/teamRegions";
import { Badge, Button, Card, CardBody } from "../components/ui";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { isCareerPresentation } from "../components/careerSetup/careerSetupModel";
import TeamSelectionScopePanel from "./TeamSelectionScopePanel";
import TeamSelectionGrid from "./TeamSelectionGrid";
import TeamSelectionSidebar from "./TeamSelectionSidebar";
import { useTeamSelection } from "./useTeamSelection";

export default function TeamSelection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { gameState, setGameState, setGameActive } = useGameStore();
  const routeState = location.state as { careerSetup?: unknown } | null;
  const presentation = isCareerPresentation(routeState?.careerSetup)
    ? routeState.careerSetup
    : undefined;

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
  } = useTeamSelection({ gameState, setGameState, setGameActive, navigate, presentation });

  if (!gameState) {
    navigate("/");
    return null;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-page">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-chrome px-6 py-4">
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
            <Button
              variant="primary"
              size="lg"
              disabled={isConfirming}
              iconRight={<ChevronRight />}
              onClick={handleConfirm}
            >
              {isConfirming
                ? t("teamSelect.confirming")
                : t("teamSelect.manage", { name: selectedTeam.short_name })}
            </Button>
          )}
        </div>
      </header>

      <main
        aria-label={t("teamSelect.title")}
        className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-6"
      >
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
      </main>
    </div>
  );
}
