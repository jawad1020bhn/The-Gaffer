import { type JSX, useId } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Dialog } from "../ui";

export default function DashboardExitSavingModal(): JSX.Element {
  const { t } = useTranslation();
  const titleId = useId();

  // The save is in flight and can't be cancelled: no onClose, so Escape asks for nothing.
  return (
    <Dialog labelledBy={titleId} busy className="w-full max-w-sm rounded-panel p-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full text-selected bg-selected-tint/15">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <h3
          id={titleId}
          className="mt-4 text-heading font-heading font-bold uppercase tracking-label text-fg"
        >
          {t("exitConfirm.savingTitle")}
        </h3>
        <p className="mt-2 text-body text-fg-muted">{t("exitConfirm.savingMessage")}</p>
      </div>
    </Dialog>
  );
}
