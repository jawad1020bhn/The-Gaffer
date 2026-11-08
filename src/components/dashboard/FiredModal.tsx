import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { ShieldX } from "lucide-react";
import { useGameStore } from "../../store/gameStore";
import { Dialog } from "../ui";

/**
 * The board's letter to a sacked manager: a ui/Dialog, so the focus moves into it and Escape is
 * the same as Continue.
 */
export function FiredLetter({
  teamName,
  onContinue,
}: {
  teamName: string;
  onContinue: () => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <Dialog
      labelledBy="fired-letter-title"
      onClose={onContinue}
      className="mx-4 w-full max-w-lg rounded-panel"
    >
      {/* Header */}
      <div className="flex flex-col items-center pt-8 pb-4 px-6">
        <div className="w-16 h-16 rounded-panel bg-gradient-to-br from-danger-solid to-danger-solid flex items-center justify-center mb-4 shadow-lg shadow-card">
          <ShieldX className="w-8 h-8 text-on-brand" />
        </div>
        <h2
          id="fired-letter-title"
          className="text-title font-heading font-bold text-fg uppercase tracking-label text-center"
        >
          {t("sacked.title")}
        </h2>
        {teamName && <p className="text-body text-fg-subtle mt-1">{teamName}</p>}
      </div>

      {/* Letter body */}
      <div className="px-8 pb-6">
        <div className="rounded-control bg-sunken/50 p-5 border border-line">
          <p className="text-body text-fg leading-relaxed whitespace-pre-line">
            {t("sacked.dismissalLetter", { team: teamName })}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 pb-8">
        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded-panel bg-hover px-6 py-3 font-heading font-bold text-body uppercase tracking-label text-fg transition-all hover:bg-hover shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page"
        >
          {t("dashboard.continue")}
        </button>
      </div>
    </Dialog>
  );
}

export default function FiredModal(): JSX.Element | null {
  const { showFiredModal, setShowFiredModal, gameState } = useGameStore();

  if (!showFiredModal || !gameState) return null;

  const manager = gameState.manager;
  const lastEntry = manager.career_history?.length
    ? manager.career_history[manager.career_history.length - 1]
    : null;
  const teamName = lastEntry?.team_name || "";

  return <FiredLetter teamName={teamName} onContinue={() => setShowFiredModal(false)} />;
}
