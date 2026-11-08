import { ScanSearch } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PlayerProfileScoutStatus, ScoutAvailability } from "./PlayerProfile.scouting";

interface PlayerProfileScoutActionProps {
  availability: ScoutAvailability;
  scoutStatus: PlayerProfileScoutStatus;
  scoutError: string | null;
  onScout: () => void;
}

export default function PlayerProfileScoutAction({
  availability,
  scoutStatus,
  scoutError,
  onScout,
}: PlayerProfileScoutActionProps) {
  const { t } = useTranslation();

  if (availability.scouts.length === 0) {
    return <p className="text-caption text-fg-muted">{t("scouting.noScoutsHint")}</p>;
  }

  if (availability.alreadyScouting || scoutStatus === "sent") {
    return (
      <span className="text-caption text-selected font-heading font-bold uppercase tracking-label flex items-center gap-1.5">
        <ScanSearch className="w-3.5 h-3.5" /> {t("scouting.scoutingInProgress")}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={!availability.canScout || scoutStatus === "sending"}
        onClick={onScout}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-selected-tint text-selected hover:bg-selected-tint transition-colors text-caption font-heading font-bold uppercase tracking-label disabled:opacity-50"
      >
        <ScanSearch className="w-3.5 h-3.5" />
        {scoutStatus === "sending" ? t("scouting.scoutingInProgress") : t("scouting.scoutBtn")}
      </button>
      {scoutError ? <p className="text-caption text-danger mt-1">{scoutError}</p> : null}
    </>
  );
}
