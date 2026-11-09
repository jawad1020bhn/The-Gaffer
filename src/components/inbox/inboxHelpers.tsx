import {
  Briefcase,
  ClipboardList,
  Crosshair,
  DollarSign,
  Dumbbell,
  FileText,
  Info,
  Landmark,
  Newspaper,
  ScanSearch,
  Smile,
  Stethoscope,
  TableProperties,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { JSX, ReactNode } from "react";

import type { MessageAction, MessageData } from "../../store/gameStore";

export interface NavigateActionType {
  NavigateTo: { route: string };
}

export interface ChooseOptionActionType {
  ChooseOption: {
    options: { id: string; label: string; description: string }[];
  };
}

export interface NavigationTarget {
  tab: string;
  context?: { messageId?: string };
  shouldResolveAction: boolean;
}

export type MessageSortOrder = "newest" | "oldest";

export type DeleteModalState =
  | { mode: "single"; messageId: string; subject: string }
  | { mode: "bulk"; messageIds: string[] }
  | null;

export const UNREAD_FILTER = "__unread";

const FILTER_BUTTON_BASE_CLASS =
  "px-3 py-1.5 rounded-control text-caption font-heading font-bold uppercase tracking-label transition-all";
const FILTER_BUTTON_ACTIVE_CLASS = "bg-selected-fill text-on-brand shadow-sm";
const FILTER_BUTTON_INACTIVE_CLASS = "bg-panel text-fg-muted border border-line hover:text-fg";

const ROUTE_TAB_MAP: Record<string, string> = {
  squad: "Squad",
  tactics: "Tactics",
  training: "Training",
  schedule: "Schedule",
  finances: "Finances",
  transfers: "Transfers",
  players: "Players",
  teams: "Teams",
  tournaments: "Tournaments",
  staff: "Staff",
  inbox: "Inbox",
  manager: "Manager",
  home: "Home",
};

const PLAYER_EVENT_MESSAGE_PREFIXES = [
  "morale_talk_",
  "bench_complaint_",
  "happy_player_",
  "contract_concern_",
];

const CATEGORY_ICONS: Record<string, ReactNode> = {
  Welcome: <Trophy className="w-4 h-4" />,
  LeagueInfo: <ClipboardList className="w-4 h-4" />,
  MatchPreview: <Crosshair className="w-4 h-4" />,
  MatchResult: <TableProperties className="w-4 h-4" />,
  Transfer: <TrendingUp className="w-4 h-4" />,
  BoardDirective: <Landmark className="w-4 h-4" />,
  PlayerMorale: <Smile className="w-4 h-4" />,
  Injury: <Stethoscope className="w-4 h-4" />,
  Training: <Dumbbell className="w-4 h-4" />,
  Finance: <DollarSign className="w-4 h-4" />,
  Contract: <FileText className="w-4 h-4" />,
  ScoutReport: <ScanSearch className="w-4 h-4" />,
  Media: <Newspaper className="w-4 h-4" />,
  System: <Info className="w-4 h-4" />,
  JobOffer: <Briefcase className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  Welcome: "text-selected",
  LeagueInfo: "text-info",
  MatchPreview: "text-warning",
  MatchResult: "text-warning",
  Transfer: "text-info",
  BoardDirective: "text-danger",
  PlayerMorale: "text-warning",
  Injury: "text-danger",
  Training: "text-positive",
  Finance: "text-positive",
  Contract: "text-info",
  ScoutReport: "text-info",
  Media: "text-warning",
  System: "text-fg-subtle",
  JobOffer: "text-info",
};

export function getCategoryIcon(category: string): ReactNode {
  return CATEGORY_ICONS[category] ?? CATEGORY_ICONS.System;
}

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.System;
}

export function getFilterButtonClassName(isActive: boolean, extraClasses = ""): string {
  let className = FILTER_BUTTON_BASE_CLASS;

  if (extraClasses.length > 0) {
    className = `${className} ${extraClasses}`;
  }

  if (isActive) {
    return `${className} ${FILTER_BUTTON_ACTIVE_CLASS}`;
  }

  return `${className} ${FILTER_BUTTON_INACTIVE_CLASS}`;
}

/**
 * Select all / deselect all over what is on screen: Delete must only ever remove messages the
 * player can see, so the selection never extends past the visible set.
 */
export function toggleVisibleSelection(selectedIds: string[], visibleIds: string[]): string[] {
  const selected = new Set(selectedIds);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  return allVisibleSelected ? [] : visibleIds;
}

export function getFilteredMessages(
  messages: MessageData[],
  categoryFilter: string | null,
): MessageData[] {
  if (categoryFilter === UNREAD_FILTER) {
    return messages.filter((message) => !message.read);
  }

  if (categoryFilter) {
    return messages.filter((message) => message.category === categoryFilter);
  }

  return messages;
}

function getMessageDateValue(date: string): number {
  const value = Date.parse(date);

  if (Number.isNaN(value)) {
    return 0;
  }

  return value;
}

