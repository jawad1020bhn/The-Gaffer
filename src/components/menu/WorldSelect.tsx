import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui";
import { X, ChevronRight, Globe, Users, ArrowLeft, Loader2, Trophy, Package } from "lucide-react";
import type { CareerStartPhase } from "./CreateManagerForm";

// ---------------------------------------------------------------------------
// Shared types — imported by MainMenu and PackageBuildStep
// ---------------------------------------------------------------------------

export interface PackageIssue {
  code: string;
  file: string;
  params: Record<string, string>;
}

export interface StackConflictInfo {
  severity: "warning" | "error";
  code: string;
  entityKind: string;
  entityId: string;
  packages: string[];
}

export interface PackageInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  license: string;
  gameMinVersion: string;
  packageType: string;
  teamCount: number;
  playerCount: number;
  competitionCount: number;
  namePoolCount: number;
  countryCount: number;
  confederationCount: number;
  installedPath: string;
  logoDataUrl?: string;
  /** Shipped with the build rather than installed by the player. */
  bundled?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HISTORY_DEPTH_OPTIONS = [0, 6, 12, 24] as const;

function historyDepthOptionLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  value: (typeof HISTORY_DEPTH_OPTIONS)[number],
): string {
  if (value === 0) return t("worldSelect.historyDepth.none");
  return t("worldSelect.historyDepth.option", { count: value });
}

