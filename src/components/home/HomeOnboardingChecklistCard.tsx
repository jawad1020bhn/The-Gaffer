import { Check, Lightbulb } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardBody, CardHeader } from "../ui";

export interface HomeOnboardingStep {
  id: string;
  done: boolean;
  label: string;
  /** What fits under a stop in the stepper; `label` is the sentence used elsewhere. */
  shortLabel: string;
  description: string;
  tab: string;
  icon: React.ReactNode;
}

interface HomeOnboardingChecklistCardProps {
  completedSteps: number;
  totalSteps: number;
  steps: HomeOnboardingStep[];
  onNavigate?: (tab: string) => void;
  className?: string;
}

/**
 * The first week's errands, as a stepper: one row of stops joined by a line, each a button that
 * opens the screen that completes it. Done steps are lime with a tick; the next one is highlighted.
 */
export default function HomeOnboardingChecklistCard({
  completedSteps,
  totalSteps,
  steps,
  onNavigate,
  className = "",
}: HomeOnboardingChecklistCardProps) {
  const { t } = useTranslation();
  const nextStep = steps.find((step) => !step.done);

  return (
    <Card accent="accent" className={className}>
      <CardHeader
        action={
          <span className="shrink-0 font-heading text-caption font-bold tabular-nums text-fg-muted">
            {completedSteps}/{totalSteps}
          </span>
        }
      >
        <Lightbulb className="h-4 w-4 text-warning" aria-hidden="true" />
        {t("onboarding.title")}
      </CardHeader>
      <CardBody className="flex flex-col gap-2" padded={false}>
        <p className="shrink-0 px-3 pt-2 text-caption text-fg-muted">
          {t("onboarding.description")}
        </p>

        <ol className="flex shrink-0 items-start justify-between gap-1 px-3 pb-2">
          {steps.map((step, index) => {
            const isNext = nextStep?.id === step.id;
            return (
              <li key={step.id} className="flex min-w-0 flex-1 items-start gap-1">
                <button
                  type="button"
                  onClick={() => onNavigate?.(step.tab)}
                  title={`${step.label} — ${step.description}`}
                  className={`group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-control px-1 py-1 text-center transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${
                    isNext ? "bg-selected-tint" : "hover:bg-hover"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-caption ${
                      step.done
                        ? "bg-selected-fill text-on-brand"
                        : isNext
                          ? "bg-panel text-selected ring-2 ring-selected"
                          : "bg-sunken text-fg-subtle ring-1 ring-inset ring-line"
                    }`}
                  >
                    {step.done ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <span aria-hidden="true">{index + 1}</span>
                    )}
                  </span>
                  {/* Two lines, so "Hire coaching staff" reads as itself instead of "HIRE...". */}
                  <span
                    className={`line-clamp-2 w-full text-caption font-heading font-bold uppercase leading-tight tracking-label [@media(max-height:820px)]:tracking-normal ${
                      step.done ? "text-fg-subtle line-through" : "text-fg"
                    }`}
                  >
                    {step.shortLabel}
                  </span>
                </button>
                {index < steps.length - 1 ? (
                  <span
                    className={`mt-3.5 h-0.5 w-3 shrink-0 rounded-full ${
                      step.done ? "bg-selected" : "bg-line"
                    }`}
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            );
          })}
        </ol>

        {nextStep ? (
          <div className="flex items-center gap-2 rounded-control bg-sunken px-2.5 py-1.5">
            <span className="shrink-0 text-caption font-heading font-bold uppercase tracking-label text-fg-subtle">
              {t("onboarding.next")}
            </span>
            <span className="min-w-0 flex-1 truncate text-caption text-fg">{nextStep.label}</span>
            <button
              type="button"
              onClick={() => onNavigate?.(nextStep.tab)}
              className="shrink-0 rounded-control bg-selected px-2 py-1 font-heading text-caption font-bold uppercase tracking-label text-on-brand transition-colors hover:bg-selected/90 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            >
              {t("onboarding.go")}
            </button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
