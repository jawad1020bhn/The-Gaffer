import { type JSX, useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  destinationForTab,
  destinationsForSection,
  type GameSectionId,
} from "../dashboard/dashboardDestinations";
import { UnreadBadge } from "../ui";
import { rovingTarget } from "../ui/roving";
import { ShellIcon } from "./shellIcons";

interface SideRailProps {
  activeTab: string;
  activeSection: GameSectionId;
  isUnemployed: boolean;
  unreadMessagesCount: number;
  onNavigate: (tab: string) => void;
}

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset";

/**
 * The section's pages, down the left edge. It replaces the old full-width sub-navigation bar:
 * icons and words in 72px, active page marked with a lime edge, unread mail counted on Inbox.
 */
export default function SideRail({
  activeTab,
  activeSection,
  isUnemployed,
  unreadMessagesCount,
  onNavigate,
}: SideRailProps): JSX.Element {
  const { t } = useTranslation();
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const tabs = destinationsForSection(activeSection, isUnemployed);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const target = rovingTarget(event.key, index, tabs.length);
    if (target === null) return;
    event.preventDefault();
    buttons.current.get(target)?.focus();
  }

  return (
    <nav
      aria-label={t("gameNav.context")}
      className="no-select flex w-game-rail shrink-0 flex-col gap-1 overflow-y-auto overflow-x-hidden border-r border-line bg-sunken p-1.5"
    >
      {tabs.map((tab, index) => {
        const entry = destinationForTab(tab);
        if (!entry) return null;
        const active = tab === activeTab;
        const count = tab === "Inbox" && unreadMessagesCount > 0 ? unreadMessagesCount : undefined;
        const label = t(entry.labelKey);

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
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => onNavigate(tab)}
            title={label}
            className={`relative flex shrink-0 flex-col items-center gap-1 rounded-control px-1 py-2 transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
              active
                ? "bg-selected-tint text-selected before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-selected"
                : "text-fg-muted hover:bg-hover hover:text-fg"
            }`}
          >
            <span className="relative">
              <ShellIcon name={entry.icon} className="h-5 w-5" />
              {count !== undefined ? (
                <UnreadBadge
                  count={count}
                  className="absolute -right-2.5 -top-1.5 h-4 min-w-4 px-1 text-caption"
                />
              ) : null}
            </span>
            <span className="w-full truncate text-center text-caption font-medium leading-tight">
              {label}
            </span>
            {count !== undefined ? <span className="sr-only">{` (${count})`}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
