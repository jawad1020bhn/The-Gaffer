import { useTranslation } from "react-i18next";
import { ClipboardCheck } from "lucide-react";

import { Button } from "../ui";
import type { FirstDayMilestone } from "./careerJournal";

interface FirstDayTaskBannerProps {
  task: FirstDayMilestone;
  onAcknowledge: (task: FirstDayMilestone) => void;
}

/** One contextual first-day task above the real screen; completion is explicit, never a tab visit. */
export default function FirstDayTaskBanner({ task, onAcknowledge }: FirstDayTaskBannerProps) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t(`firstDay.tasks.${task}.label`)}
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-selected/40 bg-selected-tint px-4 py-3"
    >
      <div className="flex min-w-0 items-start gap-3">
        <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-selected" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-heading text-body font-bold uppercase tracking-label text-selected">
            {t(`firstDay.tasks.${task}.label`)}
          </p>
          <p className="mt-0.5 text-body text-fg-muted">
            {t(`firstDay.tasks.${task}.description`)}
          </p>
        </div>
      </div>
      <Button variant="primary" size="sm" onClick={() => onAcknowledge(task)}>
        {t(`firstDay.tasks.${task}.confirm`)}
      </Button>
    </section>
  );
}
