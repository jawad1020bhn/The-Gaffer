import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { UploadReceipt } from "../../services/reportService";
import { ReferenceCode } from "./ReferenceCode";

export function ReportSentStep({ receipt }: { receipt: UploadReceipt }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-heading font-bold uppercase tracking-label text-fg-muted">
        {t("reportBug.referenceCode")}
      </p>
      <div className="px-3 py-2 rounded-control bg-gray-50 dark:bg-navy-700 border border-line">
        <ReferenceCode code={receipt.code} size="lg" />
      </div>
      <p className="text-caption text-fg-muted">{t("reportBug.referenceCodeHint")}</p>
      {receipt.recorded ? (
        <p className="text-caption text-fg-muted">{t("reportBug.referenceCodeSaved")}</p>
      ) : (
        <p
          role="alert"
          className="flex items-start gap-1.5 text-caption text-accent-700 dark:text-accent-400"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t("reportBug.notRecorded")}
        </p>
      )}
    </div>
  );
}