export function sortInboxMessages(
  messages: MessageData[],
  sortOrder: MessageSortOrder,
): MessageData[] {
  return [...messages].sort((leftMessage, rightMessage) => {
    const leftDateValue = getMessageDateValue(leftMessage.date);
    const rightDateValue = getMessageDateValue(rightMessage.date);

    const dateCompare =
      sortOrder === "oldest" ? leftDateValue - rightDateValue : rightDateValue - leftDateValue;

    if (dateCompare !== 0) return dateCompare;

    // Stable secondary sort by id so same-date messages always appear in the same order.
    return leftMessage.id < rightMessage.id ? -1 : leftMessage.id > rightMessage.id ? 1 : 0;
  });
}

/**
 * The list column fills the grid track it is given.
 *
 * It used to carry a fixed `md:w-96` and hide itself below `md` — a website's responsive collapse.
 * The window now has a 1280px minimum and the master-detail grid owns the widths, so a fixed width
 * here only left a blank strip between the list and the pane.
 */
export function getListPaneClassName(): string {
  return "flex min-h-0 flex-1 flex-col";
}

export function getMessageRowClassName(isSelected: boolean, isRead: boolean): string {
  const baseClassName =
    "flex gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-line/50";

  if (isSelected) {
    return `${baseClassName} bg-selected-tint border-l-2 border-l-selected`;
  }

  if (!isRead) {
    return `${baseClassName} bg-panel border-l-2 border-l-accent-500 hover:bg-hover/50`;
  }

  return `${baseClassName} border-l-2 border-l-transparent hover:bg-hover/30`;
}

export function getMessageIconClassName(
  categoryColor: string,
  isSelected: boolean,
  isRead: boolean,
): string {
  const baseClassName = "w-8 h-8 rounded-control flex items-center justify-center shrink-0";

  if (isSelected) {
    return `${baseClassName} ${categoryColor} bg-selected-tint`;
  }

  if (isRead) {
    return `${baseClassName} text-fg-subtle bg-hover`;
  }

  return `${baseClassName} ${categoryColor} bg-selected-tint`;
}

export function getMessageSubjectClassName(isRead: boolean): string {
  if (isRead) {
    return "text-body truncate flex-1 font-medium text-fg-muted";
  }

  return "text-body truncate flex-1 font-bold text-fg";
}

export function getActionButtonClassName(action: MessageAction): string {
  const baseClassName =
    "px-5 py-2.5 rounded-control text-caption font-heading font-bold uppercase tracking-label transition-all mr-2 mb-2";

  if (action.resolved) {
    return `${baseClassName} bg-hover text-fg-subtle cursor-default`;
  }

  if (action.action_type === "Acknowledge" || action.action_type === "Dismiss") {
    return `${baseClassName} bg-hover text-fg hover:bg-line-strong hover:bg-hover`;
  }

  return `${baseClassName} bg-selected-fill text-on-brand hover:bg-selected-fill shadow-sm hover:shadow-md hover:shadow-card`;
}

export function renderMessageBodyLine(line: string, index: number): JSX.Element {
  const baseClassName = "text-body leading-relaxed mb-1";

  if (line.trim() === "") {
    return (
      <p key={index} className={`${baseClassName} h-3`}>
        {line}
      </p>
    );
  }

  if (line.startsWith("•")) {
    return (
      <p key={index} className={`${baseClassName} text-fg`}>
        <span className="flex items-start gap-2">
          <span className="text-selected mt-0.5">•</span>
          <span>{line.replace("•", "").trim()}</span>
        </span>
      </p>
    );
  }

  return (
    <p key={index} className={`${baseClassName} text-fg`}>
      {line}
    </p>
  );
}

export function isNavigateAction(
  actionType: MessageAction["action_type"],
): actionType is NavigateActionType {
  return typeof actionType === "object" && "NavigateTo" in actionType;
}

export function isChooseOptionAction(
  actionType: MessageAction["action_type"],
): actionType is ChooseOptionActionType {
  return typeof actionType === "object" && "ChooseOption" in actionType;
}

export function getNavigationTarget(route: string): NavigationTarget {
  const teamMatch = route.match(/^\/team\/(.+)$/);

  if (teamMatch) {
    return {
      tab: "__selectTeam",
      context: { messageId: teamMatch[1] },
      shouldResolveAction: false,
    };
  }

  const playerMatch = route.match(/^\/player\/(.+)$/);

  if (playerMatch) {
    return {
      tab: "__selectPlayer",
      context: { messageId: playerMatch[1] },
      shouldResolveAction: false,
    };
  }

  const tabMatch = route.match(/[?&]tab=([^&]+)/i);

  if (tabMatch) {
    return {
      tab: tabMatch[1],
      shouldResolveAction: true,
    };
  }

  const simpleRoute = route.replace(/^\/+/, "").split(/[/?#]/)[0].toLowerCase();

  return {
    tab: ROUTE_TAB_MAP[simpleRoute] ?? "Home",
    shouldResolveAction: true,
  };
}

export function isPlayerEventMessage(messageId: string): boolean {
  return PLAYER_EVENT_MESSAGE_PREFIXES.some((prefix) => messageId.startsWith(prefix));
}
