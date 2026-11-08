import { useEffect, useRef, useState } from "react";
import { type GameStateData, type StaffData, useGameStore } from "../../store/gameStore";
import { visibleRatingText } from "../../lib/playerKnowledge";
import { getStaff, type StaffRow, type StaffSlice } from "../../services/staffService";
import { useListView } from "../../hooks/useListView";
import { Card, CardBody, Badge, CountryFlag, ProgressBar, RatingChip, ViewSwitch } from "../ui";
import { staffMenuItems } from "./StaffTab.menu";
import StaffTable from "./StaffTable";
import {
  UserCog,
  Search,
  UserPlus,
  UserMinus,
  Briefcase,
  Eye,
  Stethoscope,
  GraduationCap,
  Star,
} from "lucide-react";
import { getTeamName, calcAge, formatWeeklyWage } from "../../lib/helpers";
import { countryName } from "../../lib/countries";
import { useTranslation } from "react-i18next";
import { hireStaff, releaseStaff } from "../../services/staffService";
import ContextMenu from "../ContextMenu";
import type { DashboardNavigateContext } from "../dashboard/dashboardProfileNavigation";

interface StaffTabProps {
  gameState: GameStateData | null;
  onGameUpdate?: (state: GameStateData) => void;
  onNavigate?: (tab: string, context?: DashboardNavigateContext) => void;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  AssistantManager: <Briefcase className="w-4 h-4" />,
  Coach: <GraduationCap className="w-4 h-4" />,
  Scout: <Eye className="w-4 h-4" />,
  Physio: <Stethoscope className="w-4 h-4" />,
};
const ROLE_COLORS: Record<string, string> = {
  AssistantManager: "text-info",
  Coach: "text-selected",
  Scout: "text-warning",
  Physio: "text-danger",
};

function bestAttr(s: StaffData): { key: string; value: number } {
  const attrs = [
    { key: "coaching", value: s.attributes.coaching },
    { key: "judgingAbility", value: s.attributes.judgingAbility },
    { key: "judgingPotential", value: s.attributes.judgingPotential },
    { key: "physiotherapy", value: s.attributes.physiotherapy },
  ];
  return attrs.reduce((a, b) => (b.value > a.value ? b : a));
}

