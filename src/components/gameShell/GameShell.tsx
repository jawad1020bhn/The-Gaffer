import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CircleUserRound,
  Crosshair,
  Dumbbell,
  GraduationCap,
  House,
  LogOut,
  Mail,
  Medal,
  Newspaper,
  Search,
  Settings,
  Shield,
  Trophy,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, type JSX, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  DASHBOARD_DESTINATIONS,
  GAME_SECTIONS,
  destinationForTab,
  destinationsForSection,
  resolveSectionDestination,
  sectionForTab,
  type GameSectionId,
} from "../dashboard/dashboardDestinations";
import { UnreadBadge } from "../ui";
import { rovingTarget } from "../ui/roving";

const ICONS: Record<string, LucideIcon> = {
  home: House,
  squad: Users,
  tactics: Crosshair,
  training: Dumbbell,
  staff: UserCog,
  youth: GraduationCap,
  transfers: Waypoints,
  market: Search,
  scouting: Crosshair,
  players: CircleUserRound,
  calendar: CalendarDays,
  trophy: Trophy,
  club: Shield,
  managers: UsersRound,
  medal: Medal,
  inbox: Mail,
  news: Newspaper,
  finance: Wallet,
  office: BriefcaseBusiness,
  user: CircleUserRound,
};

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-chrome";

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
  title: string;
  onNavigate: (tab: string) => void;
  onBack: () => void;
  onNavigateSettings: () => void;
  onExitClick: () => void;
  toolbar?: ReactNode;
  commands?: ReactNode;
  children: ReactNode;
}

function Icon({ name, className = "h-4 w-4" }: { name: string; className?: string }): JSX.Element {
  const Component = ICONS[name] ?? Shield;
  return <Component className={className} aria-hidden="true" />;
}

function useRovingButtons() {
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number, length: number): void {
    const target = rovingTarget(event.key, index, length);
    if (target === null) return;
    event.preventDefault();
    buttons.current.get(target)?.focus();
  }
  return { buttons, onKeyDown };
}

function SectionNav({
  activeSection,
  isUnemployed,
  remembered,
  onNavigate,
}: {
  activeSection: GameSectionId;
  isUnemployed: boolean;
  remembered: React.MutableRefObject<Partial<Record<GameSectionId, string>>>;
  onNavigate: (tab: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { buttons, onKeyDown } = useRovingButtons();
  const sections = GAME_SECTIONS.filter(
    (section) => destinationsForSection(section.id, isUnemployed).length > 0,
  );

  return (
    <nav
      aria-label={t("gameNav.main")}
      className="flex h-game-top shrink-0 items-stretch gap-1 overflow-x-auto border-b border-line bg-chrome px-3"
    >
      <div className="mr-2 hidden min-w-0 items-center gap-2 border-r border-line pr-4 xl:flex">
        <img src="../../openfootball.svg" alt="" className="h-8 w-8" />
        <span className="font-heading text-lead font-bold uppercase tracking-label text-fg">
          {t("app.name")}
        </span>
      </div>
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
            onKeyDown={(event) => onKeyDown(event, index, sections.length)}
            onClick={() =>
              onNavigate(
                resolveSectionDestination(section.id, remembered.current[section.id], isUnemployed),
              )
            }
            className={`relative flex shrink-0 items-center gap-2 px-4 font-heading text-body font-bold uppercase tracking-label transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
              active
                ? "bg-selected-tint text-selected after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-selected"
                : "text-fg-muted hover:bg-hover hover:text-fg"
            }`}
          >
            <Icon name={section.icon} />
            {t(section.labelKey)}
          </button>
        );
      })}
    </nav>
  );
}

