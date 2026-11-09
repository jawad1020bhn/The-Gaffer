import { useEffect, useId, useState } from "react";
import { FinanceCashFlowChart } from "./FinanceCashFlowChart";
import { useContractRiskLevels } from "../../hooks/useContractWarningStages";
import type { GameStateData, PlayerSelectionOptions, TeamData } from "../../store/gameStore";
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  ProgressBar,
  Button,
  Checkbox,
  Tabs,
  TabPanel,
  SceneState,
} from "../ui";
import {
  contractExpiryLabel,
  formatExactMoney,
  formatVal,
  formatWeeklyAmount,
  formatWeeklyWage,
  getContractRiskBadgeVariant,
  getContractYearsRemaining,
} from "../../lib/helpers";
import { weeklyWageAmount } from "../../lib/finance";
import { getFinanceSnapshot, type FinanceSnapshotData } from "../../services/financeService";
import { invokeForCareer } from "../../services/careerInvoke";
import { useTranslation } from "react-i18next";
import { resolveBackendError, resolveMessage } from "../../utils/backendI18n";
import {
  type FacilityId,
  type FacilityUpgradeErrorState,
  type TaggedFinanceSnapshotData,
  type ResolveMessageActionResult,
  type DelegatedRenewalResponseData,
  type BoardSupportResponseData,
  type SponsorPitchResponseData,
  type MarketingCampaignResponseData,
  DEFAULT_FACILITIES,
  formatSignedAmount,
  buildFinanceSnapshotKey,
  isChooseOptionAction,
  isPendingSponsorOffer,
} from "./FinancesTab.helpers";
import FinancesFacilitiesCard from "./FinancesFacilitiesCard";
import FinancesPayrollTable from "./FinancesPayrollTable";

interface FinancesTabProps {
  gameState: GameStateData;
  onGameUpdate?: (state: GameStateData) => void;
  onSelectPlayer?: (id: string, options?: PlayerSelectionOptions) => void;
}

/**
 * Resolves the managed team, and renders the tab only once there is one.
 *
 * The guard needs its own component so that each component's hook sequence is
 * the same on every render. Here `useTranslation` runs before the early return,
 * so this component always contributes exactly that one hook whether or not a
 * team was found; `FinancesTabContent` is mounted only with a team in hand, so
 * it always runs all of its own hooks. Putting the guard directly above
 * `FinancesTabContent`'s ten `useState` calls instead would take the hook count
 * from one to eleven the moment the manager's team resolved, which React
 * rejects with "Rendered more hooks than during the previous render".
 *
 * The two components can be merged again once the tab no longer needs state.
 */
/** The detail sections, in the order a manager reads them. */
type FinanceDetailTab = "cashFlow" | "wagePressure" | "sponsors" | "facilities" | "payroll";

export default function FinancesTab({ gameState, onGameUpdate, onSelectPlayer }: FinancesTabProps) {
  const { t } = useTranslation();
  const myTeam = gameState.teams.find((tm) => tm.id === gameState.manager.team_id);
  if (!myTeam) return <p className="text-fg-muted">{t("common.noTeam")}</p>;

  return (
    <FinancesTabContent
      gameState={gameState}
      myTeam={myTeam}
      onGameUpdate={onGameUpdate}
      onSelectPlayer={onSelectPlayer}
    />
  );
}

interface FinancesTabContentProps extends FinancesTabProps {
  myTeam: TeamData;
}

/**
 * Shows the finances the backend computed, and nothing else.
 *
 * The tab used to fall back to a TypeScript projection while the backend snapshot was loading
 * and on every refetch, so the figures visibly changed once the real ones arrived. The last
 * backend snapshot is kept across a refetch instead, and until the first one lands there is a
 * placeholder, never a guess.
 */