export default function StaffTab({ gameState, onGameUpdate, onNavigate }: StaffTabProps) {
  const { t, i18n } = useTranslation();
  const { sessionState } = useGameStore();
  const [fetchedStaff, setFetchedStaff] = useState<StaffSlice | null>(null);
  const [view, setView] = useState<"mystaff" | "available">("mystaff");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // The Table/Cards choice every list shares; `view` above is this page's own My staff/Available.
  const [listView, setListView] = useListView();
  /** The newest staff refresh asked for; an older one that answers late is dropped. */
  const latestRefresh = useRef(0);

  const teamId = sessionState?.manager?.team_id ?? gameState?.manager?.team_id ?? null;

  useEffect(() => {
    if (!teamId) return;
    // The first fetch takes a refresh number too, so a hire's refresh that answers before it wins.
    const refresh = ++latestRefresh.current;
    void getStaff(teamId)
      .then((slice) => {
        if (refresh === latestRefresh.current) setFetchedStaff(slice);
      })
      .catch(() => {});
  }, [teamId]);

  const openScoutingWorkflowLabel = t("staff.openScoutingWorkflow");

  const myStaff: StaffRow[] =
    fetchedStaff?.team_staff ?? gameState?.staff.filter((s) => s.team_id === teamId) ?? [];
  const availableStaff: StaffRow[] =
    fetchedStaff?.available_staff ?? gameState?.staff.filter((s) => !s.team_id) ?? [];
  const assignments = fetchedStaff?.scouting_assignments ?? gameState?.scouting_assignments ?? [];
  const youthAssignments =
    fetchedStaff?.youth_scouting_assignments ?? gameState?.youth_scouting_assignments ?? [];

  const applyStaffUpdate = async (updated: GameStateData) => {
    onGameUpdate?.(updated);
    // The slice carries each member's rating, which the game state doesn't: ask for it again, and
    // fall back to the game state's staff (unrated) only if that fails. Two hires in quick
    // succession ask twice; only the newer answer may land, or a late older one would undo it.
    const refresh = ++latestRefresh.current;
    const refetched = teamId ? await getStaff(teamId).catch(() => null) : null;
    if (refresh !== latestRefresh.current) return;
    setFetchedStaff(
      refetched ?? {
        team_staff: updated.staff.filter((s) => s.team_id === teamId),
        available_staff: updated.staff.filter((s) => !s.team_id),
        scouting_assignments: updated.scouting_assignments,
        youth_scouting_assignments: updated.youth_scouting_assignments ?? [],
      },
    );
  };

  const handleHire = async (staffId: string) => {
    setActionLoading(staffId);
    try {
      await applyStaffUpdate(await hireStaff(staffId));
    } catch (err) {
      console.error("Failed to hire staff:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRelease = async (staffId: string) => {
    setActionLoading(staffId);
    try {
      await applyStaffUpdate(await releaseStaff(staffId));
    } catch (err) {
      console.error("Failed to release staff:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const displayStaff = view === "mystaff" ? myStaff : availableStaff;

  const filtered = displayStaff.filter((s) => {
    if (roleFilter && s.role !== roleFilter) return false;
    if (search.length >= 2) {
      const q = search.toLowerCase();
      // The name shown and the full name both find the person; which one is shown is the
      // backend's call (`display_name`).
      const names = [s.display_name, `${s.first_name} ${s.last_name}`].map((name) =>
        name.toLowerCase(),
      );
      if (!names.some((name) => name.includes(q))) return false;
    }
    return true;
  });

  const roles = ["AssistantManager", "Coach", "Scout", "Physio"];

  /** A member's actions, the same on his card and on his table row. */
  const menuItemsFor = (staff: StaffRow) =>
    staffMenuItems(staff, {
      t,
      list: view,
      pendingId: actionLoading,
      onHire: handleHire,
      onRelease: handleRelease,
      onNavigate,
    });

  return (
    <div>
      {/* View toggle */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView("mystaff")}
            className={`px-4 py-2 rounded-control font-heading font-bold text-body uppercase tracking-label transition-all flex items-center gap-1.5 ${
              view === "mystaff"
                ? "bg-selected-fill text-on-brand shadow-md shadow-card"
                : "bg-panel text-fg-muted border border-line"
            }`}
          >
            <UserCog className="w-4 h-4" /> {t("staff.myStaff", { count: myStaff.length })}
          </button>
          <button
            type="button"
            onClick={() => setView("available")}
            className={`px-4 py-2 rounded-control font-heading font-bold text-body uppercase tracking-label transition-all flex items-center gap-1.5 ${
              view === "available"
                ? "bg-selected-fill text-on-brand shadow-md shadow-card"
                : "bg-panel text-fg-muted border border-line"
            }`}
          >
            <UserPlus className="w-4 h-4" />{" "}
            {t("staff.available", { count: availableStaff.length })}
          </button>
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            type="text"
            placeholder={t("staff.searchStaff")}
            aria-label={t("staff.searchStaff")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-control bg-panel border border-line text-body text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-selected/50"
          />
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setRoleFilter(null)}
            className={`px-3 py-1.5 rounded-control text-caption font-heading font-bold uppercase tracking-label transition-all ${
              !roleFilter
                ? "bg-selected-fill text-on-brand shadow-sm"
                : "bg-panel text-fg-muted border border-line"
            }`}
          >
            {t("common.all")}
          </button>
          {roles.map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRoleFilter(roleFilter === r ? null : r)}
              className={`px-3 py-1.5 rounded-control text-caption font-heading font-bold uppercase tracking-label transition-all flex items-center gap-1 ${
                roleFilter === r
                  ? "bg-selected-fill text-on-brand shadow-sm"
                  : "bg-panel text-fg-muted border border-line"
              }`}
            >
              {ROLE_ICONS[r]} {t(`staff.roles.${r}`)}
            </button>
          ))}
        </div>
        <ViewSwitch value={listView} onChange={setListView} />
      </div>

      {/* Staff grid */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <UserCog className="w-12 h-12 text-fg-subtle mx-auto mb-3" />
          <p className="text-body text-fg-subtle">
            {view === "mystaff" ? t("staff.noStaffMatch") : t("staff.noAvailableStaff")}
          </p>
        </div>
      ) : listView === "table" ? (
        <StaffTable
          label={
            view === "mystaff"
              ? t("staff.myStaff", { count: myStaff.length })
              : t("staff.available", { count: availableStaff.length })
          }
          rows={filtered}
          menuItemsFor={menuItemsFor}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((staff) => {
            const roleIcon = ROLE_ICONS[staff.role] || ROLE_ICONS.Coach;
            const roleColor = ROLE_COLORS[staff.role] || ROLE_COLORS.Coach;
            const age = calcAge(staff.date_of_birth);
            const ovr = staff.rating;
            const best = bestAttr(staff);
            const isLoading = actionLoading === staff.id;
            const scoutingLoad =
              assignments.filter((a) => a.scout_id === staff.id).length +
              youthAssignments.filter((a) => a.scout_id === staff.id).length;
            const youthLoad = youthAssignments.filter((a) => a.scout_id === staff.id).length;
            const scoutingLoadLabel = `${scoutingLoad} ${t(
              scoutingLoad === 1 ? "staff.activeAssignment" : "staff.activeAssignments",
            )}`;
            const youthLoadLabel = `${youthLoad} ${t(
              youthLoad === 1 ? "staff.youthSearch" : "staff.youthSearches",
            )}`;
            const contextItems = menuItemsFor(staff);
            const staffCard = (
              <div data-testid={`staff-card-${staff.id}`} className="h-full">
                <Card className="h-full">
                  <CardBody>
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div
                        className={`w-12 h-12 rounded-panel flex items-center justify-center ${roleColor} bg-hover`}
                      >
                        {roleIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-heading font-bold text-body text-fg uppercase tracking-label truncate">
                            {staff.display_name}
                          </h3>
                          {ovr === undefined || staff.tier === undefined ? (
                            // A rating without its tier is not painted: the chip never picks one.
                            <Badge variant="neutral" size="md">
                              {visibleRatingText(null)} {t("common.ovr")}
                            </Badge>
                          ) : (
                            // The tone is the backend's tier among his own role (staff_tier).
                            <RatingChip value={ovr} tier={staff.tier} size="md" />
                          )}
                        </div>
                        <p className="text-caption text-fg-muted mt-0.5">
                          {t(`staff.roles.${staff.role}`)} — {t("common.age")} {age}
                          <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
                            <CountryFlag
                              code={staff.nationality}
                              locale={i18n.language}
                              className="text-caption leading-none"
                            />
                            <span>{countryName(staff.nationality, i18n.language)}</span>
                          </span>
                          {staff.team_id && view === "available" && (
                            <span className="ml-1.5">
                              @ {getTeamName(gameState?.teams ?? [], staff.team_id)}
                            </span>
                          )}
                        </p>

                        {/* Specialization + Wage */}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {staff.specialization && (
                            <span className="inline-flex items-center gap-1 text-caption bg-warning-solid bg-warning-tint text-warning px-1.5 py-0.5 rounded font-heading uppercase tracking-label">
                              <Star className="w-3 h-3" />{" "}
                              {t(`staff.specializations.${staff.specialization}`)}
                            </span>
                          )}
                          {staff.wage > 0 && (
                            <span className="text-caption bg-hover text-fg-muted px-1.5 py-0.5 rounded font-heading uppercase tracking-label">
                              {formatWeeklyWage(staff.wage, "compact")}
                            </span>
                          )}
                          {staff.role === "Scout" ? (
                            <span className="text-caption bg-selected-tint text-selected px-1.5 py-0.5 rounded font-heading uppercase tracking-label">
                              {scoutingLoadLabel}
                            </span>
                          ) : null}
                          {staff.role === "Scout" && youthLoad > 0 ? (
                            <span className="text-caption bg-warning-solid bg-warning-tint text-warning px-1.5 py-0.5 rounded font-heading uppercase tracking-label">
                              {youthLoadLabel}
                            </span>
                          ) : null}
                        </div>

                        {/* Attributes */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
                          <AttrBar
                            label={t("staff.attrs.coaching")}
                            value={staff.attributes.coaching}
                          />
                          <AttrBar
                            label={t("staff.attrs.judgingAbility")}
                            value={staff.attributes.judgingAbility}
                          />
                          <AttrBar
                            label={t("staff.attrs.judgingPotential")}
                            value={staff.attributes.judgingPotential}
                          />
                          <AttrBar
                            label={t("staff.attrs.physiotherapy")}
                            value={staff.attributes.physiotherapy}
                          />
                        </div>

                        <p className="text-caption text-fg-subtle mt-2">
                          {t("staff.best")}:{" "}
                          <span className="font-medium text-fg-muted">
                            {t(`staff.attrs.${best.key}`)} ({best.value})
                          </span>
                        </p>

                        {staff.role === "Scout" && onNavigate ? (
                          <button
                            type="button"
                            className="mt-3 text-caption font-heading font-bold uppercase tracking-label text-selected hover:text-selected"
                            onClick={() => onNavigate("Scouting")}
                          >
                            {openScoutingWorkflowLabel}
                          </button>
                        ) : null}
                      </div>

                      {/* Action button */}
                      {view === "mystaff" && (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleRelease(staff.id)}
                          className={`p-2 rounded-control bg-danger-tint text-danger hover:bg-danger-tint transition-colors ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
                          title={t("staff.releaseStaff")}
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                      {view === "available" && (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleHire(staff.id)}
                          className={`p-2 rounded-control bg-selected-tint text-selected hover:bg-selected-tint transition-colors ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
                          title={t("staff.hireStaff")}
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </div>
            );

            return (
              <ContextMenu items={contextItems} key={staff.id}>
                {staffCard}
              </ContextMenu>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AttrBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-caption mb-0.5">
        <span className="text-fg-muted">{label}</span>
        <span
          className={`font-heading font-bold tabular-nums ${value >= 70 ? "text-selected" : value >= 50 ? "text-warning" : "text-fg-subtle"}`}
        >
          {value}
        </span>
      </div>
      <ProgressBar
        value={value}
        variant={value >= 70 ? "success" : value >= 50 ? "primary" : "accent"}
        size="sm"
      />
    </div>
  );
}
