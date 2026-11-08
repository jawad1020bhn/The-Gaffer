import { useTranslation } from "react-i18next";

import type { PlayerData, TeamData } from "../../store/gameStore";
import type { FreeAgentContractProjection } from "../../services/freeAgentService";
import type { NegotiationFeedbackPanelData } from "../NegotiationFeedbackPanel";
import NegotiationFeedbackPanel from "../NegotiationFeedbackPanel";
import { Dialog } from "../ui";
import { formatExactMoney, formatVal, getTeamName } from "../../lib/helpers";
import { naturalPositionOf } from "../../lib/positions";
import PlayerPositionBadge from "../PlayerPositionBadge";

const MAX_CONTRACT_YEARS = 5;

export interface FreeAgentContractFormProps {
  player: PlayerData;
  teams: TeamData[];
  wage: string;
  onWageChange: (value: string) => void;
  contractLength: string;
  onContractLengthChange: (value: string) => void;
  projection: FreeAgentContractProjection | null;
  feedback: NegotiationFeedbackPanelData | null | undefined;
  statusMessage: string | null;
  statusClassName: string;
  submitting: boolean;
  submitDisabled: boolean;
  showPlayerSummary?: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

type FreeAgentContractModalProps = FreeAgentContractFormProps;

export function FreeAgentContractForm({
  player,
  teams,
  wage,
  onWageChange,
  contractLength,
  onContractLengthChange,
  projection,
  feedback,
  statusMessage,
  statusClassName,
  submitting,
  submitDisabled,
  showPlayerSummary = true,
  onSubmit,
  onClose,
}: FreeAgentContractFormProps) {
  const { t } = useTranslation();
  const titleId = `free-agent-contract-title-${player.id}`;

  // Cash runway is a week count, or null/undefined when cash-flow is positive
  // (no finite runway → "stable"). Shared by the before/after readouts.
  const formatRunway = (weeks: number | null | undefined): string =>
    weeks === null || weeks === undefined
      ? t("finances.runwayStable")
      : t("finances.runwayWeeks", { count: weeks });

  return (
    <>
      <h3
        id={titleId}
        className="text-body font-heading font-bold uppercase tracking-label text-fg-muted mb-3"
      >
        {t("transfers.offerContract")}
      </h3>
      {showPlayerSummary ? (
        <div className="flex items-center gap-3 mb-4">
          <PlayerPositionBadge position={naturalPositionOf(player)} />
          <div>
            <p className="font-semibold text-body text-fg">{player.full_name}</p>
            <p className="text-caption text-gray-400">
              {player.team_id ? getTeamName(teams, player.team_id) : t("common.freeAgent")} •{" "}
              {t("transfers.playerValue", {
                value: formatVal(player.market_value),
              })}
            </p>
          </div>
        </div>
      ) : null}

      <label
        htmlFor="free-agent-wage"
        className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-1 block"
      >
        {t("playerProfile.renewalWage")}
      </label>
      <input
        id="free-agent-wage"
        type="number"
        min="0"
        step="1000"
        value={wage}
        onChange={(event) => onWageChange(event.target.value)}
        className="w-full px-3 py-2 rounded-control bg-gray-50 dark:bg-navy-700 border border-line text-body text-fg mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
      />

      <label
        htmlFor="free-agent-years"
        className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-1 block"
      >
        {t("playerProfile.renewalLength")}
      </label>
      <input
        id="free-agent-years"
        type="number"
        min="1"
        max={String(MAX_CONTRACT_YEARS)}
        step="1"
        value={contractLength}
        onChange={(event) => onContractLengthChange(event.target.value)}
        className="w-full px-3 py-2 rounded-control bg-gray-50 dark:bg-navy-700 border border-line text-body text-fg mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
      />

      {projection ? (
        <div className="rounded-control border border-line bg-white/70 dark:bg-navy-900/40 p-3 mb-3 space-y-2">
          <p className="text-[11px] font-heading font-bold uppercase tracking-label text-fg-muted">
            {t("playerProfile.renewalProjectionTitle")}
          </p>
          <p className="text-caption text-fg-muted">
            {t("playerProfile.renewalProjectionWageBill", {
              before: formatExactMoney(projection.current_weekly_wage_spend),
              after: formatExactMoney(projection.projected_weekly_wage_spend),
            })}
          </p>
          <p className="text-caption text-fg-muted">
            {t("playerProfile.renewalProjectionBudgetUsage", {
              before: Math.round(
                (projection.current_annual_wage_bill / Math.max(projection.annual_wage_budget, 1)) *
                  100,
              ),
              after: Math.round(
                (projection.projected_annual_wage_bill /
                  Math.max(projection.annual_wage_budget, 1)) *
                  100,
              ),
            })}
          </p>
          <p className="text-caption text-fg-muted">
            {t("playerProfile.renewalProjectionRunway", {
              before: formatRunway(projection.current_cash_runway_weeks),
              after: formatRunway(projection.projected_cash_runway_weeks),
            })}
          </p>
          {!projection.policy_allows ? (
            <p className="text-caption text-red-600 dark:text-red-300">
              {t("playerProfile.renewalBudgetWarning")}
            </p>
          ) : null}
        </div>
      ) : null}

      <NegotiationFeedbackPanel
        feedback={feedback ?? null}
        titleKey="playerProfile.renewalConversationTitle"
        roundKey="playerProfile.renewalRound"
        patienceKey="playerProfile.renewalPatience"
        tensionKey="playerProfile.renewalTension"
        className="mb-3"
      />

      {statusMessage ? (
        <div
          className={`text-caption font-heading font-bold uppercase tracking-label mb-3 ${statusClassName}`}
        >
          {statusMessage}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className="flex-1 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-control font-heading font-bold text-body uppercase tracking-label transition-colors disabled:opacity-50"
        >
          {submitting ? t("transfers.submitting") : t("playerProfile.renewalSubmit")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-hover text-fg-muted rounded-control font-heading font-bold text-body uppercase tracking-label hover:bg-gray-300 dark:hover:bg-navy-600 transition-colors"
        >
          {t("transfers.close")}
        </button>
      </div>
    </>
  );
}

export default function FreeAgentContractModal(props: FreeAgentContractModalProps) {
  const titleId = `free-agent-contract-title-${props.player.id}`;

  return (
    <Dialog
      labelledBy={titleId}
      onClose={props.onClose}
      dismissOnBackdrop
      className="w-full max-w-sm rounded-panel p-6"
    >
      <FreeAgentContractForm {...props} />
    </Dialog>
  );
}
