import { useState } from "react";
import { Card, CardBody, CardHeader } from "../ui";

import type { TeamProfileTranslate, TeamStatsOverview } from "./TeamProfile.types";
import { TeamStyleRadarChart } from "./TeamStyleRadarChart";

interface TeamProfileAdvancedStatsCardProps {
  overview: TeamStatsOverview;
  t: TeamProfileTranslate;
}

function resolveLabel(t: TeamProfileTranslate, key: string, fallback: string): string {
  return t(key, { defaultValue: fallback });
}

function formatRate(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return value.toFixed(1);
}

function formatPercentage(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${value.toFixed(1)}%`;
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-sunken px-3 py-2.5 text-center">
      <p className="text-caption uppercase tracking-label text-fg-subtle">{label}</p>
      <p className="font-heading font-bold text-heading text-fg tabular-nums">{value}</p>
    </div>
  );
}

function MetricRow({
  label,
  primaryValue,
  secondaryLabel,
  secondaryValue,
}: {
  label: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)] gap-3 items-center rounded-control bg-sunken px-3 py-2.5">
      <div>
        <p className="font-heading font-bold text-body uppercase tracking-label text-fg-muted">
          {label}
        </p>
        <p className="font-heading font-bold text-heading text-fg tabular-nums">{primaryValue}</p>
      </div>

      <div className="text-center">
        <p className="text-caption uppercase tracking-label text-fg-subtle">{secondaryLabel}</p>
        <p className="font-heading font-bold text-body text-fg tabular-nums">{secondaryValue}</p>
      </div>
    </div>
  );
}

export default function TeamProfileAdvancedStatsCard({
  overview,
  t,
}: TeamProfileAdvancedStatsCardProps) {
  const [view, setView] = useState<"stats" | "radar">("stats");
  const labels = {
    title: t("teamProfile.advancedStats"),
    matchesPlayed: resolveLabel(t, "teamProfile.matchesPlayed", "Matches"),
    goalsFor: resolveLabel(t, "common.gf", "GF"),
    possession: resolveLabel(t, "teamProfile.possession", "Possession"),
    goalDifference: resolveLabel(t, "teamProfile.goalDifference", "Goal Difference"),
    shots: resolveLabel(t, "teamProfile.shots", "Shots"),
    shotsOnTarget: resolveLabel(t, "teamProfile.shotsOnTarget", "Shots On Target"),
    passes: resolveLabel(t, "teamProfile.passes", "Passes"),
    tacklesWon: resolveLabel(t, "teamProfile.tacklesWon", "Tackles Won"),
    interceptions: resolveLabel(t, "teamProfile.interceptions", "Interceptions"),
    foulsCommitted: resolveLabel(t, "teamProfile.foulsCommitted", "Fouls Committed"),
    perMatch: resolveLabel(t, "teamProfile.perMatch", "Per Match"),
    passAccuracy: resolveLabel(t, "teamProfile.passAccuracy", "Pass Accuracy"),
  };

  return (
    <Card className="lg:col-span-3">
      <CardHeader
        action={
          <div className="flex rounded-control overflow-hidden border border-line text-caption font-heading font-bold uppercase tracking-label">
            <button
              type="button"
              aria-pressed={view === "stats"}
              onClick={() => setView("stats")}
              className={`px-3 py-1 transition-colors ${view === "stats" ? "bg-selected-fill text-on-brand" : "text-fg-muted hover:bg-hover"}`}
            >
              {t("common.statsView")}
            </button>
            <button
              type="button"
              aria-pressed={view === "radar"}
              onClick={() => setView("radar")}
              className={`px-3 py-1 transition-colors ${view === "radar" ? "bg-selected-fill text-on-brand" : "text-fg-muted hover:bg-hover"}`}
            >
              {t("teamProfile.teamStyle")}
            </button>
          </div>
        }
      >
        {labels.title}
      </CardHeader>
      {view === "radar" ? (
        <CardBody>
          <TeamStyleRadarChart
            overview={overview}
            labels={{
              possession: labels.possession,
              shots: labels.shots,
              passes: labels.passes,
              tackles: labels.tacklesWon,
              interceptions: labels.interceptions,
              fouls: labels.foulsCommitted,
            }}
          />
        </CardBody>
      ) : (
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <SummaryStat label={labels.matchesPlayed} value={String(overview.matchesPlayed)} />
            <SummaryStat label={labels.goalsFor} value={String(overview.goalsFor)} />
            <SummaryStat
              label={labels.possession}
              value={formatPercentage(overview.possessionAverage)}
            />
            <SummaryStat label={labels.goalDifference} value={String(overview.goalDifference)} />
          </div>

          <div className="space-y-3">
            <MetricRow
              label={labels.shots}
              primaryValue={String(overview.metrics.shots.total)}
              secondaryLabel={labels.perMatch}
              secondaryValue={formatRate(overview.metrics.shots.perMatch)}
            />
            <MetricRow
              label={labels.shotsOnTarget}
              primaryValue={String(overview.metrics.shotsOnTarget.total)}
              secondaryLabel={labels.perMatch}
              secondaryValue={formatRate(overview.metrics.shotsOnTarget.perMatch)}
            />
            <MetricRow
              label={labels.passes}
              primaryValue={`${overview.metrics.passes.completed} / ${overview.metrics.passes.attempted}`}
              secondaryLabel={labels.passAccuracy}
              secondaryValue={formatPercentage(overview.metrics.passes.accuracy)}
            />
            <MetricRow
              label={labels.tacklesWon}
              primaryValue={String(overview.metrics.tacklesWon.total)}
              secondaryLabel={labels.perMatch}
              secondaryValue={formatRate(overview.metrics.tacklesWon.perMatch)}
            />
            <MetricRow
              label={labels.interceptions}
              primaryValue={String(overview.metrics.interceptions.total)}
              secondaryLabel={labels.perMatch}
              secondaryValue={formatRate(overview.metrics.interceptions.perMatch)}
            />
            <MetricRow
              label={labels.foulsCommitted}
              primaryValue={String(overview.metrics.foulsCommitted.total)}
              secondaryLabel={labels.perMatch}
              secondaryValue={formatRate(overview.metrics.foulsCommitted.perMatch)}
            />
          </div>
        </CardBody>
      )}
    </Card>
  );
}
