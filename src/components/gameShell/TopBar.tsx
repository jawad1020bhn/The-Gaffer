import { CalendarDays, Menu, Search, Shield, Trophy, Wallet } from "lucide-react";
import { type JSX, type KeyboardEvent, useRef } from "react";
import { useTranslation } from "react-i18next";
import { sectionsWithDestinations, type GameSectionId } from "../dashboard/dashboardDestinations";
import { rovingTarget } from "../ui/roving";
import ContextChip from "./ContextChip";
import { ShellIcon } from "./shellIcons";

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-chrome";

/** The values the bar reports. One object, so the shell does not thread six props through it. */
export interface CareerStatusFacts {
  managerName: string | null;
  teamName: string | null;
  competitionName: string | null;
  currentDate: string;
  nextFixtureLabel: string | null;
  transferBudgetLabel: string | null;
}

interface TopBarProps {
  activeSection: GameSectionId;
  isUnemployed: boolean;
  status: CareerStatusFacts;
  onSelectSection: (section: GameSectionId) => void;
  onNavigate: (tab: string) => void;
  onOpenSearch: () => void;
  onOpenMenu: () => void;
  /** The budget changed, so its chip flashes. */
  budgetHighlight?: boolean;
}

function Brand(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 items-center gap-2 pl-3 pr-2">
      <img src="../../openfootball.svg" alt="" className="h-7 w-7" />
      <span className="hidden font-heading text-lead font-bold uppercase tracking-label text-fg 2xl:inline">
        {t("app.name")}
      </span>
    </div>
  );
}

function PrimaryNav({
  activeSection,
  isUnemployed,
  onSelectSection,
}: {
  activeSection: GameSectionId;
  isUnemployed: boolean;
  onSelectSection: (section: GameSectionId) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const sections = sectionsWithDestinations(isUnemployed);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const target = rovingTarget(event.key, index, sections.length);
    if (target === null) return;
    event.preventDefault();
    buttons.current.get(target)?.focus();
  }

  return (
    <nav
      aria-label={t("gameNav.main")}
      className="no-select flex h-full shrink-0 items-stretch gap-0.5"
    >
      {sections.map((section, index) => {
        const active = section.id === activeSection;
        return (
          <button
            key={section.id}
            ref={(node) => {
              if (node) buttons.current.set(index, node);
              else buttons.current.delete(index);
            }}
            type="button"
            aria-current={active ? "page" : undefined}
            tabIndex={active ? 0 : -1}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => onSelectSection(section.id)}
            title={`${t(section.labelKey)} (Alt+${index + 1})`}
            className={`relative flex shrink-0 items-center gap-2 px-3 font-heading text-body font-bold uppercase tracking-label transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
              active
                ? "bg-selected-tint text-selected after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-selected"
                : "text-fg-muted hover:bg-hover hover:text-fg"
            }`}
          >
            <ShellIcon name={section.icon} className="h-4 w-4" />
            <span className="hidden min-[1200px]:inline">{t(section.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ContextChips({
  status,
  budgetHighlight,
  onNavigate,
}: {
  status: CareerStatusFacts;
  budgetHighlight: boolean;
  onNavigate: (tab: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { managerName, teamName, competitionName, currentDate, nextFixtureLabel } = status;
  const budget = status.transferBudgetLabel ?? t("gameNav.unknownBudget");
  const clubSub = [competitionName, managerName].filter(Boolean).join(" · ");

  return (
    <div className="no-select flex min-w-0 items-center justify-end gap-0.5 overflow-hidden">
      <ContextChip
        icon={Shield}
        label={t("gameNav.club")}
        value={teamName ?? t("gameNav.noClub")}
        sub={clubSub.length > 0 ? clubSub : null}
        onClick={() => onNavigate("Manager")}
        className="border border-line bg-sunken"
      />
      <ContextChip
        icon={CalendarDays}
        label={t("gameNav.date")}
        value={currentDate}
        onClick={() => onNavigate("Schedule")}
        className="hidden md:flex"
      />
      <ContextChip
        icon={Trophy}
        label={t("home.nextMatch")}
        value={nextFixtureLabel ?? t("gameNav.noFixture")}
        onClick={() => onNavigate("Schedule")}
        className="hidden xl:flex"
      />
      <ContextChip
        icon={Wallet}
        label={t("gameNav.transferBudget")}
        value={budget}
        onClick={() => onNavigate("Transfers")}
        className="hidden 2xl:flex"
        highlight={budgetHighlight}
      />
    </div>
  );
}

/** The single game bar: brand, the five sections, the career's facts, search and menu. */
export default function TopBar({
  activeSection,
  isUnemployed,
  status,
  onSelectSection,
  onNavigate,
  onOpenSearch,
  onOpenMenu,
  budgetHighlight = false,
}: TopBarProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <header className="no-select col-span-2 grid h-game-top grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center border-b border-line bg-chrome surface-chrome">
      <Brand />
      <PrimaryNav
        activeSection={activeSection}
        isUnemployed={isUnemployed}
        onSelectSection={onSelectSection}
      />
      <ContextChips status={status} budgetHighlight={budgetHighlight} onNavigate={onNavigate} />
      <div className="flex shrink-0 items-center gap-1.5 pl-2 pr-3">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={t("gameNav.search")}
          title={`${t("gameNav.search")} (Ctrl+K)`}
          className={`rounded-control p-2 text-fg-muted transition-colors hover:bg-hover hover:text-fg motion-reduce:transition-none ${FOCUS_RING}`}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={t("gameNav.menu")}
          title={`${t("gameNav.menu")} (Esc)`}
          className={`rounded-control p-2 text-fg-muted transition-colors hover:bg-hover hover:text-fg motion-reduce:transition-none ${FOCUS_RING}`}
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
