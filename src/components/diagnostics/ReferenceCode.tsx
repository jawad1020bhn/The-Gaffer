import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";

import { logError } from "../../lib/logger";

interface ReferenceCodeProps {
  code: string;
  /** `lg` where the code is the point of the screen; `md` in a list. */
  size?: "md" | "lg";
}

/** A `<code>` cannot take focus, so the button is the only way a keyboard or screen-reader user can copy it. */
export function ReferenceCode({ code, size = "md" }: ReferenceCodeProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch (error: unknown) {
      logError(`[report] could not copy the reference code: ${String(error)}`);
      setCopied(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <code
        className={`select-all font-mono tracking-labelst text-fg ${
          size === "lg" ? "text-title" : "text-body"
        }`}
      >
        {code}
      </code>
      <button
        type="button"
        onClick={() => {
          void copy();
        }}
        aria-label={t("reportBug.copyCodeFor", { code })}
        title={t("reportBug.copyCodeFor", { code })}
        className="p-1 rounded-md text-fg-muted hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
      >
        <Copy className="w-4 h-4" aria-hidden="true" />
      </button>
      {/* Always rendered, so the announcement is a change to a live region that already exists. */}
      <span role="status" className="text-caption text-selected">
        {copied ? t("reportBug.codeCopied") : ""}
      </span>
    </span>
  );
}
