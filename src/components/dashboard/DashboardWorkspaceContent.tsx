import type { GameStateData, PlayerSelectionOptions } from "../../store/gameStore";
import { useRetiredPlayer } from "../playerProfile/useRetiredPlayer";
import PlayerProfile from "../playerProfile/PlayerProfile";
import TeamProfile from "../teamProfile";
import DashboardAlerts from "./DashboardAlerts";
import type { DashboardAlert } from "./dashboardHelpers";
import type { DashboardProfileNavigationState } from "./dashboardProfileNavigation";
import DashboardTabContent from "./DashboardTabContent";
import type { DashboardTabContentModel } from "./dashboardTabContentModel";
import { ShieldX } from "lucide-react";
import { useTranslation } from "react-i18next";
import FirstDayTaskBanner from "../onboarding/FirstDayTaskBanner";
import {
  firstDayProgress,
  taskForTab,
  type CareerJournal,
  type FirstDayMilestone,
} from "../onboarding/careerJournal";

interface DashboardWorkspaceContentProps {
  dashboardAlerts: DashboardAlert[];
  gameState: GameStateData;
  profileNavigation: DashboardProfileNavigationState;
  dashboardTabContentModel: DashboardTabContentModel;
  onNavigate: (tab: string) => void;
  onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
  onSelectTeam: (id: string) => void;
  onGameUpdate: (state: GameStateData) => void;
  isUnemployed: boolean;
  careerJournal?: CareerJournal | null;
  onAcknowledgeMilestone?: (milestone: FirstDayMilestone) => void;
}

export default function DashboardWorkspaceContent({
  dashboardAlerts,
  gameState,
  profileNavigation,
  dashboardTabContentModel,
  onNavigate,
  onSelectPlayer,
  onSelectTeam,
  onGameUpdate,
  isUnemployed,
  careerJournal,
  onAcknowledgeMilestone,
}: DashboardWorkspaceContentProps) {
  const { t } = useTranslation();
  const rosterPlayer = profileNavigation.selectedPlayerId
    ? (gameState.players.find((player) => player.id === profileNavigation.selectedPlayerId) ?? null)
    : null;
  const retiredPlayer = useRetiredPlayer(
    rosterPlayer === null ? profileNavigation.selectedPlayerId : null,
  );
  const selectedPlayer = rosterPlayer ?? retiredPlayer;
  const selectedTeam = profileNavigation.selectedTeamId
    ? (gameState.teams.find((team) => team.id === profileNavigation.selectedTeamId) ?? null)
    : null;
  const activeTask =
    careerJournal &&
    !careerJournal.dismissed &&
    careerJournal.arrivalStage === "done" &&
    !selectedPlayer &&
    !selectedTeam
      ? taskForTab(dashboardTabContentModel.activeTab)
      : null;
  const activeTaskDone =
    activeTask && careerJournal
      ? firstDayProgress(careerJournal, gameState).steps.find((step) => step.id === activeTask)
          ?.done
      : false;

  return (
    // The workspace owns the page's scroll (layout rule L1); min-h-0 lets it shrink inside the column
    // so it scrolls rather than growing past the window.
    <div className="scrollbar-thin min-h-0 flex-1 overflow-auto bg-page p-3">
      {isUnemployed && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-warning-tint px-4 py-3">
          <ShieldX className="h-5 w-5 shrink-0 text-warning" />
          <p className="text-body text-warning">{t("dashboard.unemployedBanner")}</p>
        </div>
      )}

      {!selectedPlayer && !selectedTeam ? (
        <DashboardAlerts alerts={dashboardAlerts} onNavigate={onNavigate} />
      ) : null}

      {selectedPlayer && !selectedTeam ? (
        <PlayerProfile
          player={selectedPlayer}
          gameState={gameState}
          isOwnClub={selectedPlayer.team_id === gameState.manager.team_id}
          startWithRenewalModal={profileNavigation.selectedPlayerOptions?.openRenewal === true}
          startWithTerminationModal={
            profileNavigation.selectedPlayerOptions?.openTermination === true
          }
          onSelectTeam={onSelectTeam}
          onGameUpdate={onGameUpdate}
        />
      ) : null}

      {selectedTeam ? (
        <TeamProfile
          team={selectedTeam}
          gameState={gameState}
          isOwnTeam={selectedTeam.id === gameState.manager.team_id}
          onSelectPlayer={onSelectPlayer}
        />
      ) : null}

      {activeTask && !activeTaskDone && onAcknowledgeMilestone ? (
        <FirstDayTaskBanner task={activeTask} onAcknowledge={onAcknowledgeMilestone} />
      ) : null}

      {!selectedPlayer && !selectedTeam ? (
        <DashboardTabContent viewModel={dashboardTabContentModel} />
      ) : null}
    </div>
  );
}