function FinancesTabContent({
  gameState,
  myTeam,
  onGameUpdate,
  onSelectPlayer,
}: FinancesTabContentProps) {
  const { t } = useTranslation();
  const financeSnapshotKey = buildFinanceSnapshotKey(gameState, myTeam);
  const [remoteFinanceData, setRemoteFinanceData] = useState<TaggedFinanceSnapshotData | null>(
    null,
  );
  const [loadFailure, setLoadFailure] = useState<{ teamId: string; key: string } | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const requestKey = financeSnapshotKey;

    setLoadFailure(null);
    void getFinanceSnapshot(myTeam.id)
      .then((financeData) => {
        if (!cancelled) {
          setRemoteFinanceData({ key: requestKey, teamId: myTeam.id, data: financeData });
        }
      })
      .catch((error) => {
        console.error("Failed to load finance snapshot:", error);
        if (!cancelled) {
          setLoadFailure({ teamId: myTeam.id, key: requestKey });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [financeSnapshotKey, myTeam.id, loadAttempt]);

  const ownData = remoteFinanceData?.teamId === myTeam.id ? remoteFinanceData : null;
  const failedForThisState =
    loadFailure?.teamId === myTeam.id && loadFailure.key === financeSnapshotKey;
  const retry = (
    <Button size="sm" variant="outline" onClick={() => setLoadAttempt((n) => n + 1)}>
      {t("common.retry")}
    </Button>
  );
  const failureBanner = failedForThisState ? (
    <div className="flex items-center gap-3 text-body text-fg-muted">
      <p role="alert">{t("finances.snapshotLoadFailed")}</p>
      {retry}
    </div>
  ) : null;

  if (!ownData) {
    // With no snapshot there is nothing to lay out, so the room carries the screen and the one
    // useful action sits in it — not a bare line of text at the top of an empty page.
    return failedForThisState ? (
      <div role="alert" className="h-full">
        <SceneState title={t("finances.snapshotLoadFailed")} action={retry} className="h-full" />
      </div>
    ) : (
      <div
        className="panel-stagger grid h-full min-h-0 grid-cols-12 grid-rows-[minmax(0,1fr)_auto_minmax(0,1.2fr)] gap-4"
        role="status"
        aria-busy="true"
        aria-label={t("common.loading")}
      >
        <p className="sr-only">{t("common.loading")}</p>
        {/* Skeletons in the shape of the panels that are coming, so nothing jumps when they land. */}
        <div className="col-span-8 animate-pulse rounded-panel border border-line bg-panel-glass motion-reduce:animate-none" />
        <div className="col-span-4 animate-pulse rounded-panel border border-line bg-panel-glass motion-reduce:animate-none" />
        <div className="col-span-12 h-8 animate-pulse rounded-control bg-panel-glass motion-reduce:animate-none" />
        <div className="col-span-12 animate-pulse rounded-panel border border-line bg-panel-glass motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <>
      {failureBanner}
      <FinancesTabLoaded
        gameState={gameState}
        myTeam={myTeam}
        financeData={ownData.data}
        previewsCurrent={ownData.key === financeSnapshotKey}
        onGameUpdate={onGameUpdate}
        onSelectPlayer={onSelectPlayer}
      />
    </>
  );
}

interface FinancesTabLoadedProps extends FinancesTabContentProps {
  financeData: FinanceSnapshotData;
  /** Previews describe the club as it was when fetched; a stale set must not enable an action. */
  previewsCurrent: boolean;
}

function FinancesTabLoaded({
  gameState,
  myTeam,
  financeData,
  previewsCurrent,
  onGameUpdate,
  onSelectPlayer,
}: FinancesTabLoadedProps) {
  const { t, i18n } = useTranslation();
  const detailTabId = useId();
  const [detailTab, setDetailTab] = useState<FinanceDetailTab>("cashFlow");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [delegatedRenewalsSummary, setDelegatedRenewalsSummary] = useState<string | null>(null);
  // What the manager has switched off, not what is switched on: everyone at risk is selected until
  // told otherwise, so the default needs no effect to fill it in and no click can beat that effect.
  const [deselectedRiskPlayerIds, setDeselectedRiskPlayerIds] = useState<string[]>([]);
  const [facilityUpgradeError, setFacilityUpgradeError] =
    useState<FacilityUpgradeErrorState | null>(null);
  const [boardSupportFeedback, setBoardSupportFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [sponsorPitchFeedback, setSponsorPitchFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [marketingCampaignFeedback, setMarketingCampaignFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const roster = gameState.players.filter((p) => p.team_id === myTeam.id);
  const recoveryPreviews = previewsCurrent ? financeData.previews : null;
  const financeSnapshot = financeData.snapshot;
  const totalWages = financeSnapshot.weeklyWageSpend;
  const totalValue = roster.reduce((s, p) => s + p.market_value, 0);
  const facilities = myTeam.facilities ?? DEFAULT_FACILITIES;
  const activeSponsorship = myTeam.sponsorship ?? null;
  const weeklySponsorIncome = financeSnapshot.weeklySponsorIncome;
  const projectedWeeklyNet = financeSnapshot.projectedWeeklyNet;
  const cashRunwayWeeks = financeSnapshot.cashRunwayWeeks;
  const wageBudgetUsagePercent = financeSnapshot.wageBudgetUsagePercent;
  const weeklyWageBudget = financeSnapshot.weeklyWageBudget;
  const sponsorOffers = gameState.messages.filter(isPendingSponsorOffer).map(resolveMessage);
  const hasPendingSponsorOffer = sponsorOffers.length > 0;
  const hasActiveSponsor = Boolean(activeSponsorship && activeSponsorship.remaining_weeks > 0);
  // Availability is the backend's verdict alone. While the previews describe an older club state
  // (`recoveryPreviews` is null) nothing is offered, rather than a guess from the snapshot.
  const canRequestBoardSupport = Boolean(recoveryPreviews?.boardSupport);
  const sponsorPitchOffered = Boolean(recoveryPreviews?.sponsorPitch);
  const marketingCampaignOffered = Boolean(recoveryPreviews?.marketingCampaign);
  const canRequestSponsorPitch =
    sponsorPitchOffered && !hasPendingSponsorOffer && !hasActiveSponsor;
  const canRequestMarketingCampaign =
    marketingCampaignOffered && financeSnapshot.marketingCampaignCooldownDaysRemaining === 0;
  const sponsorPitchDisabledReason = hasActiveSponsor
    ? t("finances.sponsorPitchActiveSponsor")
    : hasPendingSponsorOffer
      ? t("finances.sponsorPitchPendingOffer")
      : previewsCurrent && !sponsorPitchOffered
        ? t("finances.sponsorPitchUnavailable")
        : null;
  const marketingCampaignDisabledReason =
    financeSnapshot.marketingCampaignCooldownDaysRemaining > 0
      ? t("finances.marketingCampaignCoolingDown", {
          days: financeSnapshot.marketingCampaignCooldownDaysRemaining,
        })
      : previewsCurrent && !marketingCampaignOffered
        ? t("finances.marketingCampaignUnavailable")
        : null;
  const boardSupportPreviewText = recoveryPreviews?.boardSupport
    ? t("finances.boardSupportSummary", {
        amount: formatExactMoney(recoveryPreviews.boardSupport.supportAmount),
        transferBudgetReduction: formatExactMoney(
          recoveryPreviews.boardSupport.transferBudgetReduction,
        ),
        satisfactionPenalty: recoveryPreviews.boardSupport.satisfactionPenalty,
      })
    : null;
  const sponsorPitchPreviewText = recoveryPreviews?.sponsorPitch
    ? t("finances.sponsorPitchSummary", {
        sponsor: recoveryPreviews.sponsorPitch.sponsorName,
        amount: formatExactMoney(recoveryPreviews.sponsorPitch.weeklyAmount),
        weeks: recoveryPreviews.sponsorPitch.durationWeeks,
      })
    : null;
  const marketingCampaignPreviewText = recoveryPreviews?.marketingCampaign
    ? t("finances.marketingCampaignSummary", {
        netIncome: formatExactMoney(recoveryPreviews.marketingCampaign.netIncome),
        grossRevenue: formatExactMoney(recoveryPreviews.marketingCampaign.grossRevenue),
        cost: formatExactMoney(recoveryPreviews.marketingCampaign.campaignCost),
        days: recoveryPreviews.marketingCampaign.cooldownDays,
      })
    : null;
  const contractRiskLevel = useContractRiskLevels(roster, gameState.clock.current_date);
  const contractRiskPlayers = roster
    .map((player) => {
      const riskLevel = contractRiskLevel(player.id);

      return {
        player,
        riskLevel,
      };
    })
    .filter(({ riskLevel, player }) => player.contract_end && riskLevel !== "stable")
    .sort((left, right) => {
      const leftDate = left.player.contract_end ?? "9999-12-31";
      const rightDate = right.player.contract_end ?? "9999-12-31";
      return leftDate.localeCompare(rightDate);
    });
  const atRiskWages = contractRiskPlayers.reduce(
    (sum, { player }) => sum + weeklyWageAmount(player.wage),
    0,
  );
  const selectedRiskPlayers = contractRiskPlayers.filter(
    ({ player }) => !deselectedRiskPlayerIds.includes(player.id),
  );
  const allRiskPlayerIds = contractRiskPlayers.map(({ player }) => player.id);

  function handleToggleRiskPlayer(playerId: string): void {
    setDeselectedRiskPlayerIds((currentIds) =>
      currentIds.includes(playerId)
        ? currentIds.filter((currentId) => currentId !== playerId)
        : [...currentIds, playerId],
    );
  }

  function handleToggleAllRiskPlayers(): void {
    setDeselectedRiskPlayerIds(
      selectedRiskPlayers.length === allRiskPlayerIds.length ? allRiskPlayerIds : [],
    );
  }

  async function handleUpgradeFacility(facility: FacilityId): Promise<void> {
    setFacilityUpgradeError(null);
    setActionLoading(facility);
    try {
      const updated = await invokeForCareer<GameStateData>("upgrade_facility", {
        facility,
      });
      onGameUpdate?.(updated);
    } catch (error) {
      console.error("Failed to upgrade facility:", error);
      setFacilityUpgradeError({
        facilityId: facility,
        message: resolveBackendError(error),
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRequestBoardSupport(): Promise<void> {
    const loadingKey = "board-support";
    setBoardSupportFeedback(null);
    setActionLoading(loadingKey);

    try {
      const response = await invokeForCareer<BoardSupportResponseData>("request_board_support");
      onGameUpdate?.(response.game);
      setBoardSupportFeedback({
        tone: "success",
        text: t("finances.boardSupportSummary", {
          amount: formatExactMoney(response.result.support_amount),
          transferBudgetReduction: formatExactMoney(response.result.transfer_budget_reduction),
          satisfactionPenalty: response.result.satisfaction_penalty,
        }),
      });
    } catch (error) {
      console.error("Failed to request board support:", error);
      setBoardSupportFeedback({
        tone: "error",
        text: resolveBackendError(error),
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRequestSponsorPitch(): Promise<void> {
    const loadingKey = "sponsor-pitch";
    setSponsorPitchFeedback(null);
    setActionLoading(loadingKey);

    try {
      const response = await invokeForCareer<SponsorPitchResponseData>("request_sponsor_pitch");
      onGameUpdate?.(response.game);
      setSponsorPitchFeedback({
        tone: "success",
        text: t("finances.sponsorPitchSummary", {
          sponsor: response.result.sponsor_name,
          amount: formatExactMoney(response.result.weekly_amount),
          weeks: response.result.duration_weeks,
        }),
      });
    } catch (error) {
      console.error("Failed to pitch sponsors:", error);
      setSponsorPitchFeedback({
        tone: "error",
        text: resolveBackendError(error),
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRequestMarketingCampaign(): Promise<void> {
    const loadingKey = "marketing-campaign";
    setMarketingCampaignFeedback(null);
    setActionLoading(loadingKey);

    try {
      const response = await invokeForCareer<MarketingCampaignResponseData>(
        "request_marketing_campaign",
      );
      onGameUpdate?.(response.game);
      setMarketingCampaignFeedback({
        tone: "success",
        text: t("finances.marketingCampaignSummary", {
          netIncome: formatExactMoney(response.result.net_income),
          grossRevenue: formatExactMoney(response.result.gross_revenue),
          cost: formatExactMoney(response.result.campaign_cost),
          days: response.result.cooldown_days,
        }),
      });
    } catch (error) {
      console.error("Failed to launch marketing campaign:", error);
      setMarketingCampaignFeedback({
        tone: "error",
        text: resolveBackendError(error),
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelegateRenewals(): Promise<void> {
    if (selectedRiskPlayers.length === 0) {
      return;
    }

    const loadingKey = "delegate-renewals";
    setActionLoading(loadingKey);
    setDelegatedRenewalsSummary(null);

    try {
      const result = await invokeForCareer<DelegatedRenewalResponseData>("delegate_renewals", {
        playerIds: selectedRiskPlayers.map(({ player }) => player.id),
        maxWageIncreasePct: 35,
        maxContractYears: 3,
      });
      onGameUpdate?.(result.game);
      setDelegatedRenewalsSummary(
        t("finances.delegatedRenewalsSummary", {
          successes: result.report.success_count,
          stalled: result.report.stalled_count,
          failures: result.report.failure_count,
        }),
      );
    } catch (error) {
      console.error("Failed to delegate renewals:", error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSponsorOption(
    messageId: string,
    actionId: string,
    optionId: string,
  ): Promise<void> {
    const loadingKey = `sponsor:${messageId}:${optionId}`;
    setActionLoading(loadingKey);
    try {
      const result = await invokeForCareer<ResolveMessageActionResult>("resolve_message_action", {
        messageId,
        actionId,
        optionId,
      });
      onGameUpdate?.(result.game);
    } catch (error) {
      console.error("Failed to resolve sponsor offer:", error);
    } finally {
      setActionLoading(null);
    }
  }

  const financeItems = [
    {
      label: t("finances.clubBalance"),
      value: myTeam.finance,
      color: myTeam.finance >= 0 ? "text-selected" : "text-danger",
    },
    {
      label: t("finances.wageBudget"),
      value: myTeam.wage_budget,
      color: "text-fg",
    },
    {
      label: t("finances.transferBudget"),
      value: myTeam.transfer_budget,
      color: "text-fg",
    },
    {
      label: t("finances.seasonIncome"),
      value: myTeam.season_income,
      color: "text-selected",
    },
    {
      label: t("finances.seasonExpenses"),
      value: myTeam.season_expenses,
      color: "text-danger",
    },
  ];

  const detailTabs = [
    { id: "cashFlow", label: t("finances.cashFlow") },
    { id: "wagePressure", label: t("finances.wagePressure") },
    { id: "sponsors", label: t("finances.sponsors") },
    { id: "facilities", label: t("finances.facilities") },
    { id: "payroll", label: t("finances.payroll") },
  ];

  return (
    <div className="panel-stagger grid h-full min-h-0 grid-cols-12 grid-rows-[minmax(0,1fr)_auto_minmax(0,1.2fr)] gap-4">
      {/* Archetype A: two headline panels, then the detail behind in-panel tabs. Seven full-width
          sections used to stack into a page that scrolled. Nothing is removed — every section is
          one tab away, which is the brief's second overflow remedy. */}
      <div className="col-span-8 min-h-0">
        <Card accent="accent">
          <CardHeader>{t("finances.overview")}</CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {financeItems.map((item) => (
                <div key={item.label} className="bg-sunken rounded-panel p-4 text-center">
                  <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-subtle mb-1">
                    {item.label}
                  </p>
                  <p className={`font-heading font-bold text-title ${item.color}`}>
                    {formatVal(item.value)}
                  </p>
                </div>
              ))}
              <div className="bg-sunken rounded-panel p-4 text-center">
                <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-subtle mb-1">
                  {t("finances.squadValue")}
                </p>
                <p className="font-heading font-bold text-title text-fg">{formatVal(totalValue)}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
      <div className="col-span-4 min-h-0">
        <Card>
          <CardHeader>{t("finances.wageBill")}</CardHeader>
          <CardBody>
            <div className="text-center mb-4">
              <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-subtle">
                {t("finances.weeklyTotal")}
              </p>
              <p className="font-heading font-bold text-title text-fg mt-1">
                {formatWeeklyWage(totalWages, "compact")}
              </p>
              <p className="text-caption text-fg-subtle mt-1">
                {t("finances.budget")}: {formatWeeklyWage(weeklyWageBudget, "compact")} —{" "}
                {totalWages <= weeklyWageBudget ? (
                  <span className="text-selected">{t("finances.underBudget")}</span>
                ) : (
                  <span className="text-danger">{t("finances.overBudget")}</span>
                )}
              </p>
            </div>
            <ProgressBar
              value={Math.min(100, Math.round((totalWages / Math.max(1, weeklyWageBudget)) * 100))}
              variant={totalWages <= weeklyWageBudget ? "success" : "danger"}
              size="md"
              showLabel
            />
          </CardBody>
        </Card>
      </div>

      <div className="col-span-12">
        <Tabs
          idPrefix={detailTabId}
          label={t("finances.overview")}
          tabs={detailTabs}
          selectedId={detailTab}
          onSelect={(id) => setDetailTab(id as FinanceDetailTab)}
        />
      </div>

      <div className="col-span-12 min-h-0">
        <TabPanel
          idPrefix={detailTabId}
          tabId={detailTab}
          hidden={false}
          className="h-full min-h-0"
        >
          {detailTab === "cashFlow" && (
            <Card>
              <CardHeader>{t("finances.cashFlow")}</CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="rounded-panel border border-line bg-sunken p-4 text-center">
                    <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-1">
                      {t("finances.weeklyWageSpend")}
                    </p>
                    <p className="font-heading font-bold text-title text-danger">
                      {formatWeeklyAmount(formatSignedAmount(-totalWages))}
                    </p>
                  </div>
                  <div className="rounded-panel border border-line bg-sunken p-4 text-center">
                    <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-1">
                      {t("finances.weeklySponsorIncome")}
                    </p>
                    <p className="font-heading font-bold text-title text-selected">
                      {formatWeeklyAmount(formatSignedAmount(weeklySponsorIncome))}
                    </p>
                  </div>
                  <div className="rounded-panel border border-line bg-sunken p-4 text-center">
                    <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-1">
                      {t("finances.projectedWeeklyNet")}
                    </p>
                    <p
                      className={`font-heading font-bold text-title ${projectedWeeklyNet >= 0 ? "text-selected" : "text-danger"}`}
                    >
                      {formatWeeklyAmount(formatSignedAmount(projectedWeeklyNet))}
                    </p>
                  </div>
                  <div className="rounded-panel border border-line bg-sunken p-4 text-center">
                    <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted mb-1">
                      {t("finances.cashRunway")}
                    </p>
                    <p className="font-heading font-bold text-body text-fg">
                      {cashRunwayWeeks === null
                        ? t("finances.runwayStable")
                        : t("finances.runwayWeeks", { count: cashRunwayWeeks })}
                    </p>
                  </div>
                </div>
                {financeSnapshot.cashFlow.length > 0 && (
                  <div className="mt-4">
                    <FinanceCashFlowChart
                      weeks={financeSnapshot.cashFlow}
                      // The weeks hold every movement, transfer and loan fees included, which the season
                      // figures beside them leave out: so the series are money in and out, not the season's.
                      incomeLabel={t("finances.moneyIn")}
                      expensesLabel={t("finances.moneyOut")}
                    />
                  </div>
                )}
                <div className="mt-4 rounded-panel border border-line bg-sunken p-4 space-y-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
                        {t("finances.boardSupport")}
                      </p>
                      <p className="text-body text-fg-muted">
                        {t("finances.boardSupportDescription")}
                      </p>
                      {boardSupportPreviewText ? (
                        <p className="text-caption text-fg-muted">{boardSupportPreviewText}</p>
                      ) : null}
                    </div>
                    <Button
                      disabled={!canRequestBoardSupport || actionLoading === "board-support"}
                      onClick={() => void handleRequestBoardSupport()}
                      size="sm"
                    >
                      {t("finances.requestBoardSupport")}
                    </Button>
                  </div>
                  {boardSupportFeedback ? (
                    <p
                      className={`text-body ${boardSupportFeedback.tone === "error" ? "text-danger" : "text-selected"}`}
                    >
                      {boardSupportFeedback.text}
                    </p>
                  ) : null}
                  {previewsCurrent && !canRequestBoardSupport ? (
                    <p className="text-caption text-fg-muted">
                      {t("finances.boardSupportUnavailable")}
                    </p>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          )}
          {detailTab === "wagePressure" && (
            <Card>
              <CardHeader>{t("finances.wagePressure")}</CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-panel border border-line bg-sunken p-4 space-y-3">
                    <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
                      {t("finances.wagePressure")}
                    </p>
                    <p className="font-heading font-bold text-title text-fg">
                      {t("finances.wageBudgetUsed", {
                        percent: wageBudgetUsagePercent,
                      })}
                    </p>
                    <ProgressBar
                      value={Math.min(100, wageBudgetUsagePercent)}
                      variant={totalWages <= weeklyWageBudget ? "success" : "danger"}
                      size="md"
                      showLabel
                    />
                  </div>

                  <div className="rounded-panel border border-line bg-sunken p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
                          {t("finances.contractRisk")}
                        </p>
                        {delegatedRenewalsSummary ? (
                          <p className="text-caption text-fg-muted">{delegatedRenewalsSummary}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-body font-semibold text-fg">
                          {t("finances.atRiskWages", {
                            amount: formatExactMoney(atRiskWages),
                          })}
                        </p>
                        {contractRiskPlayers.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleToggleAllRiskPlayers}
                            >
                              {t("finances.selectAllAtRisk")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleDelegateRenewals()}
                              disabled={
                                actionLoading === "delegate-renewals" ||
                                selectedRiskPlayers.length === 0
                              }
                            >
                              {t("finances.delegateSelectedRenewals")}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {contractRiskPlayers.length > 0 ? (
                      <div className="space-y-3">
                        {contractRiskPlayers.map(({ player, riskLevel }) => (
                          <div
                            key={player.id}
                            className="rounded-control border border-line bg-panel p-3 flex items-start justify-between gap-3"
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={!deselectedRiskPlayerIds.includes(player.id)}
                                onChange={() => handleToggleRiskPlayer(player.id)}
                                aria-label={t("finances.selectRiskPlayer", {
                                  player: player.full_name,
                                })}
                                className="mt-1"
                              />
                              <div className="space-y-1">
                                <p className="font-semibold text-body text-fg">
                                  {player.full_name}
                                </p>
                                <p className="text-caption text-fg-muted">
                                  {player.contract_end
                                    ? contractExpiryLabel(player.contract_end, i18n.language, t)
                                    : null}
                                </p>
                                <p className="text-caption text-fg-muted">
                                  {t("playerProfile.yearsRemaining")}:{" "}
                                  {getContractYearsRemaining(
                                    player.contract_end,
                                    gameState.clock.current_date,
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge variant={getContractRiskBadgeVariant(riskLevel)}>
                                {riskLevel === "critical"
                                  ? t("finances.contractRiskCritical")
                                  : t("finances.contractRiskWarning")}
                              </Badge>
                              <span className="text-caption font-semibold text-fg">
                                {formatWeeklyWage(weeklyWageAmount(player.wage))}
                              </span>
                              {onSelectPlayer ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onSelectPlayer(player.id, {
                                      openRenewal: true,
                                    });
                                  }}
                                >
                                  {t("common.renewContract")}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-body text-fg-muted">{t("finances.noContractRisks")}</p>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
          {detailTab === "sponsors" && (
            <Card>
              <CardHeader>{t("finances.sponsors")}</CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-panel border border-line bg-sunken p-4 space-y-2">
                    <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
                      {t("finances.activeSponsor")}
                    </p>
                    {activeSponsorship ? (
                      <>
                        <h3 className="font-heading font-bold text-body text-fg uppercase tracking-label">
                          {activeSponsorship.sponsor_name}
                        </h3>
                        <p className="text-body text-fg-muted">
                          {t("finances.sponsorWeeklyValue", {
                            amount: formatExactMoney(activeSponsorship.base_value),
                          })}
                        </p>
                        <p className="text-body text-fg-muted">
                          {t("finances.sponsorRemainingWeeks", {
                            count: activeSponsorship.remaining_weeks,
                          })}
                        </p>
                      </>
                    ) : (
                      <p className="text-body text-fg-muted">{t("finances.noActiveSponsor")}</p>
                    )}
                  </div>

                  <div className="rounded-panel border border-line bg-sunken p-4 space-y-3">
                    <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
                      {t("finances.pendingSponsorOffers")}
                    </p>
                    <div className="rounded-control border border-line bg-panel p-4 space-y-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-body text-fg">
                            {t("finances.pitchSponsor")}
                          </h3>
                          <p className="text-body text-fg-muted">
                            {t("finances.sponsorPitchDescription")}
                          </p>
                          {sponsorPitchPreviewText ? (
                            <p className="text-caption text-fg-muted">{sponsorPitchPreviewText}</p>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => void handleRequestSponsorPitch()}
                          disabled={actionLoading === "sponsor-pitch" || !canRequestSponsorPitch}
                        >
                          {t("finances.pitchSponsor")}
                        </Button>
                      </div>
                      {sponsorPitchDisabledReason ? (
                        <p className="text-caption text-fg-muted">{sponsorPitchDisabledReason}</p>
                      ) : null}
                      {sponsorPitchFeedback ? (
                        <p
                          className={
                            sponsorPitchFeedback.tone === "error"
                              ? "text-body text-danger"
                              : "text-body text-selected"
                          }
                        >
                          {sponsorPitchFeedback.text}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-control border border-line bg-panel p-4 space-y-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-body text-fg">
                            {t("finances.marketingCampaign")}
                          </h3>
                          <p className="text-body text-fg-muted">
                            {t("finances.marketingCampaignDescription")}
                          </p>
                          {marketingCampaignPreviewText ? (
                            <p className="text-caption text-fg-muted">
                              {marketingCampaignPreviewText}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => void handleRequestMarketingCampaign()}
                          disabled={
                            actionLoading === "marketing-campaign" || !canRequestMarketingCampaign
                          }
                        >
                          {t("finances.launchMarketingCampaign")}
                        </Button>
                      </div>
                      {marketingCampaignDisabledReason ? (
                        <p className="text-caption text-fg-muted">
                          {marketingCampaignDisabledReason}
                        </p>
                      ) : null}
                      {marketingCampaignFeedback ? (
                        <p
                          className={
                            marketingCampaignFeedback.tone === "error"
                              ? "text-body text-danger"
                              : "text-body text-selected"
                          }
                        >
                          {marketingCampaignFeedback.text}
                        </p>
                      ) : null}
                    </div>
                    {sponsorOffers.length > 0 ? (
                      sponsorOffers.map((message) => {
                        const sponsorAction = message.actions.find(
                          (action) => !action.resolved && isChooseOptionAction(action.action_type),
                        );

                        if (!sponsorAction || !isChooseOptionAction(sponsorAction.action_type)) {
                          return null;
                        }

                        return (
                          <div
                            key={message.id}
                            className="rounded-control border border-line bg-panel p-4 space-y-3"
                          >
                            <div className="space-y-1">
                              <h3 className="font-semibold text-body text-fg">{message.subject}</h3>
                              <p className="text-body text-fg-muted">{message.body}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {sponsorAction.action_type.ChooseOption.options.map((option) => {
                                const optionLoadingKey = `sponsor:${message.id}:${option.id}`;

                                return (
                                  <div
                                    key={option.id}
                                    className="min-w-55 flex-1 rounded-control border border-line bg-sunken p-3 space-y-2"
                                  >
                                    <p className="text-caption text-fg-muted">
                                      {option.description}
                                    </p>
                                    <Button
                                      disabled={actionLoading === optionLoadingKey}
                                      onClick={() =>
                                        void handleSponsorOption(
                                          message.id,
                                          sponsorAction.id,
                                          option.id,
                                        )
                                      }
                                      size="sm"
                                      variant={option.id === "decline" ? "outline" : "primary"}
                                    >
                                      {option.label}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-body text-fg-muted">
                        {t("finances.noPendingSponsorOffers")}
                      </p>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
          {detailTab === "facilities" && (
            <FinancesFacilitiesCard
              facilities={facilities}
              facilityUpgrades={financeData.previews.facilityUpgrades}
              previewsCurrent={previewsCurrent}
              facilityUpgradeError={facilityUpgradeError}
              actionLoading={actionLoading}
              onUpgrade={(facility) => void handleUpgradeFacility(facility)}
            />
          )}
          {detailTab === "payroll" && (
            <FinancesPayrollTable roster={roster} onSelectPlayer={onSelectPlayer} />
          )}
        </TabPanel>
      </div>
    </div>
  );
}
