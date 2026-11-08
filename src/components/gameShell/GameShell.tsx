import { ArrowLeft } from "lucide-react";
import { type JSX, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DASHBOARD_DESTINATIONS,
  resolveSectionDestination,
  sectionForTab,
  sectionsWithDestinations,
  type GameSectionId,
} from "../dashboard/dashboardDestinations";
import CommandPalette from "./CommandPalette";
import GameActionDock from "./GameActionDock";
import HintBar from "./HintBar";
import PauseMenu from "./PauseMenu";
import SideRail from "./SideRail";
import TopBar, { type CareerStatusFacts } from "./TopBar";
import { useGameHotkeys } from "./useGameHotkeys";

interface GameShellProps {
  activeTab: string;
  isUnemployed: boolean;
  managerName: string | null;
  teamName: string | null;
  competitionName: string | null;
  currentDate: string;
  nextFixtureLabel: string | null;
  transferBudgetLabel: string | null;
  unreadMessagesCount: number;
  hasProfileHistory: boolean;
  /** The open profile's name, shown in the slim strip above the workspace while one is open. */
  title: string;
  onNavigate: (tab: string) => void;
  onBack: () => void;
  onNavigateSettings: () => void;
  onExitClick: () => void;
  /** Quick save, reachable from the pause menu and F5. */
  onSave?: () => void;
  /** Space and the Continue button share one handler, so the hint strip tells the truth. */
  onContinue?: () => void;
  isSaving?: boolean;
  saveFlash?: boolean;
  /** The career search, shown in the Ctrl+K palette instead of a page header toolbar. */
  toolbar?: ReactNode;
  /** Continue and Save; the dashboard builds these from its advance/save state. */
  commands?: ReactNode;
  children: ReactNode;
}

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-chrome";

/** Flashes a chip when its value changes, so a transfer's budget change is noticed. */
function useValueFlash(value: string | null): boolean {
  const previous = useRef(value);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), 700);
    return () => clearTimeout(timer);
  }, [value]);

  return flashing;
}

/**
 * The game frame. One 56px bar across the top, a 72px rail of the section's pages down the left, a
 * 28px hint strip at the bottom, and the workspace filling everything between them, with the
 * career's primary actions floating in the bottom-right corner like a HUD. The screen is a fixed
 * canvas: the window never scrolls, and each panel scrolls inside itself.
 */
export default function GameShell({
  activeTab,
  isUnemployed,
  managerName,
  teamName,
  competitionName,
  currentDate,
  nextFixtureLabel,
  transferBudgetLabel,
  unreadMessagesCount,
  hasProfileHistory,
  title,
  onNavigate,
  onBack,
  onNavigateSettings,
  onExitClick,
  onSave,
  onContinue,
  isSaving = false,
  saveFlash = false,
  toolbar,
  commands,
  children,
}: GameShellProps): JSX.Element {
  const { t } = useTranslation();
  const titleId = useId();
  const activeSection = sectionForTab(activeTab);
  const remembered = useRef<Partial<Record<GameSectionId, string>>>({});
  const [pauseOpen, setPauseOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const budgetFlash = useValueFlash(transferBudgetLabel);

  useEffect(() => {
    if (DASHBOARD_DESTINATIONS.some((entry) => entry.tab === activeTab)) {
      remembered.current[activeSection] = activeTab;
    }
  }, [activeTab, activeSection]);

  function goToSection(section: GameSectionId): void {
    onNavigate(resolveSectionDestination(section, remembered.current[section], isUnemployed));
  }

  useGameHotkeys(
    {
      onMenu: () => setPauseOpen(true),
      onSearch: () => setSearchOpen(true),
      onSave,
      onContinue,
      onSection: (index) => {
        const section = sectionsWithDestinations(isUnemployed)[index];
        if (section) goToSection(section.id);
      },
    },
    !pauseOpen && !searchOpen,
  );

  const status: CareerStatusFacts = {
    managerName,
    teamName,
    competitionName,
    currentDate,
    nextFixtureLabel,
    transferBudgetLabel,
  };

  return (
    <div className="grid h-dvh grid-cols-[auto_minmax(0,1fr)] grid-rows-[var(--spacing-game-top)_minmax(0,1fr)] overflow-hidden bg-page text-fg">
      <TopBar
        activeSection={activeSection}
        isUnemployed={isUnemployed}
        status={status}
        onSelectSection={goToSection}
        onNavigate={onNavigate}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenMenu={() => setPauseOpen(true)}
        budgetHighlight={budgetFlash}
      />
      <SideRail
        activeTab={activeTab}
        activeSection={activeSection}
        isUnemployed={isUnemployed}
        unreadMessagesCount={unreadMessagesCount}
        onNavigate={onNavigate}
      />
      <main className="relative flex min-h-0 min-w-0 flex-col overflow-hidden">
        {hasProfileHistory ? (
          <section
            aria-labelledby={titleId}
            className="flex shrink-0 items-center gap-2 border-b border-line bg-panel px-3 py-1.5"
          >
            <button
              type="button"
              onClick={onBack}
              aria-label={t("common.back")}
              title={`${t("common.back")} (Esc)`}
              className={`rounded-control p-1.5 text-fg-muted transition-colors hover:bg-hover hover:text-fg motion-reduce:transition-none ${FOCUS_RING}`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <h1
              id={titleId}
              data-page-title
              tabIndex={-1}
              className="min-w-0 truncate font-heading text-lead font-bold uppercase tracking-label text-fg focus:outline-none"
              title={title}
            >
              {title}
            </h1>
          </section>
        ) : null}
        {children}
        <GameActionDock>{commands}</GameActionDock>
        <HintBar />
      </main>

      <PauseMenu
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        onSave={onSave}
        onOpenSearch={() => setSearchOpen(true)}
        onNavigateSettings={onNavigateSettings}
        onExitClick={onExitClick}
        isSaving={isSaving}
        saveFlash={saveFlash}
      />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)}>
        {toolbar}
      </CommandPalette>
    </div>
  );
}
