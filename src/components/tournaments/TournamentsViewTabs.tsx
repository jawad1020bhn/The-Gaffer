import { Award, Calendar, GitBranch, TableProperties, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

export type TournamentsView = "overview" | "standings" | "fixtures" | "awards";

interface TournamentsViewTabsProps {
  view: TournamentsView;
  onSelectView: (view: TournamentsView) => void;
  /** A knockout competition shows a bracket where a league shows a table. */
  isKnockout: boolean;
}

export default function TournamentsViewTabs({
  view,
  onSelectView,
  isKnockout,
}: TournamentsViewTabsProps) {
  const { t } = useTranslation();

  const tabs: { id: TournamentsView; icon: React.ReactNode; label: string }[] = [
    {
      id: "overview",
      icon: <Trophy className="w-4 h-4 inline mr-1.5 -mt-0.5" />,
      label: t("tournaments.overview"),
    },
    isKnockout
      ? {
          id: "standings",
          icon: <GitBranch className="w-4 h-4 inline mr-1.5 -mt-0.5" />,
          label: t("tournaments.bracket"),
        }
      : {
          id: "standings",
          icon: <TableProperties className="w-4 h-4 inline mr-1.5 -mt-0.5" />,
          label: t("schedule.standings"),
        },
    {
      id: "fixtures",
      icon: <Calendar className="w-4 h-4 inline mr-1.5 -mt-0.5" />,
      label: t("schedule.fixtures"),
    },
    {
      id: "awards",
      icon: <Award className="w-4 h-4 inline mr-1.5 -mt-0.5" />,
      label: t("tournaments.awardsTab"),
    },
  ];

  return (
    // aria-pressed rather than the ARIA tab pattern: role="tab" also promises
    // arrow-key navigation and an aria-controls'd panel, and announcing
    // "tab 1 of 4" without those is worse than a plain group of toggles.
    <div className="flex gap-2 mb-5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={view === tab.id}
          onClick={() => onSelectView(tab.id)}
          className={`px-4 py-2 rounded-control font-heading font-bold text-body uppercase tracking-label transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${
            view === tab.id
              ? "bg-selected-fill text-on-brand shadow-md shadow-card"
              : "bg-panel text-fg-muted hover:text-fg border border-line"
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
