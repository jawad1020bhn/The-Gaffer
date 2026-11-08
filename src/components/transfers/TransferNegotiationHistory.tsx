import { useTranslation } from "react-i18next";

import type { TransferOfferData } from "../../store/gameStore";
import { formatExactMoney } from "../../lib/helpers";

interface TransferNegotiationHistoryProps {
  offer: TransferOfferData | null;
  mode: "outgoing" | "incoming";
}

export default function TransferNegotiationHistory({
  offer,
  mode,
}: TransferNegotiationHistoryProps) {
  const { t } = useTranslation();

  if (!offer) {
    return null;
  }

  const managerLabel =
    mode === "outgoing" ? t("transfers.lastBidLabel") : t("transfers.lastCounterLabel");
  const clubLabel =
    mode === "outgoing" ? t("transfers.lastClubSignalLabel") : t("transfers.currentOfferLabel");
  const managerFee = offer.last_manager_fee;
  const clubFee = offer.suggested_counter_fee ?? offer.fee;

  return (
    <div className="rounded-control border border-line bg-white/70 dark:bg-navy-900/40 p-3 mb-3 space-y-2">
      <p className="text-[11px] font-heading font-bold uppercase tracking-label text-fg-muted">
        {t("transfers.negotiationHistory")}
      </p>
      {managerFee !== null && managerFee !== undefined ? (
        <div className="flex items-center justify-between gap-3 text-caption text-fg-muted">
          <span>{managerLabel}</span>
          <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {formatExactMoney(managerFee)}
          </span>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 text-caption text-fg-muted">
        <span>{clubLabel}</span>
        <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
          {formatExactMoney(clubFee)}
        </span>
      </div>
    </div>
  );
}
