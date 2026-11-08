import { BadgeEuro, CalendarClock, CalendarDays, Percent } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { PlayerData, TeamData } from "../../store/gameStore";
import { formatExactMoney, formatVal, getTeamName } from "../../lib/helpers";
import { visibleWageText } from "../../lib/playerKnowledge";
import type { VisibleWage } from "../../services/scoutingService";
import { formatDate } from "../../lib/dateFormatting";
import { Dialog } from "../ui";
import { naturalPositionOf } from "../../lib/positions";
import type { LoanPeriodOption, LoanPeriodOptionId } from "./TransfersTab.helpers";
import PlayerPositionBadge from "../PlayerPositionBadge";

export interface LoanOfferFormProps {
  loanTarget: PlayerData;
  /** His wage as the club may see it: the share the offer would cover is worked out from this. */
  visibleWage: VisibleWage;
  teams: TeamData[];
  periodId: LoanPeriodOptionId | "";
  periodOptions: LoanPeriodOption[];
  selectedEndDate: string;
  onPeriodChange: (value: LoanPeriodOptionId) => void;
  wageContributionPct: number;
  onWageContributionChange: (value: number) => void;
  buyOptionEnabled: boolean;
  buyOptionFee: string;
  onBuyOptionEnabledChange: (value: boolean) => void;
  onBuyOptionFeeChange: (value: string) => void;
  result: "accepted" | "rejected" | "counter_offer" | "error" | null;
  titleKey?: string;
  submitLabelKey?: string;
  acceptedLabelKey?: string;
  rejectedLabelKey?: string;
  counteredLabelKey?: string;
  suggestedTerms?: {
    wageContributionPct: number;
    endDate: string;
    buyOptionFee?: number | null;
  } | null;
  error: string | null;
  loading: boolean;
  submitDisabled: boolean;
  noticeTitle?: string | null;
  noticeDetail?: string | null;
  acceptedMessage?: string | null;
  showPlayerSummary?: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

type LoanOfferModalProps = LoanOfferFormProps;

export function LoanOfferForm({
  loanTarget,
  visibleWage,
  teams,
  periodId,
  periodOptions,
  selectedEndDate,
  onPeriodChange,
  wageContributionPct,
  onWageContributionChange,
  buyOptionEnabled,
  buyOptionFee,
  onBuyOptionEnabledChange,
  onBuyOptionFeeChange,
  result,
  titleKey = "transfers.makeLoanOffer",
  submitLabelKey = "transfers.submitLoanOffer",
  acceptedLabelKey = "transfers.loanOfferAccepted",
  rejectedLabelKey = "transfers.loanOfferRejected",
  counteredLabelKey = "transfers.loanOfferCountered",
  suggestedTerms = null,
  error,
  loading,
  submitDisabled,
  noticeTitle = null,
  noticeDetail = null,
  acceptedMessage = null,
  showPlayerSummary = true,
  onSubmit,
  onClose,
}: LoanOfferFormProps) {
  const { t, i18n } = useTranslation();

  return (
    <>
      <h3
        id="loan-offer-modal-title"
        className="text-body font-heading font-bold uppercase tracking-label text-fg-muted mb-3"
      >
        {t(titleKey)}
      </h3>
      {showPlayerSummary ? (
        <div className="flex items-center gap-3 mb-4">
          <PlayerPositionBadge position={naturalPositionOf(loanTarget)} />
          <div>
            <p className="font-semibold text-body text-fg">{loanTarget.full_name}</p>
            <p className="text-caption text-fg-subtle">
              {getTeamName(teams, loanTarget.team_id)} •{" "}
              {t("transfers.playerValue", {
                value: formatVal(loanTarget.market_value),
              })}
            </p>
          </div>
        </div>
      ) : null}

      {noticeTitle ? (
        <div
          role="status"
          className="mb-4 flex gap-2 rounded-control border border-warning/40 bg-warning-tint px-3 py-2 text-warning"
        >
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-caption">
            <p className="font-heading font-bold uppercase tracking-label">{noticeTitle}</p>
            {noticeDetail ? <p className="mt-1">{noticeDetail}</p> : null}
          </div>
        </div>
      ) : null}

      <label
        htmlFor="loan-period"
        className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-1 flex items-center gap-1.5"
      >
        <CalendarDays className="w-3.5 h-3.5" />
        {t("transfers.loanPeriod")}
      </label>
      <select
        id="loan-period"
        value={periodId}
        onChange={(event) => onPeriodChange(event.target.value as LoanPeriodOptionId)}
        className="w-full px-3 py-2 rounded-control bg-sunken border border-line text-body text-fg mb-3 focus:outline-none focus:ring-2 focus:ring-selected/50"
      >
        {periodId ? null : (
          <option value="" disabled>
            {t("transfers.noLoanPeriodAvailable")}
          </option>
        )}
        {periodOptions.map((option) => {
          const label = t(option.labelKey);
          const disabledReason = option.disabledReasonKey ? t(option.disabledReasonKey) : null;

          return (
            <option key={option.id} value={option.id} disabled={option.disabled}>
              {disabledReason ? `${label} (${disabledReason})` : label}
            </option>
          );
        })}
      </select>

      {selectedEndDate ? (
        <p className="text-caption text-fg-muted mb-3">
          {t("transfers.loanEndsOn", {
            endDate: formatDate(selectedEndDate, i18n.language),
          })}
        </p>
      ) : (
        <p role="alert" className="text-caption text-danger mb-3">
          {t("transfers.noLoanPeriodAvailable")}
        </p>
      )}

      <div
        id="loan-wage-contribution-label"
        className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-2 flex items-center gap-1.5"
      >
        <Percent className="w-3.5 h-3.5" />
        {t("transfers.loanWageContribution")}
      </div>
      <div className="flex items-center gap-3 mb-3">
        <input
          id="loan-wage-contribution"
          type="range"
          min="0"
          max="100"
          step="5"
          value={wageContributionPct}
          aria-labelledby="loan-wage-contribution-label"
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            onWageContributionChange(Number.isFinite(nextValue) ? nextValue : 0);
          }}
          className="h-2 flex-1 cursor-pointer accent-selected-fill"
        />
        <div className="relative w-24">
          <input
            type="number"
            min="0"
            max="100"
            step="5"
            value={wageContributionPct}
            aria-label={t("transfers.loanWageContributionManual")}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              onWageContributionChange(
                Number.isFinite(nextValue) ? Math.max(0, Math.min(100, nextValue)) : 0,
              );
            }}
            className="w-full rounded-control border border-line bg-sunken px-3 py-2 pr-7 text-body text-fg focus:outline-none focus:ring-2 focus:ring-selected/50"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption text-fg-subtle">
            %
          </span>
        </div>
      </div>

      <p className="text-caption text-fg-muted mb-3">
        {t("transfers.loanWageSummary", {
          percent: wageContributionPct,
          // Covering none of his wage costs nothing whatever it is, so 0% tells nothing hidden.
          wage:
            wageContributionPct === 0
              ? formatExactMoney(0)
              : visibleWageText(
                  visibleWage,
                  (weekly) => formatExactMoney(Math.round((weekly * wageContributionPct) / 100)),
                  t,
                ),
        })}
      </p>

      <label className="flex items-start gap-2 rounded-control border border-line bg-sunken p-3 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={buyOptionEnabled}
          onChange={(event) => onBuyOptionEnabledChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-line-strong text-selected focus:ring-selected"
        />
        <span>
          <span className="block text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
            {t("transfers.loanToBuyOption")}
          </span>
          <span className="block text-caption text-fg-muted mt-0.5">
            {t("transfers.loanToBuyOptionDesc")}
          </span>
        </span>
      </label>

      <label
        htmlFor="loan-buy-option-fee"
        className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-1 flex items-center gap-1.5"
      >
        <BadgeEuro className="w-3.5 h-3.5" />
        {t("transfers.buyOptionFee")}
      </label>
      <input
        id="loan-buy-option-fee"
        type="number"
        min="0"
        step="50000"
        value={buyOptionFee}
        disabled={!buyOptionEnabled}
        onChange={(event) => onBuyOptionFeeChange(event.target.value)}
        className="w-full px-3 py-2 rounded-control bg-sunken border border-line text-body text-fg mb-3 focus:outline-none focus:ring-2 focus:ring-selected/50 disabled:opacity-50"
      />

      {buyOptionEnabled && Number(buyOptionFee) > 0 ? (
        <p className="text-caption text-fg-muted mb-3">
          {t("transfers.loanBuyOptionSummary", {
            fee: formatExactMoney(Number(buyOptionFee)),
          })}
        </p>
      ) : null}

      {result ? (
        <div
          className={`text-caption font-heading font-bold uppercase tracking-label mb-3 ${result === "accepted" ? "text-positive" : result === "counter_offer" ? "text-warning" : "text-danger"}`}
        >
          {result === "accepted"
            ? (acceptedMessage ?? t(acceptedLabelKey))
            : result === "rejected"
              ? t(rejectedLabelKey)
              : result === "counter_offer"
                ? t(counteredLabelKey)
                : error}
        </div>
      ) : null}

      {suggestedTerms ? (
        <div className="rounded-control border border-warning/40 bg-warning-tint px-3 py-2 text-caption text-warning mb-3">
          <p className="font-heading font-bold uppercase tracking-label">
            {t("transfers.loanCounterSuggestedTerms", {
              percent: suggestedTerms.wageContributionPct,
              endDate: formatDate(suggestedTerms.endDate, i18n.language),
            })}
          </p>
          {suggestedTerms.buyOptionFee ? (
            <p className="mt-1">
              {t("transfers.loanCounterSuggestedBuyOption", {
                fee: formatExactMoney(suggestedTerms.buyOptionFee),
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {error && !result ? (
        <p role="alert" className="text-caption text-danger mb-3">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className="flex-1 py-2 bg-selected-fill hover:bg-selected text-on-brand rounded-control font-heading font-bold text-body uppercase tracking-label transition-colors disabled:opacity-50"
        >
          {loading ? t("transfers.submitting") : t(submitLabelKey)}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-hover text-fg-muted rounded-control font-heading font-bold text-body uppercase tracking-label hover:bg-line-strong transition-colors"
        >
          {t("transfers.close")}
        </button>
      </div>
    </>
  );
}

export default function LoanOfferModal(props: LoanOfferModalProps) {
  return (
    <Dialog
      labelledBy="loan-offer-modal-title"
      onClose={props.onClose}
      dismissOnBackdrop
      className="w-full max-w-md rounded-panel p-6"
    >
      <LoanOfferForm {...props} />
    </Dialog>
  );
}
