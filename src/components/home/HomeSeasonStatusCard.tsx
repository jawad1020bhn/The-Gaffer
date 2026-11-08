import { CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatDateShort } from "../../lib/helpers";
import { Badge, Card, CardBody, CardHeader } from "../ui";

interface HomeSeasonStatusCardProps {
  phase: string;
  seasonStartLabel: string | null;
  daysUntilSeasonStart: number | null;
  transferWindowStatus: string;
  transferWindowVariant: "danger" | "success" | "neutral";
  transferWindowSummary: string;
  transferWindowOpensOn: string | null;
  transferWindowClosesOn: string | null;
  lang: string;
}

export default function HomeSeasonStatusCard({
  phase,
  seasonStartLabel,
  daysUntilSeasonStart,
  transferWindowStatus,
  transferWindowVariant,
  transferWindowSummary,
  transferWindowOpensOn,
  transferWindowClosesOn,
  lang,
}: HomeSeasonStatusCardProps) {
  const { t } = useTranslation();

  return (
    <Card accent="primary">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary-500" />
          {t("season.preseasonStatus")}
        </div>
      </CardHeader>
      {/* Laid out by the card's own width: a window breakpoint and a minimum width put the tiles
          past the window's edge in a narrow workspace (960 at extra-large text). */}
      <CardBody className="@container">
        <div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-center @3xl:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent" size="sm">
                {t(`season.phases.${phase}`)}
              </Badge>
              <Badge variant={transferWindowVariant} size="sm">
                {t(`season.transferWindowStatus.${transferWindowStatus}`)}
              </Badge>
            </div>
            <p className="text-body text-fg">{t("season.preseasonFocus")}</p>
          </div>
          <div data-season-tiles className="grid grid-cols-1 gap-3 @md:grid-cols-2">
            <div className="rounded-panel bg-gray-50 px-4 py-3 dark:bg-navy-700/50">
              <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-subtle">
                {t("season.opener")}
              </p>
              <p className="mt-1 text-body font-heading font-bold text-fg">
                {seasonStartLabel
                  ? t("season.startsOn", { date: seasonStartLabel })
                  : t("season.noOpener")}
              </p>
              {daysUntilSeasonStart !== null && (
                <p className="mt-1 text-caption text-primary-500 dark:text-primary-400">
                  {t("season.startsInDays", {
                    count: daysUntilSeasonStart,
                  })}
                </p>
              )}
            </div>
            <div className="rounded-panel bg-gray-50 px-4 py-3 dark:bg-navy-700/50">
              <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-subtle">
                {t("transfers.centre")}
              </p>
              <p className="mt-1 text-body font-heading font-bold text-fg">
                {transferWindowSummary}
              </p>
              {(transferWindowOpensOn || transferWindowClosesOn) && (
                <p className="mt-1 text-caption text-fg-muted">
                  {transferWindowStatus === "Closed" && transferWindowOpensOn
                    ? t("season.windowOpensOn", {
                        date: formatDateShort(transferWindowOpensOn, lang),
                      })
                    : transferWindowClosesOn
                      ? t("season.windowClosesOn", {
                          date: formatDateShort(transferWindowClosesOn, lang),
                        })
                      : transferWindowSummary}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
