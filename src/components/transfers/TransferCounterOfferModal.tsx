import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

import type { PlayerData, TeamData, TransferOfferData } from "../../store/gameStore";
import { formatExactMoney, getTeamName } from "../../lib/helpers";
import type { TransferNegotiationResponseData } from "../../services/transfersService";
import NegotiationFeedbackPanel, {
  type NegotiationFeedbackPanelData,
} from "../NegotiationFeedbackPanel";
import { naturalPositionOf } from "../../lib/positions";
import TransferNegotiationHistory from "./TransferNegotiationHistory";
import { parseTransferFeeInput } from "./TransfersTab.helpers";
import PlayerPositionBadge from "../PlayerPositionBadge";
import { Dialog } from "../ui";

interface TransferCounterTarget {
  player: PlayerData;
  offerId: string;
  fromTeamId: string;
  fee: number;
}

interface TransferCounterOfferModalProps {
  counterTarget: TransferCounterTarget;
  teams: TeamData[];
  counterAmount: string;
  onCounterAmountChange: (value: string) => void;
  counterFeedback: NegotiationFeedbackPanelData | null;
  activeCounterOffer: TransferOfferData | null;
  counterResult: TransferNegotiationResponseData["decision"] | "error" | null;
  counterError: string | null;
  counterLoading: boolean;
  submitDisabled?: boolean;
  blockingTitle?: string | null;
  blockingDetail?: string | null;
  onSubmit: () => void;
  onClose: () => void;
}

export default function TransferCounterOfferModal({
  counterTarget,
  teams,
  counterAmount,
  onCounterAmountChange,
  counterFeedback,
  activeCounterOffer,
  counterResult,
  counterError,
  counterLoading,
  submitDisabled = false,
  blockingTitle = null,
  blockingDetail = null,
  onSubmit,
  onClose,
}: TransferCounterOfferModalProps) {
  const { t } = useTranslation();
  const parsedCounterAmount = parseTransferFeeInput(counterAmount);

  return (
    <Dialog
      labelledBy="transfer-counter-offer-title"
      onClose={onClose}
      dismissOnBackdrop
      className="w-full max-w-sm rounded-panel p-6"
    >
      <div>
        <h3
          id="transfer-counter-offer-title"
          className="text-body font-heading font-bold uppercase tracking-label text-fg-muted mb-3"
        >
          {t("transfers.counterOffer")}
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <PlayerPositionBadge position={naturalPositionOf(counterTarget.player)} />
          <div>
            <p className="font-semibold text-body text-fg">{counterTarget.player.full_name}</p>
            <p className="text-caption text-gray-400">
              {getTeamName(teams, counterTarget.fromTeamId)} •
              {t("transfers.currentOffer", {
                fee: formatExactMoney(counterTarget.fee),
              })}
            </p>
          </div>
        </div>
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
        {counterFeedback ? (
          <p className="text-caption text-fg-muted mb-3">{t("transfers.resumeNegotiationHint")}</p>
        ) : null}
        <label
          htmlFor="counter-offer-amount"
          className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-1 block"
        >
          {t("transfers.counterAmount")}
        </label>
        <input
          id="counter-offer-amount"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={counterAmount}
          onChange={(event) => onCounterAmountChange(event.target.value)}
          className="w-full px-3 py-2 rounded-control bg-gray-50 dark:bg-navy-700 border border-line text-body text-fg mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        />
        {parsedCounterAmount !== null ? (
          <p className="text-caption text-fg-muted mb-3">{formatExactMoney(parsedCounterAmount)}</p>
        ) : null}
        <NegotiationFeedbackPanel
          feedback={counterFeedback}
          titleKey="transfers.negotiationPulse"
          roundKey="transfers.negotiationRound"
          patienceKey="transfers.negotiationPatience"
          tensionKey="transfers.negotiationTension"
          className="mb-3"
        />
        <TransferNegotiationHistory offer={activeCounterOffer} mode="incoming" />
        {counterResult ? (
          <div
            className={`text-caption font-heading font-bold uppercase tracking-label mb-3 ${counterResult === "accepted" ? "text-green-500" : counterResult === "rejected" ? "text-red-500" : "text-amber-500"}`}
          >
            {counterResult === "accepted"
              ? t("transfers.counterAccepted")
              : counterResult === "rejected"
                ? t("transfers.counterRejected")
                : t("transfers.counterCountered")}
          </div>
        ) : null}
        {counterError ? (
          <div className="text-caption font-heading font-bold uppercase tracking-label mb-3 text-red-500">
            {counterError}
          </div>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled || counterLoading || counterResult === "accepted"}
            className="flex-1 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-control font-heading font-bold text-body uppercase tracking-label transition-colors disabled:opacity-50"
          >
            {counterLoading ? t("transfers.submitting") : t("transfers.submitCounter")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-hover text-fg-muted rounded-control font-heading font-bold text-body uppercase tracking-label hover:bg-gray-300 dark:hover:bg-navy-600 transition-colors"
          >
            {t("transfers.close")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
