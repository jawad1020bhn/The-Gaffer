import { useTranslation } from "react-i18next";
import { User, Calendar, Shield, Eye, EyeOff, TrendingUp, BarChart3 } from "lucide-react";
import { ProgressBar, CountryFlag } from "./ui";
import { countryName } from "../lib/countries";
import type { ScoutReportData } from "../store/gameStore";

interface ScoutPlayerCardProps {
  report: ScoutReportData;
  onPlayerClick?: (playerId: string) => void;
}

interface AttrRow {
  labelKey: string;
  value: number | null;
}

function confidenceColor(key: string): string {
  if (key.endsWith(".high")) return "text-positive";
  if (key.endsWith(".moderate")) return "text-warning";
  return "text-danger";
}

function ratingColor(key: string): string {
  if (key.endsWith(".excellent")) return "text-positive";
  if (key.endsWith(".veryGood")) return "text-selected";
  if (key.endsWith(".good")) return "text-warning";
  if (key.endsWith(".average")) return "text-warning";
  return "text-danger";
}

export default function ScoutPlayerCard({ report, onPlayerClick }: ScoutPlayerCardProps) {
  const { t, i18n } = useTranslation();

  const attrs: AttrRow[] = [
    { labelKey: "common.attributes.pace", value: report.pace },
    { labelKey: "common.attributes.shooting", value: report.shooting },
    { labelKey: "common.attributes.passing", value: report.passing },
    { labelKey: "common.attributes.dribbling", value: report.dribbling },
    { labelKey: "common.attributes.defending", value: report.defending },
    { labelKey: "common.attributes.strength", value: report.physical },
  ];

  const discoveredCount = attrs.filter((a) => a.value !== null).length;

  return (
    <div
      onClick={() => onPlayerClick?.(report.player_id)}
      className={`mt-4 rounded-panel border border-line bg-gradient-to-br from-sunken to-panel from-panel to-panel overflow-hidden ${
        onPlayerClick ? "cursor-pointer hover:border-selected hover:shadow-md transition-all" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-panel">
        <div className="w-10 h-10 rounded-full bg-hover flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-fg-subtle" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-heading font-bold text-fg text-body truncate">
            {report.player_name}
          </h4>
          <div className="flex items-center gap-2 text-caption text-fg-subtle">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" />{" "}
              {t(`common.positions.${report.position}`, report.position)}
            </span>
            <span className="flex items-center gap-1">
              <CountryFlag
                code={report.nationality}
                locale={i18n.language}
                className="text-body leading-none"
              />
              <span>{countryName(report.nationality, i18n.language)}</span>
            </span>
          </div>
        </div>
        {onPlayerClick && (
          <div className="text-caption text-fg-subtle hover:text-selected transition-colors flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("scouting.viewPlayer")}</span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Basic info row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-fg-muted">
          {report.team_name && (
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-selected" /> {report.team_name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {report.dob}
          </span>
          {report.condition !== null && (
            <span className="flex items-center gap-1">
              {t("scouting.condition")}: {report.condition}%
            </span>
          )}
          {report.morale !== null && (
            <span className="flex items-center gap-1">
              {t("scouting.morale")}: {report.morale}/100
            </span>
          )}
        </div>

        {/* Attributes grid */}
        <div className="space-y-1.5">
          <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-subtle flex items-center gap-1.5">
            <BarChart3 className="w-3 h-3" />
            {t("scouting.estimatedAttributes")} ({discoveredCount}/6)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {attrs.map((attr) => (
              <div key={attr.labelKey} className="flex items-center gap-2">
                <span className="text-caption font-medium text-fg-muted w-20 truncate">
                  {t(attr.labelKey)}
                </span>
                {attr.value !== null ? (
                  <>
                    <div className="flex-1">
                      <ProgressBar value={attr.value} size="sm" />
                    </div>
                    <span className="text-caption font-bold tabular-nums text-fg w-6 text-right">
                      {attr.value}
                    </span>
                  </>
                ) : (
                  <div className="flex-1 flex items-center gap-1.5 text-fg-subtle">
                    <EyeOff className="w-3 h-3" />
                    <span className="text-caption italic">{t("scouting.undiscovered")}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Assessment footer */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
          {report.avg_rating !== null && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-caption font-bold bg-hover ${ratingColor(report.rating_key)}`}
            >
              <BarChart3 className="w-3 h-3" />
              {t(report.rating_key)} (~{report.avg_rating})
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-caption font-bold bg-hover ${ratingColor(report.potential_key)}`}
          >
            <TrendingUp className="w-3 h-3" />
            {t(report.potential_key)}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-caption font-bold bg-hover ${confidenceColor(report.confidence_key)}`}
          >
            <Eye className="w-3 h-3" />
            {t("scouting.confidence")}: {t(report.confidence_key)}
          </span>
        </div>
      </div>
    </div>
  );
}
