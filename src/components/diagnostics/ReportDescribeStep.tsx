import { useTranslation } from "react-i18next";

import type { Frequency, ReportDraft } from "./ReportBugModal.helpers";
import { REQUIRED_ERROR_ID, ReportField, type ReportFieldKey } from "./ReportField";

const FREQUENCIES: Frequency[] = ["everyTime", "sometimes", "once"];

interface ReportDescribeStepProps {
  draft: ReportDraft;
  onDraftChange: (change: Partial<ReportDraft>) => void;
  showErrors: boolean;
  missing: Array<keyof ReportDraft>;
}

export function ReportDescribeStep({
  draft,
  onDraftChange,
  showErrors,
  missing,
}: ReportDescribeStepProps) {
  const { t } = useTranslation();
  const field = (fieldKey: ReportFieldKey, rows: number, required: boolean) => (
    <ReportField
      fieldKey={fieldKey}
      rows={rows}
      required={required}
      value={draft[fieldKey]}
      invalid={required && showErrors && missing.includes(fieldKey)}
      onChange={(value) => onDraftChange({ [fieldKey]: value })}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {field("whatHappened", 3, true)}
      {field("expected", 2, true)}
      {field("steps", 3, false)}
      <fieldset className="border-0 p-0 m-0 min-w-0">
        <legend className="block text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-1.5">
          {t("reportBug.frequencyLabel")}
        </legend>
        <div className="flex rounded-control bg-hover p-0.5 border border-line">
          {FREQUENCIES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={draft.frequency === value}
              onClick={() => onDraftChange({ frequency: value })}
              className={`flex-1 px-3 py-1.5 rounded-md text-caption font-heading font-bold uppercase tracking-label transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${
                draft.frequency === value ? "bg-panel text-selected shadow-sm" : "text-fg-muted"
              }`}
            >
              {t(`reportBug.frequency.${value}`)}
            </button>
          ))}
        </div>
      </fieldset>
      {showErrors && missing.length > 0 && (
        <p id={REQUIRED_ERROR_ID} role="alert" className="text-caption text-danger">
          {t("reportBug.fillRequired")}
        </p>
      )}
    </div>
  );
}
