import { type JSX, useId } from "react";
import { useTranslation } from "react-i18next";

import { Dialog } from "../ui";

interface DashboardCloseConfirmModalProps {
  onCancel: () => void;
  onQuitWithoutSave: () => void;
  onSaveAndQuit: () => void;
}

export default function DashboardCloseConfirmModal({
  onCancel,
  onQuitWithoutSave,
  onSaveAndQuit,
}: DashboardCloseConfirmModalProps): JSX.Element {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <Dialog labelledBy={titleId} onClose={onCancel} className="w-full max-w-sm rounded-panel p-6">
      <h3
        id={titleId}
        className="text-heading font-heading font-bold uppercase tracking-label text-fg"
      >
        {t("closeConfirm.title")}
      </h3>
      <p className="mt-2 text-body text-fg-muted">{t("closeConfirm.message")}</p>
      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={onSaveAndQuit}
          className="w-full rounded-control bg-selected-fill px-4 py-2.5 text-body font-heading font-bold uppercase tracking-label text-on-brand transition-colors hover:bg-selected-fill"
        >
          {t("closeConfirm.saveQuit")}
        </button>
        <button
          type="button"
          onClick={onQuitWithoutSave}
          className="w-full rounded-control bg-danger-tint px-4 py-2.5 text-body font-heading font-bold uppercase tracking-label text-danger transition-colors hover:bg-danger-tint"
        >
          {t("closeConfirm.quitNoSave")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-control bg-hover px-4 py-2.5 text-body font-heading font-bold uppercase tracking-label text-fg transition-colors hover:bg-hover"
        >
          {t("common.cancel")}
        </button>
      </div>
    </Dialog>
  );
}