// ---------------------------------------------------------------------------
// Step indicator (shared with PackageBuildStep)
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: 2 | 3 }) {
  const active =
    "flex items-center justify-center w-6 h-6 rounded-full bg-selected-fill text-on-brand text-caption font-bold";
  const done =
    "flex items-center justify-center w-6 h-6 rounded-full bg-selected-tint text-selected text-caption font-bold";
  const future =
    "flex items-center justify-center w-6 h-6 rounded-full bg-hover text-fg-subtle text-caption font-bold";
  const filledLine = "h-0.5 flex-1 bg-selected-fill";
  const emptyLine = "h-0.5 flex-1 bg-hover";

  return (
    <div className="flex items-center gap-2 mb-1">
      <div className={done}>1</div>
      <div className={filledLine} />
      <div className={current === 2 ? active : done}>2</div>
      <div className={current === 3 ? filledLine : emptyLine} />
      <div className={current === 3 ? active : future}>3</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GenerationStepProps {
  isStarting: boolean;
  startYear: number;
  startPhase: CareerStartPhase;
  historyDepthYears: number;
  onChangeHistoryDepthYears: (value: number) => void;
  onStart: () => void;
  onBack: () => void;
  onClose: () => void;
  /** Pre-filtered active packages from MainMenu state. */
  activePackages: PackageInfo[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GenerationStep({
  isStarting,
  startYear,
  startPhase,
  historyDepthYears,
  onChangeHistoryDepthYears,
  onStart,
  onBack,
  onClose,
  activePackages,
}: GenerationStepProps) {
  const { t } = useTranslation();
  const historyDepthLabelId = useId();

  const hasActiveDatabases = activePackages.some((p) => p.packageType === "database");

  // Coverage totals across active database packages
  const dbPackages = activePackages.filter((p) => p.packageType === "database");
  const totalTeams = dbPackages.reduce((s, p) => s + p.teamCount, 0);
  const totalPlayers = dbPackages.reduce((s, p) => s + p.playerCount, 0);
  const totalCompetitions = dbPackages.reduce((s, p) => s + p.competitionCount, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="text-fg-subtle hover:text-fg transition-colors p-1 rounded-control hover:bg-hover"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-heading font-heading font-bold uppercase tracking-label text-fg">
            {t("generation.title")}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-fg-subtle hover:text-fg transition-colors p-1 rounded-control hover:bg-hover"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <StepIndicator current={3} />

      {/* Summary card */}
      <div className="rounded-panel border border-line bg-sunken p-3 text-body text-fg-muted">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-heading font-bold uppercase tracking-[0.18em] text-fg-muted">
            {t("worldSelect.summary.startYear")}
          </span>
          <span className="font-heading font-bold uppercase tracking-label text-fg">
            {startYear}
          </span>
          <span className="rounded-full bg-selected-tint px-2 py-0.5 text-caption font-heading font-bold uppercase tracking-[0.18em] text-selected">
            {hasActiveDatabases
              ? t("worldSelect.historyMode.reference")
              : t("worldSelect.historyMode.generated")}
          </span>
        </div>
        <p className="mt-2 text-caption uppercase tracking-[0.18em] text-fg-muted">
          {hasActiveDatabases
            ? t(`worldSelect.summary.${startPhase}.reference`, {
                year: startYear,
                count: historyDepthYears,
              })
            : t(`worldSelect.summary.${startPhase}.generated`, {
                year: startYear,
                count: historyDepthYears,
              })}
        </p>
      </div>

      {/* Database packages — coverage summary */}
      {hasActiveDatabases && (
        <div className="rounded-panel border border-line bg-panel p-3 text-body">
          <p className="font-heading font-bold uppercase tracking-[0.18em] text-fg-muted mb-2">
            {t("generation.coverage")}
          </p>
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="text-caption font-heading uppercase tracking-label text-fg-muted flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {t("worldSelect.teams", { count: totalTeams })}
            </span>
            <span className="text-caption font-heading uppercase tracking-label text-fg-muted flex items-center gap-1">
              <Users className="w-3 h-3" />
              {t("worldSelect.players", { count: totalPlayers })}
            </span>
            <span className="text-caption font-heading uppercase tracking-label text-fg-muted flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              {t("worldSelect.competitions", { count: totalCompetitions })}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {dbPackages.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 text-caption font-heading uppercase tracking-label rounded-full bg-selected-tint px-2 py-0.5 text-selected"
              >
                <Package className="w-2.5 h-2.5" />
                {p.name || p.id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* History depth — only for random world */}
      {!hasActiveDatabases && (
        <div className="rounded-panel border border-line bg-panel p-3 text-body">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                id={historyDepthLabelId}
                className="font-heading font-bold uppercase tracking-[0.18em] text-fg-muted"
              >
                {t("worldSelect.historyDepth.label")}
              </p>
              <p className="mt-1 text-caption text-fg-muted">
                {t("worldSelect.historyDepth.hint")}
              </p>
            </div>
            <span className="rounded-full bg-warning-tint px-2 py-0.5 text-caption font-heading font-bold uppercase tracking-[0.18em] text-warning flex-shrink-0">
              {t("worldSelect.historyDepth.applied", { count: historyDepthYears })}
            </span>
          </div>

          <div
            role="radiogroup"
            aria-labelledby={historyDepthLabelId}
            className="mt-3 grid grid-cols-2 gap-2"
          >
            {HISTORY_DEPTH_OPTIONS.map((value) => {
              const selected = historyDepthYears === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChangeHistoryDepthYears(value)}
                  className={`rounded-panel border px-3 py-3 text-left transition-all ${
                    selected
                      ? "border-selected bg-selected-tint text-selected ring-1 ring-selected/40"
                      : "border-line bg-sunken text-fg hover:border-line-strong"
                  }`}
                >
                  <span className="block font-heading font-bold uppercase tracking-label">
                    {historyDepthOptionLabel(t, value)}
                  </span>
                  {value === 12 && (
                    <span className="block text-caption font-heading font-bold uppercase tracking-[0.2em] text-selected mt-0.5">
                      {t("worldSelect.historyDepth.recommended")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        iconRight={isStarting ? <Loader2 className="animate-spin" /> : <ChevronRight />}
        onClick={onStart}
        disabled={isStarting}
      >
        {isStarting ? t("worldSelect.creatingWorld") : t("worldSelect.startCareer")}
      </Button>
    </div>
  );
}
