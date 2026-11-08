import { useTranslation } from "react-i18next";

import type { BundleSummary } from "../../services/reportService";
import { describeBundle } from "./ReportBugModal.helpers";

interface ReportDoneStepProps {
  summary: BundleSummary;
  browserFailed: boolean;
}

export function ReportDoneStep({ summary, browserFailed }: ReportDoneStepProps) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-fg">{t("reportBug.savedTo")}</p>
      <code className="block px-3 py-2 rounded-control bg-gray-50 dark:bg-navy-700 border border-line text-[11px] font-mono text-fg break-all">
        {describeBundle(summary, i18n.language)}
      </code>
      {/* What is actually in the file: the screen asked the player to decide about the save, and
          not saying afterwards whether it went in leaves that question unanswered. */}
      <p className="text-[11px] text-fg-muted">
        {[
          t("reportBug.itemLogs"),
          summary.included_save ? t("reportBug.includeSave") : null,
          summary.included_crash ? t("reportBug.itemCrash") : null,
        ]
          .filter((part): part is string => part !== null)
          .join(" · ")}
      </p>
      <p className="text-caption text-fg-muted">
        {browserFailed ? t("reportBug.browserDidNotOpen") : t("reportBug.dragItIn")}
      </p>
    </div>
  );
}
