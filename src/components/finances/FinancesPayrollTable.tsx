import { useTranslation } from "react-i18next";
import { User } from "lucide-react";
import { Card, CardHeader, CardBody } from "../ui";
import { formatExactMoney, formatVal } from "../../lib/helpers";
import { weeklyWageAmount } from "../../lib/finance";
import { naturalPositionOf } from "../../lib/positions";
import type { PlayerData, PlayerSelectionOptions } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import PlayerPositionBadge from "../PlayerPositionBadge";

interface FinancesPayrollTableProps {
  roster: PlayerData[];
  onSelectPlayer?: (id: string, options?: PlayerSelectionOptions) => void;
}

export default function FinancesPayrollTable({
  roster,
  onSelectPlayer,
}: FinancesPayrollTableProps) {
  const { t } = useTranslation();

  return (
    <Card className="lg:col-span-3">
      <CardHeader>{t("finances.payroll")}</CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sunken border-b border-line text-caption">
                <th className="py-3 px-5 font-heading font-bold uppercase tracking-label text-fg-muted">
                  {t("common.player")}
                </th>
                <th className="py-3 px-5 font-heading font-bold uppercase tracking-label text-fg-muted">
                  {t("common.position")}
                </th>
                <th className="py-3 px-5 font-heading font-bold uppercase tracking-label text-fg-muted">
                  {t("finances.wagePerWeek")}
                </th>
                <th className="py-3 px-5 font-heading font-bold uppercase tracking-label text-fg-muted">
                  {t("finances.marketValue")}
                </th>
                <th className="py-3 px-5 font-heading font-bold uppercase tracking-label text-fg-muted">
                  {t("common.contract")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...roster]
                .sort((a, b) => b.wage - a.wage)
                .slice(0, 10)
                .map((p) => {
                  const contextItems = onSelectPlayer
                    ? [
                        {
                          label: t("squad.viewProfile"),
                          icon: <User className="w-4 h-4" />,
                          onClick: () => onSelectPlayer(p.id),
                        },
                      ]
                    : [];

                  const row = (
                    <tr
                      key={p.id}
                      onClick={() => onSelectPlayer?.(p.id)}
                      onKeyDown={
                        onSelectPlayer
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onSelectPlayer(p.id);
                              }
                            }
                          : undefined
                      }
                      role={onSelectPlayer ? "button" : undefined}
                      tabIndex={onSelectPlayer ? 0 : undefined}
                      className={`hover:bg-hover/50 transition-colors ${onSelectPlayer ? "cursor-pointer group" : ""}`}
                    >
                      <td className="py-3 px-5 font-semibold text-body text-fg">
                        <span className="group-hover:text-selected transition-colors">
                          {p.full_name}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <PlayerPositionBadge position={naturalPositionOf(p)} />
                      </td>
                      <td className="py-3 px-5 text-body font-medium text-fg">
                        {formatExactMoney(weeklyWageAmount(p.wage))}
                      </td>
                      <td className="py-3 px-5 text-body text-fg-muted">
                        {formatVal(p.market_value)}
                      </td>
                      <td className="py-3 px-5 text-body text-fg-muted">
                        {p.contract_end
                          ? t("finances.until", {
                              year: p.contract_end.substring(0, 4),
                            })
                          : "—"}
                      </td>
                    </tr>
                  );

                  if (!onSelectPlayer) {
                    return row;
                  }

                  return (
                    <ContextMenu items={contextItems} key={p.id}>
                      {row}
                    </ContextMenu>
                  );
                })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
