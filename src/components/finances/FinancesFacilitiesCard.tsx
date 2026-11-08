import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody, Button } from "../ui";
import { formatExactMoney } from "../../lib/helpers";
import { resolveBackendError } from "../../utils/backendI18n";
import type { FacilityUpgradePreviewData } from "../../services/financeService";
import {
  type FacilityId,
  type FacilityUpgradeErrorState,
  FACILITY_DEFINITIONS,
} from "./FinancesTab.helpers";

interface FinancesFacilitiesCardProps {
  facilities: Record<"training" | "medical" | "scouting", number>;
  /** The backend's verdict per facility; the card decides nothing itself. */
  facilityUpgrades: FacilityUpgradePreviewData[];
  /** False while the verdict describes an older club state: every upgrade stays disabled. */
  previewsCurrent: boolean;
  facilityUpgradeError: FacilityUpgradeErrorState | null;
  actionLoading: string | null;
  onUpgrade: (facility: FacilityId) => void;
}

export default function FinancesFacilitiesCard({
  facilities,
  facilityUpgrades,
  previewsCurrent,
  facilityUpgradeError,
  actionLoading,
  onUpgrade,
}: FinancesFacilitiesCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="lg:col-span-3">
      <CardHeader>{t("finances.facilities")}</CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FACILITY_DEFINITIONS.map((facility) => {
            const level = facilities[facility.levelKey];
            const upgrade = facilityUpgrades.find((entry) => entry.facility === facility.id);
            const financeBlockReason = previewsCurrent ? upgrade?.blockReason : null;
            const canAffordUpgrade = upgrade?.canAfford ?? true;
            const canUpgrade =
              previewsCurrent && upgrade !== undefined && canAffordUpgrade && !financeBlockReason;
            const isLoading = actionLoading === facility.id;
            const upgradeReason = financeBlockReason
              ? resolveBackendError(financeBlockReason)
              : facilityUpgradeError?.facilityId === facility.id
                ? facilityUpgradeError.message
                : null;

            return (
              <div
                key={facility.id}
                className="rounded-panel border border-line bg-sunken p-4 flex flex-col gap-4"
              >
                <div className="space-y-1">
                  <h3 className="font-heading font-bold text-body text-fg uppercase tracking-label">
                    {t(facility.titleKey)}
                  </h3>
                  <p className="text-body text-fg-muted">
                    {t("finances.facilityLevel", { level })}
                  </p>
                  <p className="text-body text-fg-muted">{t(facility.effectKey)}</p>
                </div>

                <div className="space-y-2 mt-auto">
                  {upgrade && (
                    <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
                      {t("finances.nextUpgradeCost", {
                        amount: formatExactMoney(upgrade.nextCost),
                      })}
                    </p>
                  )}
                  <Button
                    disabled={!canUpgrade || isLoading}
                    onClick={() => onUpgrade(facility.id)}
                    size="sm"
                  >
                    {t("finances.upgradeFacility")}
                  </Button>
                  {previewsCurrent && !canAffordUpgrade && !upgradeReason && (
                    <p className="text-caption text-danger">{t("finances.insufficientFunds")}</p>
                  )}
                  {upgradeReason && <p className="text-caption text-danger">{upgradeReason}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
