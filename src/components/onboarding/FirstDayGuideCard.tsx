import { useTranslation } from "react-i18next";
import { Check, ChevronRight, Compass, X } from "lucide-react";

import type { GameStateData } from "../../store/gameStore";
import { Button, Card, CardBody, CardHeader, ProgressBar } from "../ui";
import { firstDayProgress, guidanceHorizon, type CareerJournal } from "./careerJournal";

interface FirstDayGuideCardProps {
  gameState: GameStateData;
  journal: CareerJournal;
  onNavigate: (tab: string, context?: { messageId?: string }) => void;
  onDismiss: () => void;
}

/** The first-day essentials as a compact Hub card; optional exploration never gates play. */
export default function FirstDayGuideCard({
  gameState,
  journal,
  onNavigate,
  onDismiss,
}: FirstDayGuideCardProps) {
  const { t } = useTranslation();
  const progress = firstDayProgress(journal, gameState);
  const ready = progress.next === null;
  const horizon = guidanceHorizon(gameState);

  function openNext() {
    if (!progress.next) return;
    onNavigate(
      progress.next.tab,
      progress.next.id === "board" && journal.briefingMessageId
        ? { messageId: journal.briefingMessageId }
        : undefined,
    );
  }

  return (
    <Card accent="accent" className="lg:col-span-6 xl:col-span-4">
      <CardHeader
        action={
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("firstDay.dismiss")}
            className="rounded-control p-1 text-fg-subtle transition-colors hover:bg-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        }
      >
        <Compass className="h-4 w-4 text-selected" aria-hidden="true" />
        {ready ? t("firstDay.readyTitle") : t("firstDay.title")}
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {ready ? (
          <p className="text-body text-fg-muted">{t("firstDay.readyDescription")}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 text-caption text-fg-muted">
              <span>
                {t("firstDay.progress", { completed: progress.completed, total: progress.total })}
              </span>
              <span>{t("firstDay.optionalHint")}</span>
            </div>
            <ProgressBar
              value={(progress.completed / progress.total) * 100}
              variant="primary"
              label={t("firstDay.title")}
            />
            <ol className="grid grid-cols-2 gap-1">
              {progress.steps.map((step) => (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate(
                        step.tab,
                        step.id === "board" && journal.briefingMessageId
                          ? { messageId: journal.briefingMessageId }
                          : undefined,
                      )
                    }
                    className={`flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${step.done ? "text-fg-subtle" : "text-fg"}`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-control border ${step.done ? "border-selected bg-selected-fill text-on-brand" : "border-line-strong"}`}
                    >
                      {step.done ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                    </span>
                    <span className="truncate font-heading text-caption font-bold uppercase tracking-label">
                      {t(step.labelKey)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between gap-3 rounded-control bg-sunken px-3 py-2">
              <p className="min-w-0 truncate text-body text-fg">
                {progress.next ? t(progress.next.labelKey) : null}
              </p>
              <Button variant="primary" size="sm" iconRight={<ChevronRight />} onClick={openNext}>
                {t("firstDay.go")}
              </Button>
            </div>
          </>
        )}
        <p className="border-t border-line pt-2 text-caption text-fg-subtle">
          {t(`firstDay.horizons.${horizon}`)}
        </p>
      </CardBody>
    </Card>
  );
}
