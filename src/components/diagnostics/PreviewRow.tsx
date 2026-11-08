import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { LogFileSummary } from "../../services/reportService";
import { formatBytes } from "./ReportBugModal.helpers";

interface PreviewRowProps {
  icon: ReactNode;
  name: string;
  detail: string;
  size?: string;
  files?: LogFileSummary[];
}

export function PreviewRow({ icon, name, detail, size, files }: PreviewRowProps) {
  const { i18n } = useTranslation();
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-control bg-sunken border border-line">
      <span className="text-selected shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-fg">{name}</p>
        <p className="text-caption text-fg-muted mt-0.5">{detail}</p>
        {files && files.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {files.map((file) => (
              <li
                key={file.name}
                className="flex items-baseline justify-between gap-3 text-caption font-mono text-fg-muted"
              >
                <span className="truncate">{file.name}</span>
                <span className="shrink-0">{formatBytes(file.bytes, i18n.language)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {size && <span className="text-caption font-mono text-fg-muted shrink-0">{size}</span>}
    </div>
  );
}
