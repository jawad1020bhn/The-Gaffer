import { AlertTriangle, FileText, Package } from "lucide-react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";

import type { DiagnosticsReport, UploadFailureKind } from "../../services/reportService";
import { CheckboxRow } from "./CheckboxRow";
import { PreviewRow } from "./PreviewRow";
import { formatAppVersion } from "../../lib/appVersion";
import { describeMachine, formatBytes } from "./ReportBugModal.helpers";

interface ReportPreviewStepProps {
  diagnostics: DiagnosticsReport | null;
  careerLine: string;
  logBytes: number | null;
  canAttachSave: boolean;
  includeSave: boolean;
  onIncludeSaveChange: (checked: boolean) => void;
  busy: boolean;
  canUpload: boolean;
  consent: boolean;
  canConsent: boolean;
  onConsentChange: (checked: boolean) => void;
  failure: string | null;
  failureKind: UploadFailureKind | null;
  failureDetail: string | null;
}

export function ReportPreviewStep({
  diagnostics,
  careerLine,
  logBytes,
  canAttachSave,
  includeSave,
  onIncludeSaveChange,
  busy,
  canUpload,
  consent,
  canConsent,
  onConsentChange,
  failure,
  failureKind,
  failureDetail,
}: ReportPreviewStepProps) {
  const { t, i18n } = useTranslation();
  const saveSize =
    canAttachSave && diagnostics !== null && diagnostics.save_bytes !== null ? (
      <span className="text-caption font-mono text-fg-muted shrink-0">
        {formatBytes(diagnostics.save_bytes, i18n.language)}
      </span>
    ) : undefined;

  return (
    <div className="flex flex-col gap-2">
      <PreviewRow
        icon={<FileText className="w-4 h-4" />}
        name={t("reportBug.itemWhatYouWrote")}
        detail={t("reportBug.itemWhatYouWroteDesc")}
      />
      <PreviewRow
        icon={<Package className="w-4 h-4" />}
        name={t("reportBug.itemSetup")}
        detail={[formatAppVersion(), describeMachine(diagnostics), careerLine]
          .filter((part) => part !== "")
          .join(" · ")}
      />
      <PreviewRow
        icon={<FileText className="w-4 h-4" />}
        name={t("reportBug.itemLogs")}
        detail={t("reportBug.itemLogsDesc")}
        size={logBytes === null ? undefined : formatBytes(logBytes, i18n.language)}
        files={diagnostics?.log_files}
      />
      {diagnostics?.crash_on_previous_run && (
        <PreviewRow
          icon={<AlertTriangle className="w-4 h-4" />}
          name={t("reportBug.itemCrash")}
          detail={t("reportBug.itemCrashDesc")}
        />
      )}

      <div className="h-px bg-hover my-1.5" />
      <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
        {t("reportBug.optionalHeading")}
      </p>
      <CheckboxRow
        id="report-include-save"
        checked={canAttachSave && includeSave}
        disabled={!canAttachSave || busy}
        label={t("reportBug.includeSave")}
        description={
          canAttachSave ? t("reportBug.includeSaveDesc") : t("reportBug.includeSaveNoCareer")
        }
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onIncludeSaveChange(event.target.checked)
        }
        trailing={saveSize}
      />

      {canUpload && (
        <>
          <div className="h-px bg-hover my-1.5" />
          <CheckboxRow
            id="report-consent"
            checked={consent}
            disabled={!canConsent}
            label={t("reportBug.consentLabel")}
            description={t("reportBug.consentDesc")}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onConsentChange(event.target.checked)
            }
          />
        </>
      )}

      <p className="text-caption text-fg-muted mt-2">
        {canUpload ? t("reportBug.nothingSentYetUpload") : t("reportBug.nothingSentYet")}
      </p>
      {failure && (
        <div role="alert" className="flex flex-col gap-1 text-caption text-danger">
          <p>{failure}</p>
          {failureKind === "tooLarge" && canAttachSave && includeSave && (
            <p>{t("reportBug.tooLargeUntickSave")}</p>
          )}
          {failureKind !== null && <p>{t("reportBug.uploadFailedFallback")}</p>}
          {failureDetail !== null && (
            <details className="text-caption text-fg-muted">
              <summary className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel">
                {t("reportBug.technicalDetails")}
              </summary>
              <p className="mt-1 font-mono break-words select-text">{failureDetail}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
