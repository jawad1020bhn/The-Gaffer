import { Card, Badge } from "../ui";
import { TrendingUp } from "lucide-react";
import { formatVal, formatWeeklyWage } from "../../lib/helpers";
import type { TransfersTabController } from "./useTransfersTabController";
type TransfersBudgetHeaderProps = {
  state: Pick<
    TransfersTabController,
    | "myTeam"
    | "t"
    | "transferWindowVariant"
    | "transferWindow"
    | "transferWindowSummary"
    | "weeklyWageBudget"
    | "myListedPlayers"
  >;
};
type TransfersTabNavigationProps = {
  state: Pick<TransfersTabController, "tabs" | "setView" | "view">;
};

export function TransfersBudgetHeader({ state }: TransfersBudgetHeaderProps) {
  const {
    myTeam,
    t,
    transferWindowVariant,
    transferWindow,
    transferWindowSummary,
    weeklyWageBudget,
    myListedPlayers,
  } = state;
  return (
    myTeam && (
      <Card accent="primary" className="mb-5">
        <div className="bg-gradient-to-r from-navy-700 to-navy-800 p-5 rounded-t-xl flex items-center gap-6">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lead font-heading font-bold text-white uppercase tracking-label flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent-400" />
                {t("transfers.centre")}
              </h2>
              <Badge variant={transferWindowVariant} size="sm">
                {t(`season.transferWindowStatus.${transferWindow.status}`)}
              </Badge>
            </div>
            <p className="text-gray-300 dark:text-gray-300 text-caption mt-0.5">
              {t("transfers.transferWindow", { team: myTeam.name })}
            </p>
            <p className="text-gray-500 text-caption mt-1">{transferWindowSummary}</p>
          </div>
          <div className="hidden md:flex gap-4">
            <div className="bg-white/5 rounded-panel px-4 py-2 text-center">
              <p className="text-caption text-gray-300 dark:text-gray-300 font-heading uppercase tracking-label">
                {t("finances.transferBudget")}
              </p>
              <p className="font-heading font-bold text-lead text-accent-400">
                {formatVal(myTeam.transfer_budget)}
              </p>
            </div>
            <div
              data-testid="wage-budget-card"
              className="bg-white/5 rounded-panel px-4 py-2 text-center"
            >
              <p className="text-caption text-gray-300 dark:text-gray-300 font-heading uppercase tracking-label">
                {t("finances.wageBudget")}
              </p>
              <p className="font-heading font-bold text-lead text-white">
                {formatWeeklyWage(weeklyWageBudget, "compact")}
              </p>
            </div>
            <div className="bg-white/5 rounded-panel px-4 py-2 text-center">
              <p className="text-caption text-gray-300 dark:text-gray-300 font-heading uppercase tracking-label">
                {t("transfers.listed")}
              </p>
              <p className="font-heading font-bold text-lead text-white">
                {myListedPlayers.length}
              </p>
            </div>
          </div>
        </div>
      </Card>
    )
  );
}

export function TransfersTabNavigation({ state }: TransfersTabNavigationProps) {
  const { tabs, setView, view } = state;
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          onClick={() => setView(tab.id)}
          className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 dark:focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-800 motion-reduce:transition-none px-4 py-2 rounded-control font-heading font-bold text-body uppercase tracking-label transition-all flex items-center gap-1.5 ${
            view === tab.id
              ? "bg-primary-700 text-white shadow-md shadow-primary-700/20"
              : "bg-panel text-fg-muted border border-line hover:text-fg"
          }`}
        >
          {tab.icon} {tab.label} ({tab.count})
        </button>
      ))}
    </div>
  );
}
