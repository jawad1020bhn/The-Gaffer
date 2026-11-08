import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PlayerData, TeamData } from "../../store/gameStore";
import { countryName } from "../../lib/countries";
import { calcAge, formatVal, formatWeeklyWage, getTeamName } from "../../lib/helpers";
import { type VisibleFigures, visibleRatingText, visibleWageText } from "../../lib/playerKnowledge";
import { CountryFlag, PlayerAvatar } from "../ui";
import type { DealKind } from "./PlayerDealWorkspace";
import { naturalPositionOf } from "../../lib/positions";
import PlayerPositionBadge from "../PlayerPositionBadge";

export interface DealOption {
  kind: DealKind;
  title: string;
  description: string;
  detail: string;
  disabledReason: string | null;
  icon: ReactNode;
}

function routeButtonClass(isSelected: boolean, isDisabled: boolean): string {
  const base =
    "min-h-[88px] w-full rounded-control border px-3 py-3 text-left transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel";
  if (isDisabled) return `${base} border-line bg-sunken text-fg-muted opacity-80`;
  if (isSelected) return `${base} border-selected bg-selected-tint text-fg bg-selected-tint/50`;
  return `${base} border-line bg-panel text-fg hover:bg-sunken hover:text-fg`;
}

function factLabelClass(): string {
  return "text-caption font-heading font-bold uppercase tracking-label text-fg-muted";
}

function factValueClass(): string {
  return "mt-1 text-body font-semibold text-fg";
}

export function DealWorkspaceHeader({
  player,
  teams,
  transferWindowSummary,
  onClose,
}: {
  player: PlayerData;
  teams: TeamData[];
  transferWindowSummary: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const teamName = player.team_id ? getTeamName(teams, player.team_id) : t("common.freeAgent");
  const age = calcAge(player.date_of_birth);
  return (
    <header className="shrink-0 border-b border-line bg-panel px-4 py-3 shadow-sm dark:shadow-sm">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onClose}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel -ml-2 flex shrink-0 items-center gap-2 rounded-control px-2 py-2 text-body text-fg-muted transition-colors duration-150 motion-reduce:transition-none hover:bg-hover hover:text-fg"
          aria-label={t("common.back")}
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="hidden font-heading font-bold uppercase tracking-label sm:inline">
            {t("common.back")}
          </span>
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <PlayerAvatar
            player={player}
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-hover text-body font-heading font-bold text-fg-muted"
            imageClassName="h-full w-full object-cover object-top"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="player-deal-workspace-title"
                className="truncate font-heading text-title font-bold uppercase tracking-label text-fg"
              >
                {player.full_name}
              </h2>
              <PlayerPositionBadge position={naturalPositionOf(player)} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-fg-muted">
              <span>{age}</span>
              <span className="flex items-center gap-1">
                <CountryFlag
                  code={player.nationality}
                  locale={i18n.language}
                  className="text-body leading-none"
                />
                {countryName(player.nationality, i18n.language)}
              </span>
              <span>{teamName}</span>
              <span>{transferWindowSummary}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function DealWorkspaceRoutes({
  options,
  selectedKind,
  onSelectKind,
}: {
  options: DealOption[];
  selectedKind: DealKind;
  onSelectKind: (kind: DealKind) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("transfers.dealType")} className="space-y-3 lg:min-h-0 lg:overflow-y-auto">
      {options.map((option) => {
        const disabled = Boolean(option.disabledReason);
        const selected = option.kind === selectedKind;

        return (
          <button
            key={option.kind}
            type="button"
            disabled={disabled}
            onClick={() => onSelectKind(option.kind)}
            className={routeButtonClass(selected, disabled)}
            aria-pressed={selected}
            aria-label={option.title}
          >
            <span className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                  disabled
                    ? "bg-hover text-fg-muted"
                    : selected
                      ? "bg-selected-fill text-on-brand"
                      : "bg-hover text-fg-muted"
                }`}
              >
                {option.icon}
              </span>
              <span className="min-w-0">
                <span className="font-heading text-body font-bold uppercase tracking-label">
                  {option.title}
                </span>
                {/* Subtitle describes the route action, not availability, so a
                          selected route never reads as a confirmed deal (#305). */}
                <span className="mt-1 block text-caption text-fg-muted">
                  {option.disabledReason ?? option.description}
                </span>
                {!disabled ? (
                  <span className="mt-1 block text-caption font-medium uppercase tracking-label text-fg-muted">
                    {option.detail}
                  </span>
                ) : null}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function DealWorkspaceFacts({
  player,
  figures,
  myTeam,
  offeredWage,
}: {
  player: PlayerData;
  /** His rating and current wage as the club may see them. */
  figures: VisibleFigures;
  myTeam: TeamData | null;
  offeredWage?: number | null;
}) {
  const { t } = useTranslation();
  return (
    <aside className="min-h-0 space-y-4 lg:overflow-y-auto">
      <div className="rounded-control border border-line bg-panel p-4">
        <p className={factLabelClass()}>{t("common.ovr")}</p>
        <p className="mt-1 font-heading text-display font-bold tabular-nums text-selected">
          {visibleRatingText(figures.ovr)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className={factLabelClass()}>{t("common.value")}</p>
            <p className={`${factValueClass()} tabular-nums`}>{formatVal(player.market_value)}</p>
          </div>
          <div>
            <p className={factLabelClass()}>{t("common.currentWage")}</p>
            <p className={`${factValueClass()} tabular-nums`}>
              {visibleWageText(figures.wage, formatWeeklyWage, t)}
            </p>
          </div>
        </div>
        {offeredWage != null && offeredWage > 0 ? (
          <div className="mt-3 border-t border-line pt-3">
            <p className={factLabelClass()}>{t("playerProfile.renewalWage")}</p>
            <p className={`${factValueClass()} tabular-nums`}>{formatWeeklyWage(offeredWage)}</p>
          </div>
        ) : null}
      </div>

      {myTeam ? (
        <div className="rounded-control border border-line bg-panel p-4">
          <p className={factLabelClass()}>{t("finances.transferBudget")}</p>
          <p className={`${factValueClass()} tabular-nums`}>{formatVal(myTeam.transfer_budget)}</p>
          <div className="mt-4">
            <p className={factLabelClass()}>{t("finances.wageBudget")}</p>
            <p className={`${factValueClass()} tabular-nums`}>
              {formatWeeklyWage(myTeam.wage_budget)}
            </p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
