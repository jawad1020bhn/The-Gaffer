import { ChevronDown, ChevronRight, Loader2, Save } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MatchModeType } from "../../hooks/useAdvanceTime";

export interface DashboardMatchModeMeta {
  desc: string;
  icon: ReactNode;
  label: string;
}

interface GameCommandBarProps {
  hasMatchToday: boolean;
  isAdvancing: boolean;
  isUnemployed: boolean;
  isSaving: boolean;
  matchMode: MatchModeType;
  modeMeta: Record<MatchModeType, DashboardMatchModeMeta>;
  onContinue: () => void;
  onSave: () => void;
  onSelectMatchMode: (mode: MatchModeType) => void;
  onSkipToMatchDay: () => void;
  onToggleContinueMenu: () => void;
  saveFlash: boolean;
  seasonComplete: boolean;
  showContinueMenu: boolean;
}

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-chrome";
const MENU_FOCUS =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus";
const FORWARD_ACTION = `flex h-10 items-center gap-2 bg-selected font-heading text-body font-bold uppercase tracking-label text-on-brand transition-colors hover:cursor-pointer hover:bg-selected/90 motion-reduce:transition-none ${FOCUS_RING}`;

function saveButtonClassName(saveFlash: boolean, isSaving: boolean): string {
  const state = saveFlash
    ? "bg-positive-tint text-positive"
    : "bg-sunken text-fg-muted ring-1 ring-inset ring-line hover:bg-hover hover:text-fg";
  return `flex h-10 shrink-0 items-center gap-1.5 rounded-control px-2.5 font-heading text-body font-bold uppercase tracking-label transition-colors hover:cursor-pointer motion-reduce:transition-none ${FOCUS_RING} ${state} ${
    isSaving ? "cursor-wait opacity-70" : ""
  }`;
}

function saveButtonLabel(
  t: (key: string) => string,
  saveFlash: boolean,
  isSaving: boolean,
): string {
  if (saveFlash) return t("dashboard.saved");
  if (isSaving) return t("dashboard.saving");
  return t("common.save");
}

function continueContent(
  t: (key: string) => string,
  hasMatchToday: boolean,
  isAdvancing: boolean,
  seasonComplete: boolean,
  meta: DashboardMatchModeMeta,
): ReactNode {
  if (seasonComplete) return <span>{t("endOfSeason.seasonComplete")}</span>;
  if (isAdvancing) return <span>{t("dashboard.simulating")}</span>;
  return (
    <>
      {meta.icon}
      <span className="whitespace-nowrap">
        {hasMatchToday ? meta.label : t("dashboard.continue")}
      </span>
    </>
  );
}

/**
 * Continue and Save, in the top bar where the player can always reach them. It reuses the
 * Dashboard's advance/save handlers; the old bottom command footer is gone.
 */
export default function GameCommandBar({
  hasMatchToday,
  isAdvancing,
  isUnemployed,
  isSaving,
  matchMode,
  modeMeta,
  onContinue,
  onSave,
  onSelectMatchMode,
  onSkipToMatchDay,
  onToggleContinueMenu,
  saveFlash,
  seasonComplete,
  showContinueMenu,
}: GameCommandBarProps): JSX.Element {
  const { t } = useTranslation();
  const currentModeMeta = modeMeta[matchMode];
  const saveLabel = saveButtonLabel(t, saveFlash, isSaving);

  return (
    <>
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className={saveButtonClassName(saveFlash, isSaving)}
        title={`${t("dashboard.saveGame")} (F5)`}
        aria-label={saveLabel}
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        <span className="hidden min-[1600px]:inline">{saveLabel}</span>
      </button>
      {isUnemployed ? (
        <button
          type="button"
          onClick={onContinue}
          disabled={isAdvancing}
          className={`${FORWARD_ACTION} gap-1.5 rounded-control px-4 disabled:cursor-wait disabled:opacity-70`}
        >
          <span>{isAdvancing ? t("dashboard.simulating") : t("dashboard.continue")}</span>
          <ChevronRight className={`h-4 w-4 ${isAdvancing ? "animate-pulse" : ""}`} />
        </button>
      ) : (
        <div className="relative">
          <div className="flex">
            <button
              type="button"
              onClick={onContinue}
              disabled={isAdvancing || seasonComplete}
              className={`${FORWARD_ACTION} rounded-r-none pl-4 pr-3 disabled:cursor-wait disabled:opacity-70`}
            >
              {continueContent(t, hasMatchToday, isAdvancing, seasonComplete, currentModeMeta)}
              <ChevronRight className={`h-4 w-4 ${isAdvancing ? "animate-pulse" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onToggleContinueMenu}
              aria-label={t("dashboard.matchModeMenu")}
              aria-expanded={showContinueMenu}
              className={`${FORWARD_ACTION} rounded-l-none border-l border-on-brand/30 px-2`}
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {showContinueMenu && (
            <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-panel border border-line bg-panel py-1 shadow-2xl">
              {(["live", "spectator", "delegate"] as const).map((mode) => {
                const isActive = matchMode === mode;
                const optionMeta = modeMeta[mode];
                return (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => onSelectMatchMode(mode)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-hover motion-reduce:transition-none ${MENU_FOCUS} ${
                      isActive ? "bg-hover" : ""
                    }`}
                  >
                    <span className={isActive ? "text-selected" : "text-fg-subtle"}>
                      {optionMeta.icon}
                    </span>
                    <div className="flex-1">
                      <span className="font-heading text-body font-bold uppercase tracking-label text-fg">
                        {optionMeta.label}
                      </span>
                      <p className="mt-0.5 text-caption text-fg-muted">{optionMeta.desc}</p>
                    </div>
                    {isActive && <span className="text-caption font-bold text-selected">✓</span>}
                  </button>
                );
              })}
              <div className="my-1 border-t border-line" />
              <button
                type="button"
                onClick={onSkipToMatchDay}
                className={`w-full px-4 py-2.5 text-left transition-colors hover:bg-hover motion-reduce:transition-none ${MENU_FOCUS}`}
              >
                <span className="font-heading text-body font-bold uppercase tracking-label text-fg">
                  {t("continueMenu.skipToMatchDay")}
                </span>
                <p className="mt-0.5 text-caption text-fg-muted">
                  {t("continueMenu.skipToMatchDayDesc")}
                </p>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
