import { useTranslation } from "react-i18next";

/** Ties an invalid field to the one error message the step shows. */
export const REQUIRED_ERROR_ID = "report-required-error";

export type ReportFieldKey = "whatHappened" | "expected" | "steps";

interface ReportFieldProps {
  fieldKey: ReportFieldKey;
  rows: number;
  required: boolean;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}

export function ReportField({
  fieldKey,
  rows,
  required,
  value,
  invalid,
  onChange,
}: ReportFieldProps) {
  const { t } = useTranslation();
  return (
    <div>
      <label
        htmlFor={`report-${fieldKey}`}
        className="block text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-1.5"
      >
        {t(`reportBug.${fieldKey}`)}
        {required && (
          <span className="ml-2 text-warning tracking-normal">{t("reportBug.required")}</span>
        )}
      </label>
      <textarea
        id={`report-${fieldKey}`}
        rows={rows}
        value={value}
        aria-required={required}
        aria-invalid={invalid}
        aria-describedby={invalid ? REQUIRED_ERROR_ID : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t(`reportBug.${fieldKey}Placeholder`)}
        className={`w-full px-3 py-2 rounded-control bg-sunken border text-body text-fg focus:outline-none focus:ring-2 focus:ring-selected/50 ${
          invalid ? "border-danger" : "border-line"
        }`}
      />
    </div>
  );
}