function ContextNav({
  activeTab,
  activeSection,
  isUnemployed,
  unreadMessagesCount,
  onNavigate,
}: {
  activeTab: string;
  activeSection: GameSectionId;
  isUnemployed: boolean;
  unreadMessagesCount: number;
  onNavigate: (tab: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { buttons, onKeyDown } = useRovingButtons();
  const tabs = destinationsForSection(activeSection, isUnemployed);

  return (
    <nav
      aria-label={t("gameNav.context")}
      className="flex h-game-context shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-sunken px-4"
    >
      <span className="mr-3 hidden shrink-0 font-heading text-caption font-bold uppercase tracking-label text-fg-subtle lg:inline">
        {t(
          GAME_SECTIONS.find((section) => section.id === activeSection)?.labelKey ??
            "gameNav.career",
        )}
      </span>
      {tabs.map((tab, index) => {
        const entry = destinationForTab(tab);
        if (!entry) return null;
        const active = tab === activeTab;
        const count = tab === "Inbox" && unreadMessagesCount > 0 ? unreadMessagesCount : undefined;
        return (
          <button
            key={tab}
            ref={(node) => {
              if (node) buttons.current.set(index, node);
              else buttons.current.delete(index);
            }}
            type="button"
            aria-current={active ? "page" : undefined}
            tabIndex={active ? 0 : -1}
            onKeyDown={(event) => onKeyDown(event, index, tabs.length)}
            onClick={() => onNavigate(tab)}
            className={`flex h-9 shrink-0 items-center gap-2 rounded-control border px-3 font-heading text-caption font-bold uppercase tracking-label transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
              active
                ? "border-selected bg-selected-tint text-selected"
                : "border-transparent text-fg-muted hover:bg-hover hover:text-fg"
            }`}
          >
            <Icon name={entry.icon} className="h-3.5 w-3.5" />
            {t(entry.labelKey)}
            {count !== undefined && <UnreadBadge count={count} />}
          </button>
        );
      })}
    </nav>
  );
}

function StatusItem({
  icon,
  label,
  value,
  onClick,
  badge,
}: {
  icon: string;
  label: string;
  value: string;
  onClick?: () => void;
  badge?: number;
}): JSX.Element {
  const content = (
    <>
      <Icon name={icon} className="h-4 w-4 shrink-0 text-selected" />
      <span className="min-w-0">
        <span className="block text-caption text-fg-subtle">{label}</span>
        <span className="block truncate font-heading text-body font-semibold text-fg">{value}</span>
      </span>
      {badge !== undefined && badge > 0 && <UnreadBadge count={badge} />}
    </>
  );
  const className =
    "flex min-w-0 items-center gap-2 rounded-control px-2 py-1 text-left transition-colors motion-reduce:transition-none hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel";
  return onClick ? (
    <button type="button" onClick={onClick} className={className} title={label}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

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
  toolbar,
  commands,
  children,
}: GameShellProps): JSX.Element {
  const { t } = useTranslation();
  const statusId = useId();
  const commandsId = useId();
  const activeSection = sectionForTab(activeTab);
  const remembered = useRef<Partial<Record<GameSectionId, string>>>({});

  useEffect(() => {
    if (DASHBOARD_DESTINATIONS.some((entry) => entry.tab === activeTab)) {
      remembered.current[activeSection] = activeTab;
    }
  }, [activeTab, activeSection]);

  return (
    <div className="flex h-screen min-w-0 flex-col overflow-hidden bg-page text-fg">
      <SectionNav
        activeSection={activeSection}
        isUnemployed={isUnemployed}
        remembered={remembered}
        onNavigate={onNavigate}
      />
      <ContextNav
        activeTab={activeTab}
        activeSection={activeSection}
        isUnemployed={isUnemployed}
        unreadMessagesCount={unreadMessagesCount}
        onNavigate={onNavigate}
      />
      <section
        aria-labelledby={statusId}
        className="grid shrink-0 grid-cols-2 gap-2 border-b border-line bg-panel px-4 py-2 lg:grid-cols-4"
      >
        <h2 id={statusId} className="sr-only">
          {t("gameNav.careerStatus")}
        </h2>
        <StatusItem
          icon="club"
          label={teamName ?? t("gameNav.noClub")}
          value={managerName ?? t("dashboard.manager")}
          onClick={() => onNavigate("Manager")}
        />
        <StatusItem icon="calendar" label={t("gameNav.date")} value={currentDate} />
        <StatusItem
          icon="trophy"
          label={t("home.nextMatch")}
          value={nextFixtureLabel ?? t("gameNav.noFixture")}
          onClick={() => onNavigate("Schedule")}
        />
        <StatusItem
          icon="finance"
          label={t("gameNav.transferBudget")}
          value={transferBudgetLabel ?? t("gameNav.unknownBudget")}
        />
        {competitionName && (
          <p className="col-span-full text-caption text-fg-subtle">{competitionName}</p>
        )}
      </section>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-3 border-b border-line bg-panel px-6 py-3">
          {hasProfileHistory && (
            <button
              type="button"
              onClick={onBack}
              aria-label={t("common.back")}
              title={t("common.back")}
              className={`rounded-control p-2 text-fg-muted hover:bg-hover hover:text-fg ${FOCUS_RING}`}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <h2
            data-page-title
            tabIndex={-1}
            className="min-w-0 truncate font-heading text-title font-bold uppercase tracking-label text-fg focus:outline-none"
            title={title}
          >
            {title}
          </h2>
          <div className="ml-auto flex min-w-0 items-center gap-2">{toolbar}</div>
          <button
            type="button"
            onClick={onNavigateSettings}
            aria-label={t("dashboard.settings")}
            title={t("dashboard.settings")}
            className={`rounded-control p-2 text-fg-muted hover:bg-hover hover:text-fg ${FOCUS_RING}`}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onExitClick}
            aria-label={t("dashboard.exitToMenu")}
            title={t("dashboard.exitToMenu")}
            className={`rounded-control p-2 text-fg-muted hover:bg-hover hover:text-fg ${FOCUS_RING}`}
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </main>
      <section
        aria-labelledby={commandsId}
        className="flex h-game-commands shrink-0 items-center gap-3 border-t border-line bg-chrome px-6"
      >
        <h2 id={commandsId} className="sr-only">
          {t("gameNav.commands")}
        </h2>
        <p className="hidden min-w-0 flex-1 truncate text-caption text-fg-subtle md:block">
          {managerName
            ? `${managerName} · ${teamName ?? t("gameNav.noClub")}`
            : t("gameNav.noClub")}
        </p>
        <div className="ml-auto flex items-center gap-3">{commands}</div>
      </section>
    </div>
  );
}
