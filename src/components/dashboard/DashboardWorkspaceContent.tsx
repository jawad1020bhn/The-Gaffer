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
    // Every screen is laid out to fit, so this container should never actually scroll; it stays as
    // a safety net rather than the page's scrolling mechanism. min-h-0 lets it shrink inside the
    // column instead of growing past the window.
    //
    // Keyed by tab so arriving at a section replays the entrance. The panels inside stagger on their
    // own mount, which is what makes navigation feel like a screen assembling rather than a repaint.
    //
    // No background of its own: GameShell paints the page and puts the section's SceneBackdrop
    // behind this column, so an opaque fill here would cover the room and leave the plate visible
    // nowhere but the outer gutters.
    <div
      key={dashboardTabContentModel.activeTab}
      className="scrollbar-thin animate-route-in min-h-0 flex-1 overflow-auto p-3 motion-reduce:animate-none"
    >
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
