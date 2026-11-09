import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, LogOut } from "lucide-react";

import { Button } from "../ui";
import { SETUP_BEATS, beatIndex, type CareerSetupStep } from "./careerSetupModel";
import SoundToggle from "./SoundToggle";

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page";

/** Honest measured setup time, not an estimate or a fake progress bar. */
function SetupTimer() {
  const { t } = useTranslation();
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [startedAt]);
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  return (
    <span
      role="timer"
      aria-label={t("careerSetup.elapsed")}
      className="rounded-control border border-line bg-sunken px-2 py-1 font-heading text-caption font-bold tabular-nums text-fg-muted"
    >
      {minutes}:{seconds}
    </span>
  );
}

interface CareerSetupLayoutProps {
  step: CareerSetupStep;
  furthestStep: CareerSetupStep;
  titleKey: string;
  subtitleKey: string;
  onBack?: () => void;
  onExit: () => void;
  onSelectStep: (step: CareerSetupStep) => void;
  primaryAction?: ReactNode;
  summary?: ReactNode;
  busy?: boolean;
  children: ReactNode;
}

/** A full-window career setup scene, not a centered web form. */
export default function CareerSetupLayout({
  step,
  furthestStep,
  titleKey,
  subtitleKey,
  onBack,
  onExit,
  onSelectStep,
  primaryAction,
  summary,
  busy = false,
  children,
}: CareerSetupLayoutProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const currentIndex = beatIndex(step);
  const furthestIndex = beatIndex(furthestStep);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-page text-fg">
      <img
        src="/assets/onboarding/stadium-night.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-page via-page/95 to-page/55" />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-b border-line bg-chrome/90 px-5 py-3">
        <div className="flex items-center gap-3">
          <img
            src="/openfootlogo.svg"
            alt={t("app.name")}
            className="h-8 w-40 object-contain object-left"
          />
          <span className="hidden font-heading text-caption font-bold uppercase tracking-label text-fg-subtle sm:inline">
            {t("careerSetup.newCareer")}
          </span>
          <SetupTimer />
        </div>
        <Button variant="ghost" size="sm" icon={<LogOut />} onClick={onExit} disabled={busy}>
          {t("careerSetup.exitSetup")}
        </Button>
      </header>

      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_19rem]">
        <nav
          aria-label={t("careerSetup.rail")}
          className="scrollbar-thin hidden min-h-0 overflow-y-auto border-r border-line bg-panel/80 p-4 lg:block"
        >
          <ol className="flex flex-col gap-1">
            {SETUP_BEATS.map((beat, index) => {
              const done = index < currentIndex;
              const current = beat.id === step;
              const reachable = index <= furthestIndex && index < beatIndex("club");
              return (
                <li key={beat.id}>
                  <button
                    type="button"
                    disabled={!reachable || busy}
                    aria-current={current ? "step" : undefined}
                    onClick={() => onSelectStep(beat.id)}
                    className={`flex w-full items-center gap-3 rounded-control px-3 py-3 text-left transition-colors duration-150 motion-reduce:transition-none disabled:cursor-default disabled:opacity-45 ${FOCUS_RING} ${current ? "bg-selected-tint text-selected" : "text-fg-muted hover:bg-hover hover:text-fg"}`}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-control border font-heading text-caption font-bold ${current || done ? "border-selected bg-selected-fill text-on-brand" : "border-line-strong"}`}
                    >
                      {done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                    </span>
                    <span className="font-heading text-body font-bold uppercase tracking-label">
                      {t(beat.labelKey)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <main
          aria-labelledby={titleId}
          className="scrollbar-thin min-h-0 overflow-y-auto px-5 py-6 sm:px-8"
        >
          <div className="mb-5 flex items-center gap-2 lg:hidden" aria-hidden="true">
            {SETUP_BEATS.slice(0, 5).map((beat, index) => (
              <span
                key={beat.id}
                className={`h-1 flex-1 rounded-full ${index <= currentIndex ? "bg-selected-fill" : "bg-line"}`}
              />
            ))}
          </div>
          <p className="font-heading text-caption font-bold uppercase tracking-label text-selected">
            {t("careerSetup.stepOf", { current: currentIndex + 1, total: SETUP_BEATS.length })}
          </p>
          <h1
            id={titleId}
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 font-heading text-display font-bold uppercase tracking-label text-fg focus:outline-none"
          >
            {t(titleKey)}
          </h1>
          <p className="mt-2 max-w-2xl text-lead text-fg-muted">{t(subtitleKey)}</p>
          <div className="mt-6 animate-beat-enter motion-reduce:animate-none">{children}</div>
        </main>

        {summary ? (
          <aside
            aria-label={t("careerSetup.passport")}
            className="scrollbar-thin hidden min-h-0 overflow-y-auto border-l border-line bg-panel/85 p-5 xl:block"
          >
            {summary}
          </aside>
        ) : null}
      </div>

      <footer className="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-chrome/95 px-5 py-3">
        <div className="flex items-center gap-2">
          {onBack ? (
            <Button
              variant="outline"
              size="md"
              icon={<ArrowLeft />}
              onClick={onBack}
              disabled={busy}
            >
              {t("common.back")}
            </Button>
          ) : null}
          <span className="hidden text-caption text-fg-subtle md:inline">
            {t("careerSetup.footerHint")}
          </span>
          <SoundToggle />
        </div>
        <div className="flex items-center gap-3">{primaryAction}</div>
      </footer>
    </div>
  );
}
