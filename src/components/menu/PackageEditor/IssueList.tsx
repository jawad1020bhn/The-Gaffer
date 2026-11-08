import { useTranslation } from "react-i18next";
import { AlertCircle, AlertTriangle } from "lucide-react";
import type { PackageIssue } from "./types";

/** Errors stop a package from loading; warnings leave it usable but may not do what the author meant. */
export function IssueList({
  issues,
  severity = "error",
}: {
  issues: PackageIssue[];
  severity?: "error" | "warning";
}) {
  const { t } = useTranslation();
  if (issues.length === 0) return null;
  const isWarning = severity === "warning";
  const Icon = isWarning ? AlertTriangle : AlertCircle;
  return (
    <div
      className={
        isWarning
          ? "rounded-panel border border-warning/40 bg-warning-tint p-3 text-caption"
          : "rounded-panel border border-danger/40 bg-danger-tint p-3 text-caption"
      }
    >
      <p
        className={
          isWarning
            ? "font-heading font-bold uppercase tracking-label text-warning mb-1 flex items-center gap-1"
            : "font-heading font-bold uppercase tracking-label text-danger mb-1 flex items-center gap-1"
        }
      >
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        {t(isWarning ? "worldEditor.warnings" : "worldEditor.issues", { count: issues.length })}
      </p>
      <ul
        className={
          isWarning
            ? "list-disc pl-4 space-y-0.5 text-warning"
            : "list-disc pl-4 space-y-0.5 text-danger"
        }
      >
        {issues.map((issue, i) => (
          <li key={i}>
            {issue.file ? `[${issue.file}] ` : ""}
            {t(issue.code, issue.params)}
          </li>
        ))}
      </ul>
    </div>
  );
}
