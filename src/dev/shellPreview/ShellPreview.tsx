import { Search } from "lucide-react";
import { type JSX, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardWorkspaceContent from "../../components/dashboard/DashboardWorkspaceContent";
import { createDashboardTabContentModel } from "../../components/dashboard/dashboardTabContentModel";
import { DEFAULT_SQUAD_LIST_SORT_STATE } from "../../components/squad/SquadRosterView.state";
import GameCommandBar, {
  type DashboardMatchModeMeta,
} from "../../components/gameShell/GameCommandBar";
import GameShell from "../../components/gameShell/GameShell";
import { Cpu, Eye, Gamepad2 } from "lucide-react";
import type { MatchModeType } from "../../hooks/useAdvanceTime";
import { createDashboardProfileNavigationState } from "../../components/dashboard/dashboardProfileNavigation";
import type { DashboardAlert } from "../../components/dashboard/dashboardHelpers";
import { formatDateFull, formatVal, getTeamName, getUserNextFixture } from "../../lib/helpers";
import { useGameStore, type GameStateData } from "../../store/gameStore";
import type { CareerJournal, FirstDayMilestone } from "../../components/onboarding/careerJournal";
import { previewGameState } from "./fixture";

/**
 * The game shell and Home, on the preview career, in a browser with no backend.
 *
 * Dev only (`/style-guide.html?preview=shell`): it exists so the frame can be looked at — and the
 * four-resolution check run — without building the Rust side. Every handler is local; the search
 * field is the shell's palette with nothing wired to it.
 */
/** Pages other than Home read the career from the store, so the preview career is put there once. */
let storeSeeded = false;
function seedGameStore(): void {
  if (storeSeeded) return;
  storeSeeded = true;
  useGameStore.getState().setGameState(previewGameState);
}

export interface ShellPreviewProps {
  /** The career to draw; defaults to the shell preview's own fixture career. */
  gameState?: GameStateData;
  /** Presentation-only first-day guidance, as the Dashboard wires it. */
  careerJournal?: CareerJournal | null;
  onDismissGuide?: () => void;
  onAcknowledgeMilestone?: (milestone: FirstDayMilestone) => void;
  onResumeGuide?: () => void;
}

export function ShellPreview({
  gameState: providedGameState,
  careerJournal,
  onDismissGuide,
  onAcknowledgeMilestone,
  onResumeGuide,
}: ShellPreviewProps = {}): JSX.Element {
  // A caller that brings its own career (the onboarding preview) has already seeded the store.
  if (!providedGameState) seedGameStore();
  const { t } = useTranslation();
  const gameState = providedGameState ?? previewGameState;
  const [activeTab, setActiveTab] = useState("Home");
  const [matchMode, setMatchMode] = useState<MatchModeType>("live");
  const [showContinueMenu, setShowContinueMenu] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [management, setManagement] = useState(() => createDashboardProfileNavigationState("Home"));
  const myTeam = gameState.teams.find((team) => team.id === gameState.manager.team_id) ?? null;
  const nextFixture = getUserNextFixture(gameState);

  const modeMeta: Record<MatchModeType, DashboardMatchModeMeta> = {
    live: {
      label: t("continueMenu.goToField"),
      icon: <Gamepad2 className="h-4 w-4" />,
      desc: t("continueMenu.goToFieldDesc"),
    },
    spectator: {
      label: t("continueMenu.watchSpectator"),
      icon: <Eye className="h-4 w-4" />,
      desc: t("continueMenu.watchSpectatorDesc"),
    },
    delegate: {
      label: t("continueMenu.delegateAssistant"),
      icon: <Cpu className="h-4 w-4" />,
      desc: t("continueMenu.delegateAssistantDesc"),
    },
  };

  const alerts: DashboardAlert[] = [];
  const viewModel = createDashboardTabContentModel({
    activeTab: management.activeTab,
    gameState,
    seasonComplete: false,
    visitedOnboardingTabs: careerJournal ? new Set<string>() : new Set(["Squad", "Staff"]),
    squadListSortState: DEFAULT_SQUAD_LIST_SORT_STATE,
    initialMessageId: management.initialMessageId,
    careerJournal,
    handlers: {
      onSelectPlayer: () => {},
      onSelectTeam: () => {},
      onGameUpdate: () => {},
      onNavigate: (tab, context) => {
        setManagement((current) => ({
          ...current,
          activeTab: tab,
          initialMessageId: context?.messageId ?? null,
        }));
        setActiveTab(tab);
      },
      onSquadListSortChange: () => {},
      onDismissGuide,
      onAcknowledgeMilestone,
    },
  });

  function save(): void {
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  }

  return (
    <GameShell
      activeTab={activeTab}
      isUnemployed={false}
      managerName={gameState.manager.display_name}
      teamName={myTeam?.name ?? null}
      competitionName={gameState.league?.name ?? null}
      currentDate={formatDateFull(gameState.clock.current_date, "en")}
      nextFixtureLabel={
        nextFixture
          ? `${getTeamName(gameState.teams, nextFixture.home_team_id)} vs ${getTeamName(
              gameState.teams,
              nextFixture.away_team_id,
            )}`
          : null
      }
      transferBudgetLabel={myTeam ? formatVal(myTeam.transfer_budget) : null}
      unreadMessagesCount={gameState.messages.filter((message) => !message.read).length}
      hasProfileHistory={false}
      title={t("dashboard.home")}
      onNavigate={(tab) => {
        setActiveTab(tab);
        setManagement((current) => ({ ...current, activeTab: tab }));
      }}
      onBack={() => {}}
      onNavigateSettings={() => {}}
      onResumeGuide={
        onResumeGuide
          ? () => {
              onResumeGuide();
              setActiveTab("Home");
              setManagement((current) => ({ ...current, activeTab: "Home" }));
            }
          : undefined
      }
      onExitClick={() => {}}
      onSave={save}
      onContinue={() => {}}
      saveFlash={saveFlash}
      toolbar={
        <div className="flex items-center gap-2 rounded-control border border-line bg-sunken px-3 py-2">
          <Search className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
          <input
            type="search"
            placeholder={t("dashboard.searchPlaceholder")}
            aria-label={t("dashboard.searchPlaceholder")}
            className="w-full bg-transparent text-body text-fg placeholder:text-fg-subtle focus:outline-none"
          />
        </div>
      }
      commands={
        <GameCommandBar
          hasMatchToday={false}
          isAdvancing={false}
          isUnemployed={false}
          isSaving={false}
          matchMode={matchMode}
          modeMeta={modeMeta}
          onContinue={() => {}}
          onSave={save}
          onSelectMatchMode={(mode) => {
            setMatchMode(mode);
            setShowContinueMenu(false);
          }}
          onSkipToMatchDay={() => setShowContinueMenu(false)}
          onToggleContinueMenu={() => setShowContinueMenu((open) => !open)}
          saveFlash={saveFlash}
          seasonComplete={false}
          showContinueMenu={showContinueMenu}
        />
      }
    >
      <DashboardWorkspaceContent
        dashboardAlerts={alerts}
        gameState={gameState}
        profileNavigation={management}
        dashboardTabContentModel={viewModel}
        onNavigate={(tab) => {
          setActiveTab(tab);
          setManagement((current) => ({ ...current, activeTab: tab }));
        }}
        onSelectPlayer={() => {}}
        onSelectTeam={() => {}}
        onGameUpdate={() => {}}
        isUnemployed={false}
        careerJournal={careerJournal}
        onAcknowledgeMilestone={onAcknowledgeMilestone}
      />
    </GameShell>
  );
}
