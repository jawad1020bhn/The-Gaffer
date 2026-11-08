import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

import type { PlayerData, TeamData, TransferOfferData } from "../../store/gameStore";
import { formatDateFull, formatExactMoney, formatVal, getTeamName } from "../../lib/helpers";
import type {
  TransferBidProjectionData,
  TransferNegotiationResponseData,
} from "../../services/transfersService";
import NegotiationFeedbackPanel, {
  type NegotiationFeedbackPanelData,
} from "../NegotiationFeedbackPanel";
import { Dialog } from "../ui";
import { naturalPositionOf } from "../../lib/positions";
import TransferNegotiationHistory from "./TransferNegotiationHistory";
import { playerHasPendingRegistration } from "./TransfersTab.model";
import PlayerPositionBadge from "../PlayerPositionBadge";

export interface TransferBidFormProps {
  bidTarget: PlayerData;
  teams: TeamData[];
  bidAmount: string;
  onBidAmountChange: (value: string) => void;
  myTeam: TeamData | null;
  bidFee: number | null;
  bidProjection: TransferBidProjectionData["projection"] | null;
  bidFeedback: NegotiationFeedbackPanelData | null;
  activeBidOffer: TransferOfferData | null;
  hasExistingOffer: boolean;
  /** The day broken-off talks can resume: when set it replaces the bid form. */
  talksResumeOn?: string | null;
  bidResult: TransferNegotiationResponseData["decision"] | "error" | null;
  /** The translated reason a bid failed. Rendered in place of the bare word "error". */
  bidError?: string | null;
  bidLoading: boolean;
  bidSubmitDisabled: boolean;
  blockingTitle?: string | null;
  blockingDetail?: string | null;
  showPlayerSummary?: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

type TransferBidModalProps = TransferBidFormProps;

export function TransferBidForm({
  bidTarget,
  teams,
  bidAmount,
  onBidAmountChange,
  myTeam,
  bidFee,
  bidProjection,
  bidFeedback,
  activeBidOffer,
  hasExistingOffer,
  talksResumeOn = null,
  bidResult,
  bidError,
  bidLoading,
  bidSubmitDisabled,
  blockingTitle = null,
  blockingDetail = null,
  showPlayerSummary = true,
  onSubmit,
  onClose,
}: TransferBidFormProps) {
  const { t, i18n } = useTranslation();
  const titleId = `transfer-bid-modal-title-${bidTarget.id}`;
  // A player with an agreed deal awaiting registration is off the market — the
  // engine refuses a new bid. Surface it here so reaching this form from a
  // profile / squad / scouting action explains itself instead of dead-ending.
  const pendingRegistration = playerHasPendingRegistration(bidTarget);

  return (
    <>
      <h3
        id={titleId}
        className="text-body font-heading font-bold uppercase tracking-label text-fg-muted mb-3"
      >
        {t("transfers.makeBid")}
      </h3>

      {showPlayerSummary ? (
        <div className="flex items-center gap-3 mb-4">
          <PlayerPositionBadge position={naturalPositionOf(bidTarget)} />
          <div>
            <p className="font-semibold text-body text-fg">{bidTarget.full_name}</p>
            <p className="text-caption text-gray-400">
              {getTeamName(teams, bidTarget.team_id)} •{" "}
              {t("transfers.playerValue", {
                value: formatVal(bidTarget.market_value),
              })}
            </p>
          </div>
        </div>
      ) : null}
      {blockingTitle ? (
        <div
          role="alert"
          className="mb-4 flex gap-2 rounded-control border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-caption">
            <p className="font-heading font-bold uppercase tracking-label">{blockingTitle}</p>
            {blockingDetail ? <p className="mt-1">{blockingDetail}</p> : null}
          </div>
        </div>
      ) : null}
      {pendingRegistration ? (
        <div
          role="alert"
          className="mb-4 flex gap-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-caption">{t("transfers.bidBlockedPendingRegistration")}</p>
        </div>
      ) : null}
      {hasExistingOffer ? (
        <p className="text-caption text-fg-muted mb-3">{t("transfers.resumeNegotiationHint")}</p>
      ) : null}
      {talksResumeOn ? (
        <p role="status" className="text-caption text-amber-700 dark:text-amber-200 mb-3">
          {t("transfers.talksResumeOn", { date: formatDateFull(talksResumeOn, i18n.language) })}
        </p>
      ) : (
        <>
          <label
            htmlFor="bid-amount"
            className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-1 block"
          >
            {t("transfers.bidAmount")}
          </label>
          <input
            id="bid-amount"
            type="number"
            step="0.1"
            min="0"
            value={bidAmount}
            onChange={(event) => onBidAmountChange(event.target.value)}
            className="w-full px-3 py-2 rounded-control bg-gray-50 dark:bg-navy-700 border border-line text-body text-fg mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
          {myTeam && bidFee !== null && bidProjection ? (
            <div className="rounded-control border border-line bg-white/70 dark:bg-navy-900/40 p-3 mb-3 space-y-2">
              <p className="text-[11px] font-heading font-bold uppercase tracking-label text-fg-muted">
                {t("transfers.bidImpactTitle")}
              </p>
              <p className="text-caption text-fg-muted">
                {t(
                  bidProjection.pending_registration_date
                    ? "transfers.bidImpactTransferBudgetDeferred"
                    : "transfers.bidImpactTransferBudget",
                  {
                    before: formatExactMoney(bidProjection.transfer_budget_before),
                    after: formatExactMoney(bidProjection.transfer_budget_after),
                    date: bidProjection.pending_registration_date ?? "",
                  },
                )}
              </p>
              <p className="text-caption text-fg-muted">
                {t(
                  bidProjection.pending_registration_date
                    ? "transfers.bidImpactBalanceDeferred"
                    : "transfers.bidImpactBalance",
                  {
                    before: formatExactMoney(bidProjection.finance_before),
                    after: formatExactMoney(bidProjection.finance_after),
                    date: bidProjection.pending_registration_date ?? "",
                  },
                )}
              </p>
              <p className="text-caption text-fg-muted">
                {t("transfers.bidImpactWageBill", {
                  before: formatExactMoney(bidProjection.current_weekly_wage_spend),
                  after: formatExactMoney(bidProjection.projected_weekly_wage_spend),
                })}
              </p>
              <p className="text-caption text-fg-muted">
                {t("transfers.bidImpactWeeklyWageBudget", {
                  budget: formatExactMoney(bidProjection.weekly_wage_budget),
                })}
              </p>
              <p className="text-caption text-fg-muted">
                {t("transfers.bidImpactIncomingWage", {
                  wage: formatExactMoney(bidProjection.incoming_player_weekly_wage),
                })}
              </p>
              <p className="text-caption text-fg-muted">
                {t("transfers.bidImpactWagePressure", {
                  percent: bidProjection.projected_wage_budget_usage_pct,
                })}
              </p>
              {bidProjection.exceeds_transfer_budget ? (
                <p className="text-caption text-red-600 dark:text-red-300">
                  {t("transfers.bidImpactOverTransferBudget")}
                </p>
              ) : null}
              {bidProjection.blocked_by_wage_policy ? (
                <p className="text-caption text-red-600 dark:text-red-300">
                  {t("transfers.bidImpactOverWagePolicy")}
                </p>
              ) : null}
              {bidProjection.exceeds_finance ? (
                <p className="text-caption text-red-600 dark:text-red-300">
                  {t("transfers.bidImpactOverBalance")}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      <NegotiationFeedbackPanel
        feedback={bidFeedback}
        titleKey="transfers.negotiationPulse"
        roundKey="transfers.negotiationRound"
        patienceKey="transfers.negotiationPatience"
        tensionKey="transfers.negotiationTension"
        className="mb-3"
      />
      <TransferNegotiationHistory offer={activeBidOffer} mode="outgoing" />
      {bidResult ? (
        <div
          className={`text-caption font-heading font-bold uppercase tracking-label mb-3 ${bidResult === "accepted" ? "text-green-500" : bidResult === "rejected" ? "text-red-600 dark:text-red-300" : "text-amber-500"}`}
        >
          {bidResult === "accepted"
            ? t("transfers.bidAccepted")
            : bidResult === "rejected"
              ? t("transfers.bidRejected")
              : bidResult === "counter_offer"
                ? t("transfers.bidCountered")
                : bidError}
        </div>
      ) : null}
      <div className="flex gap-2">
        {talksResumeOn ? null : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={bidSubmitDisabled || pendingRegistration}
            className="flex-1 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-control font-heading font-bold text-body uppercase tracking-label transition-colors disabled:opacity-50"
          >
            {bidLoading ? t("transfers.submitting") : t("transfers.submitBid")}
          </button>
        )}
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

export default function TransferBidModal(props: TransferBidModalProps) {
  const titleId = `transfer-bid-modal-title-${props.bidTarget.id}`;

  return (
    <Dialog
      labelledBy={titleId}
      onClose={props.onClose}
      dismissOnBackdrop
      className="w-full max-w-sm rounded-panel p-6"
    >
      <TransferBidForm {...props} />
    </Dialog>
  );
}
