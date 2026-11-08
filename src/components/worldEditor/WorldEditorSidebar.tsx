import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  AlertTriangle,
  Flag,
  Globe2,
  Info,
  Shield,
  Trophy,
  Type,
  Users,
  UserCog,
  GraduationCap,
} from "lucide-react";
import type { EditTab } from "../menu/PackageEditor/types";

interface SidebarItem {
  key: EditTab;
  label: string;
  count?: number;
  icon: LucideIcon;
}

interface SidebarGroup {
  groupKey: string;
  label: string;
  items: SidebarItem[];
}

interface WorldEditorSidebarProps {
  selectedSection: EditTab;
  onSelectSection: (section: EditTab) => void;
  confederationCount: number;
  countryCount: number;
  teamCount: number;
  playerCount: number;
  youthCount: number;
  staffCount: number;
  namePoolCount: number;
  competitionCount: number;
  issueCount: number;
  warningCount: number;
  onShowIssues: () => void;
  showingIssues: boolean;
}

export function WorldEditorSidebar({
  selectedSection,
  onSelectSection,
  confederationCount,
  countryCount,
  teamCount,
  playerCount,
  youthCount,
  staffCount,
  namePoolCount,
  competitionCount,
  issueCount,
  warningCount,
  onShowIssues,
  showingIssues,
}: WorldEditorSidebarProps) {
  const { t } = useTranslation();

  const groups: SidebarGroup[] = [
    {
      groupKey: "package",
      label: t("worldEditor.sectionPackage"),
      items: [{ key: "metadata", label: t("worldEditor.metadata"), icon: Info }],
    },
    {
      groupKey: "world",
      label: t("worldEditor.sectionWorld"),
      items: [
        {
          key: "confederations",
          label: t("worldEditor.sectionConfederations"),
          count: confederationCount,
          icon: Globe2,
        },
        {
          key: "countries",
          label: t("worldEditor.sectionCountries"),
          count: countryCount,
          icon: Flag,
        },
      ],
    },
    {
      groupKey: "clubs",
      label: t("worldEditor.sectionClubs"),
      items: [
        { key: "teams", label: t("worldEditor.sectionTeams"), count: teamCount, icon: Shield },
        { key: "players", label: t("worldEditor.sectionPlayers"), count: playerCount, icon: Users },
        {
          key: "youth",
          label: t("worldEditor.sectionYouth"),
          count: youthCount,
          icon: GraduationCap,
        },
        { key: "staff", label: t("worldEditor.sectionStaff"), count: staffCount, icon: UserCog },
        { key: "names", label: t("worldEditor.sectionNames"), count: namePoolCount, icon: Type },
      ],
    },
    {
      groupKey: "competitions",
      label: t("worldEditor.sectionCompetitions"),
      items: [
        {
          key: "competitions",
          label: t("worldEditor.sectionCompetitionsList"),
          count: competitionCount,
          icon: Trophy,
        },
      ],
    },
  ];

  const itemClass = (active: boolean) =>
    `flex items-center gap-2 w-full px-3 py-2 rounded-control text-body transition-colors text-left ${
      active
        ? "bg-primary-100 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 font-semibold"
        : "text-fg-muted hover:bg-hover hover:text-fg"
    }`;

  return (
    <div className="flex flex-col h-full py-3">
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2">
        {groups.map((group) => (
          <div key={group.groupKey} className="mb-4">
            <p className="px-3 mb-1 text-caption font-heading font-bold uppercase tracking-[0.15em] text-fg-subtle">
              {group.label}
            </p>
            {group.items.map((item) => (
              <button
                type="button"
                key={item.key}
                onClick={() => onSelectSection(item.key)}
                className={itemClass(selectedSection === item.key && !showingIssues)}
              >
                <item.icon className="w-4 h-4 flex-shrink-0 opacity-70" />
                <span className="flex-1">{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`text-caption rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none ${
                      selectedSection === item.key && !showingIssues
                        ? "bg-primary-200 dark:bg-primary-500/30 text-primary-700 dark:text-primary-300"
                        : "bg-line text-fg-muted"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Findings at the bottom: errors in red, warnings in amber */}
      <div className="flex-shrink-0 px-2 pt-2 border-t border-line">
        <button
          type="button"
          onClick={onShowIssues}
          className={`flex flex-col items-start gap-0.5 w-full px-3 py-2 rounded-control text-body transition-colors ${
            showingIssues
              ? issueCount > 0
                ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : issueCount > 0
                ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                : warningCount > 0
                  ? "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                  : "text-fg-subtle hover:bg-hover"
          }`}
        >
          {issueCount > 0 && (
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {t("worldEditor.issuesBadge", { count: issueCount })}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {t("worldEditor.warningsBadge", { count: warningCount })}
            </span>
          )}
          {issueCount === 0 && warningCount === 0 && (
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {t("worldEditor.noIssues")}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
