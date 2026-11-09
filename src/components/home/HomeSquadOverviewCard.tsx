import { AlertTriangle, Dumbbell } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { RatedTone } from "../../store/types";
import { Card, CardBody, CardFooter, CardHeader, ProgressBar } from "../ui";

interface HomeSquadOverviewCardProps {
  /** A summary line pinned under the body — player momentum lives here, not in a crushed band. */
  footer?: React.ReactNode;
  /** Null until the backend answers, and when no healthy first-team player can be averaged. */
  avgCondition: number | null;
  /** The backend's tone for the average; null leaves its bar neutral. */
  avgConditionTone: RatedTone | null;
  avgOvr: number;
  exhaustedCount: number;
  scheduleIcon: React.ReactNode;
  scheduleColorClass: string;
  scheduleLabel: string;
  focus: string;
  onNavigate?: (tab: string) => void;
  className?: string;
}

export default function HomeSquadOverviewCard({
  avgCondition,
  avgConditionTone,
  avgOvr,
  exhaustedCount,
  scheduleIcon,
  scheduleColorClass,
  scheduleLabel,
  focus,
  onNavigate,
  className = "",
  footer,
}: HomeSquadOverviewCardProps) {
  const { t } = useTranslation();

  return (
    <Card className={className}>
      <CardHeader
        action={
          <button
            type="button"
            onClick={() => onNavigate?.("Training")}
            className="text-selected text-caption font-heading font-bold uppercase tracking-label hover:text-selected transition-colors"
          >
            {t("dashboard.training")}
          </button>
        }
      >
        {t("home.squadOverview")}
      </CardHeader>
      <CardBody>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-caption text-fg-muted">{t("home.avgCondition")}</span>
            <span className="font-heading font-bold text-body text-fg">
              {avgCondition !== null ? `${avgCondition}%` : "—"}
            </span>
          </div>
          <ProgressBar
            value={avgCondition ?? 0}
            variant={avgConditionTone ? undefined : "muted"}
            tone={avgConditionTone ?? undefined}
            size="md"
            // No average, no progress bar: "0%" would be read out for a number that doesn't exist.
            label={avgCondition !== null ? t("home.avgCondition") : undefined}
          />

          <div className="flex items-center justify-between mt-1">
            <span className="text-caption text-fg-muted">{t("home.avgOvr")}</span>
            <span className="font-heading font-bold text-body text-fg">{avgOvr}</span>
          </div>

          {exhaustedCount > 0 && (
            <div className="flex items-center gap-1.5 mt-1 text-warning">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="text-caption font-heading">
                {t("home.exhaustedPlayers", { count: exhaustedCount })}
              </span>
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-line flex items-center gap-2">
            <Dumbbell className="w-3.5 h-3.5 text-fg-subtle" />
            <span className="text-caption text-fg-muted">{t("home.scheduleLabel")}</span>
            <span
              className={`text-caption font-heading font-bold flex items-center gap-1 ${scheduleColorClass}`}
            >
              {scheduleIcon} {scheduleLabel}
            </span>
            <span className="text-caption text-fg-subtle ml-auto">
              {t(`common.trainingFocuses.${focus}`, focus)}
            </span>
          </div>
        </div>
      </CardBody>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
