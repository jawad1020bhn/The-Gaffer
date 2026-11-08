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
  className?: string;
}

interface TimelineStop {
  id: string;
  label: string;
  detail: string | null;
  reached: boolean;
}

/** Three stops on one bar, instead of two boxes of prose: today, the window, the opener. */
function Timeline({ stops }: { stops: TimelineStop[] }) {
  return (
    <ol className="flex items-start gap-1">
      {stops.map((stop, index) => (
        <li key={stop.id} className="flex min-w-0 flex-1 items-start gap-1">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  stop.reached ? "bg-selected" : "bg-line ring-1 ring-inset ring-line-strong"
                }`}
              />
              {/* Two lines rather than an ellipsis: "WINDOW CLOSED" is a label, "WIND…" is a bug. */}
              <span className="line-clamp-2 text-caption font-heading font-bold uppercase leading-tight tracking-label text-fg">
                {stop.label}
              </span>
            </span>
            {stop.detail ? (
              <span className="truncate pl-4 text-caption text-fg-subtle">{stop.detail}</span>
            ) : null}
          </div>
          {index < stops.length - 1 ? (
            <span className="mt-1.5 h-0.5 min-w-4 flex-1 rounded-full bg-line" />
          ) : null}
        </li>
      ))}
    </ol>
  );
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
  className = "",
}: HomeSeasonStatusCardProps) {
  const { t } = useTranslation();

  const stops: TimelineStop[] = [
    { id: "today", label: t("season.today"), detail: null, reached: true },
    {
      id: "window",
      label: t(`season.transferWindowStatus.${transferWindowStatus}`),
      detail:
        transferWindowStatus === "Closed"
          ? null
          : transferWindowOpensOn
            ? formatDateShort(transferWindowOpensOn, lang)
            : transferWindowClosesOn
              ? formatDateShort(transferWindowClosesOn, lang)
              : null,
      reached: transferWindowStatus !== "Closed",
    },
    {
      id: "kickoff",
      label: t("season.opener"),
      detail: seasonStartLabel,
      reached: daysUntilSeasonStart !== null && daysUntilSeasonStart <= 0,
    },
  ];

  return (
    <Card accent="primary" className={className}>
      <CardHeader>
        <CalendarClock className="h-4 w-4 text-selected" aria-hidden="true" />
        {t("season.preseasonStatus")}
      </CardHeader>
      {/* Laid out by the card's own width: a window breakpoint and a minimum width put the tiles
          past the window's edge in a narrow workspace (960 at extra-large text). */}
      <CardBody className="@container flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="accent" size="sm">
            {t(`season.phases.${phase}`)}
          </Badge>
          <Badge variant={transferWindowVariant} size="sm">
            {t(`season.transferWindowStatus.${transferWindowStatus}`)}
          </Badge>
          <p
            className="min-w-0 flex-1 truncate text-caption text-fg-subtle"
            title={t("season.preseasonFocus")}
          >
            {t("season.preseasonFocus")}
          </p>
        </div>

        <Timeline stops={stops} />

        <div data-season-tiles className="grid grid-cols-1 gap-2 @md:grid-cols-2">
          <div className="rounded-control bg-sunken px-3 py-2">
            <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-subtle">
              {t("season.opener")}
            </p>
            <p className="truncate font-heading text-body font-bold text-fg">
              {seasonStartLabel
                ? t("season.startsOn", { date: seasonStartLabel })
                : t("season.noOpener")}
            </p>
            {daysUntilSeasonStart !== null && (
              <p className="mt-0.5 text-caption text-selected">
                {t("season.startsInDays", { count: daysUntilSeasonStart })}
              </p>
            )}
          </div>
          <div className="rounded-control bg-sunken px-3 py-2">
            <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-subtle">
              {t("transfers.centre")}
            </p>
            <p className="truncate font-heading text-body font-bold text-fg">
              {transferWindowSummary}
            </p>
            {transferWindowStatus === "Closed" && transferWindowOpensOn ? (
              <p className="mt-0.5 truncate text-caption text-fg-muted">
                {t("season.windowOpensOn", { date: formatDateShort(transferWindowOpensOn, lang) })}
              </p>
            ) : transferWindowClosesOn ? (
              <p className="mt-0.5 truncate text-caption text-fg-muted">
                {t("season.windowClosesOn", {
                  date: formatDateShort(transferWindowClosesOn, lang),
                })}
              </p>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
