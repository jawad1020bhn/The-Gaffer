import { type JSX, useId } from "react";
import { useTranslation } from "react-i18next";

import { Dialog } from "../ui";

interface DashboardExitConfirmModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DashboardExitConfirmModal({
  onCancel,
  onConfirm,
}: DashboardExitConfirmModalProps): JSX.Element {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <Dialog labelledBy={titleId} onClose={onCancel} className="w-full max-w-sm rounded-panel p-6">
      <h3
        id={titleId}
        className="text-heading font-heading font-bold uppercase tracking-label text-fg"
      >
        {t("exitConfirm.title")}
      </h3>
      <p className="mt-2 text-body text-fg-muted">{t("exitConfirm.message")}</p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-control bg-hover px-4 py-2.5 text-body font-heading font-bold uppercase tracking-label text-fg transition-colors hover:bg-hover"
        >
          {t("exitConfirm.cancel")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-control bg-danger-tint px-4 py-2.5 text-body font-heading font-bold uppercase tracking-label text-danger transition-colors hover:bg-danger-tint"
        >
          {t("exitConfirm.saveExit")}
        </button>
      </div>
    </Dialog>
  );
}
