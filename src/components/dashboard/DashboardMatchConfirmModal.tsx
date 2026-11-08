import { AlertCircle } from "lucide-react";
import { type JSX, useId } from "react";
import { useTranslation } from "react-i18next";

import { getFixtureDisplayLabel, getTeamName } from "../../lib/helpers";
import type { FixtureData, TeamData } from "../../store/gameStore";
import type { MatchModeType } from "../../hooks/useAdvanceTime";
import { Dialog } from "../ui";
import type { DashboardMatchModeMeta } from "../gameShell/GameCommandBar";

interface DashboardMatchConfirmModalProps {
  matchMode: MatchModeType;
  modeMeta: DashboardMatchModeMeta;
  onCancel: () => void;
  onConfirm: () => void;
  teams: TeamData[];
  todayMatchFixture: FixtureData | null;
  competitionName?: string;
}

export default function DashboardMatchConfirmModal({
  matchMode,
  modeMeta,
  onCancel,
  onConfirm,
  teams,
  todayMatchFixture,
  competitionName,
}: DashboardMatchConfirmModalProps): JSX.Element {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <Dialog labelledBy={titleId} onClose={onCancel} className="w-full max-w-md rounded-panel p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-panel bg-selected-fill text-on-brand">
          {modeMeta.icon}
        </div>
        <div>
          <h3
            id={titleId}
            className="text-heading font-heading font-bold uppercase tracking-label text-fg"
          >
            {t("continueMenu.matchDayTitle")}
          </h3>
          <p className="text-caption text-fg-muted">{modeMeta.label}</p>
        </div>
      </div>
      {todayMatchFixture && (
        <div className="mb-4 rounded-panel bg-sunken p-4 text-center">
          <p className="mb-2 text-caption font-heading uppercase tracking-label text-fg-subtle">
            {getFixtureDisplayLabel(t, todayMatchFixture, competitionName)}
          </p>
          <p className="text-heading font-heading font-bold text-fg">
            {getTeamName(teams, todayMatchFixture.home_team_id)}{" "}
            <span className="mx-2 text-fg-subtle">{t("common.vs")}</span>{" "}
            {getTeamName(teams, todayMatchFixture.away_team_id)}
          </p>
        </div>
      )}
      <p className="mb-1 text-body text-fg-muted">{modeMeta.desc}</p>
      {matchMode === "delegate" && (
        <p className="mt-1 flex items-center gap-1 text-caption text-warning">
          <AlertCircle className="h-3.5 w-3.5" />
          {t("continueMenu.delegateWarning")}
        </p>
      )}
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-control bg-hover px-4 py-2.5 text-body font-heading font-bold uppercase tracking-label text-fg transition-colors hover:bg-hover"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex flex-1 items-center justify-center gap-2 rounded-control bg-selected-fill px-4 py-2.5 font-heading text-body font-bold uppercase tracking-label text-on-brand transition-colors hover:bg-selected focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
        >
          {modeMeta.icon}
          {t("common.confirm")}
        </button>
      </div>
    </Dialog>
  );
}
