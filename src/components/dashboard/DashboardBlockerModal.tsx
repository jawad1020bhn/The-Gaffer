import { AlertCircle } from "lucide-react";
import { type JSX, useId } from "react";
import { useTranslation } from "react-i18next";

import type { BlockerModal } from "../../hooks/useAdvanceTime.helpers";
import type { BlockerData } from "../../services/advanceTimeService";
import { resolveBackendText } from "../../utils/backendI18n";
import { getBlockerTabLabel } from "../../utils/blockerUtils";
import { Dialog } from "../ui";

interface DashboardBlockerModalProps {
  blockerModal: BlockerModal;
  onClose: () => void;
  onContinueAnyway: (() => void) | null;
  onNavigate: (tab: string) => void;
}

function getBlockerButtonClassName(severity: string): string {
  const baseClassName = "w-full rounded-panel border p-3 text-left transition-all hover:shadow-sm";

  if (severity === "warn") {
    return `${baseClassName} border-warning/40 bg-warning-tint hover:bg-warning-tint`;
  }

  return `${baseClassName} border-info/40 bg-info-tint hover:bg-info-tint`;
}

function getBlockerTextClassName(severity: string): string {
  if (severity === "warn") {
    return "text-body font-medium text-warning";
  }

  return "text-body font-medium text-info";
}

function getBlockerText(blocker: BlockerData): string {
  return resolveBackendText(blocker.text_key, blocker.text, blocker.text_params);
}

export default function DashboardBlockerModal({
  blockerModal,
  onClose,
  onContinueAnyway,
  onNavigate,
}: DashboardBlockerModalProps): JSX.Element {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <Dialog labelledBy={titleId} onClose={onClose} className="w-full max-w-md rounded-panel p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-panel bg-warning-tint">
          <AlertCircle className="h-5 w-5 text-warning" />
        </div>
        <div>
          <h3
            id={titleId}
            className="text-heading font-heading font-bold uppercase tracking-label text-fg"
          >
            {t("notifications.attentionRequired")}
          </h3>
          <p className="text-caption text-fg-muted">{t("notifications.resolveBeforeContinuing")}</p>
        </div>
      </div>
      <div className="mb-5 flex flex-col gap-2">
        {blockerModal.blockers.map((blocker) => (
          <button
            type="button"
            key={blocker.id}
            onClick={() => onNavigate(blocker.tab)}
            className={getBlockerButtonClassName(blocker.severity)}
          >
            <p className={getBlockerTextClassName(blocker.severity)}>{getBlockerText(blocker)}</p>
            <p className="mt-1 text-caption font-heading uppercase tracking-label text-fg-subtle">
              {t("notifications.goTo")} {getBlockerTabLabel(t, blocker.tab)} →
            </p>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-control bg-hover px-4 py-2.5 text-body font-heading font-bold uppercase tracking-label text-fg transition-colors hover:bg-hover"
        >
          {t("notifications.reviewIssues")}
        </button>
        {onContinueAnyway && (
          <button
            type="button"
            onClick={onContinueAnyway}
            className="flex-1 rounded-control bg-warning-tint px-4 py-2.5 text-body font-heading font-bold uppercase tracking-label text-warning transition-colors hover:bg-warning-tint"
          >
            {t("notifications.continueAnyway")}
          </button>
        )}
      </div>
    </Dialog>
  );
}
