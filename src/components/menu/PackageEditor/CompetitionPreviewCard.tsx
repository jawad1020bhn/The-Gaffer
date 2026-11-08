import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";
import type { CompetitionDef } from "./types";

interface CompetitionPreviewCardProps {
  competition: CompetitionDef;
  logoDataUrl: string | null;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function CompetitionPreviewCard({ competition, logoDataUrl }: CompetitionPreviewCardProps) {
  const { t } = useTranslation();

  const participantCount =
    competition.participants.explicit?.length ?? competition.participants.selector?.count ?? null;

  return (
    <div className="rounded-panel border border-line overflow-hidden bg-panel shadow-sm select-none">
      {/* Header banner */}
      <div className="h-20 bg-gradient-to-br from-selected-fill to-selected-fill flex items-center justify-center">
        {logoDataUrl ? (
          <img src={logoDataUrl} alt="" className="w-14 h-14 object-contain drop-shadow-md" />
        ) : (
          <div className="w-14 h-14 rounded-panel bg-panel/10 border border-line/20 flex items-center justify-center">
            <Trophy className="w-7 h-7 text-fg/70" />
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2.5">
        {/* Name */}
        <div>
          <p className="font-heading font-bold text-body uppercase tracking-label text-fg leading-tight">
            {competition.name || <span className="text-fg-subtle italic">New Competition</span>}
          </p>
          {competition.id && (
            <p className="text-caption text-fg-subtle font-mono mt-0.5">{competition.id}</p>
          )}
        </div>

        {/* Type + Scope */}
        <div className="flex gap-1.5 flex-wrap">
          <span className="text-caption font-heading font-bold uppercase tracking-label px-1.5 py-0.5 rounded bg-selected-tint text-selected">
            {t(`teamSelect.kinds.${competition.type}`, { defaultValue: competition.type })}
          </span>
          <span className="text-caption font-heading font-bold uppercase tracking-label px-1.5 py-0.5 rounded bg-hover text-fg-muted">
            {t(`teamSelect.scopes.${competition.scope}`, { defaultValue: competition.scope })}
          </span>
        </div>

        {/* Format */}
        <div className="text-caption text-fg-muted">
          <span className="uppercase tracking-label">{t("worldEditor.competitionFormat")} </span>
          <span className="text-fg">
            {t(`worldEditor.competitionFormats.${competition.format.kind}`, {
              defaultValue: competition.format.kind,
            })}
          </span>
        </div>

        {/* Participants */}
        {participantCount !== null && (
          <div className="text-caption text-fg-muted">
            <span className="uppercase tracking-label">
              {t("worldEditor.competitionExplicitTeams")}{" "}
            </span>
            <span className="text-fg font-mono">{participantCount}</span>
          </div>
        )}

        {/* Region / Country */}
        {(competition.regionId || competition.countryId) && (
          <div className="text-caption text-fg-muted">
            <span className="uppercase tracking-label">
              {competition.regionId
                ? t("worldEditor.competitionRegionId")
                : t("worldEditor.competitionCountryId")}{" "}
            </span>
            <span className="text-fg font-mono">
              {competition.regionId ?? competition.countryId}
            </span>
          </div>
        )}

        {/* Season start */}
        {competition.seasonStartMonth && (
          <div className="text-caption text-fg-muted">
            <span className="uppercase tracking-label">
              {t("worldEditor.competitionSeasonMonth")}{" "}
            </span>
            <span className="text-fg">
              {MONTH_NAMES[(competition.seasonStartMonth - 1) % 12]}
              {competition.seasonStartDay ? ` ${competition.seasonStartDay}` : ""}
            </span>
          </div>
        )}

        {/* Priority */}
        <div className="text-caption text-fg-muted">
          <span className="uppercase tracking-label">{t("worldEditor.competitionPriority")} </span>
          <span className="text-fg font-mono">{competition.priority}</span>
        </div>
      </div>
    </div>
  );
}
