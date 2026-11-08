import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar as CalendarIcon, Globe, TableProperties, Trophy } from "lucide-react";

import {
  getActiveCompetitions,
  getNationalTeamFixtures,
  getNationalTeamName,
  getPromotionRelegationZones,
  getTeamName,
  formatMatchDate,
  getFixtureDisplayLabel,
  getUserCalledUpPlayers,
  nationalTeamDisplayName,
} from "../../lib/helpers";
import { competitionDisplayName } from "../../lib/competitionName";
import type { GameStateData, LeagueData } from "../../store/gameStore";
import {
  fetchSchedule,
  type MatchdayGroup,
  type ScheduleSlice,
} from "../../services/scheduleService";
import { getErrorMessage, resolveTranslatedErrorMessage } from "../../utils/errorMessage";
import ContextMenu, { type ContextMenuItem } from "../ContextMenu";
import { Badge, Card, CardBody, Select } from "../ui";
import ScheduleCalendarGrid from "./ScheduleCalendarGrid";
import MovedFromNote from "./MovedFromNote";

interface ScheduleTabProps {
  gameState: GameStateData;
  onSelectTeam: (id: string) => void;
}

const PAST_PAGE_SIZE = 4;

function sortStandings(competition: LeagueData | null): LeagueData["standings"] {
  if (!competition) return [];
  return [...competition.standings].sort(
    (a, b) =>
      b.points - a.points ||
      b.goals_for - b.goals_against - (a.goals_for - a.goals_against) ||
      b.goals_for - a.goals_for,
  );
}

type View = "calendar" | "fixtures" | "standings" | "international";

export default function ScheduleTab({ gameState, onSelectTeam }: ScheduleTabProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("calendar");
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null);
  const [slice, setSlice] = useState<ScheduleSlice | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [visiblePastCount, setVisiblePastCount] = useState(PAST_PAGE_SIZE);
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const userTeamId = gameState.manager.team_id;
  const activeCompetitions = getActiveCompetitions(gameState);
  const userCompetitions = activeCompetitions.filter((c) =>
    c.participant_ids?.includes(userTeamId ?? ""),
  );
  const nationalFixtures = getNationalTeamFixtures(gameState);
  const hasInternational = nationalFixtures.length > 0;
  const calledUpPlayers = getUserCalledUpPlayers(gameState);
  const seasonContext = gameState.season_context;
  const isPreseason = seasonContext.phase === "Preseason";

  // Resolve which competition to show.
  const selectedCompetition =
    activeCompetitions.find((c) => c.id === selectedCompetitionId) ??
    userCompetitions.find((c) => c.standings.length > 0) ??
    activeCompetitions.find((c) => c.standings.length > 0) ??
    userCompetitions[0] ??
    activeCompetitions[0] ??
    null;
  const sliceCompetition = activeCompetitions.find((c) => c.id === slice?.competition_id);
  const sliceCompetitionName = sliceCompetition
    ? competitionDisplayName(sliceCompetition, t)
    : (slice?.competition_name ?? "");

  // Initialise the competition selection.
  useEffect(() => {
    if (activeCompetitions.length === 0) {
      if (selectedCompetitionId !== null) setSelectedCompetitionId(null);
      return;
    }
    const hasSelection = activeCompetitions.some((c) => c.id === selectedCompetitionId);
    if (hasSelection) return;
    const preferred =
      userCompetitions.find((c) => c.standings.length > 0)?.id ??
      activeCompetitions.find((c) => c.standings.length > 0)?.id ??
      userCompetitions[0]?.id ??
      activeCompetitions[0].id;
    setSelectedCompetitionId(preferred);
  }, [activeCompetitions, selectedCompetitionId, userCompetitions]);

  // Fetch schedule slice whenever the competition changes.
  useEffect(() => {
    if (!selectedCompetition) {
      setSlice(null);
      return;
    }
    let cancelled = false;
    fetchSchedule({ competition_id: selectedCompetition.id })
      .then((result) => {
        if (cancelled) return;
        setSlice(result);
        setFetchError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchError(resolveTranslatedErrorMessage(getErrorMessage(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompetition?.id, t]);

  // Reset past-group paging when competition changes.
  useEffect(() => {
    setVisiblePastCount(PAST_PAGE_SIZE);
  }, [selectedCompetition?.id]);

  const scrollToDate = useCallback((date: string) => {
    const el = groupRefs.current.get(date);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Auto-scroll to the next user fixture on load when mid-season (past groups present).
  useEffect(() => {
    if (!slice?.next_user_match_date || slice.past_groups.length === 0) return;
    const date = slice.next_user_match_date;
    const id = setTimeout(() => scrollToDate(date), 50);
    return () => clearTimeout(id);
  }, [slice?.competition_id, slice?.next_user_match_date, slice?.past_groups.length, scrollToDate]);

  const buildTeamMenuItem = (label: string, teamId: string): ContextMenuItem => ({
    label,
    onClick: () => onSelectTeam(teamId),
  });

  if (activeCompetitions.length === 0) {
    return <p className="py-8 text-center text-fg-muted">{t("schedule.noLeague")}</p>;
  }

  const competitionSwitcher = activeCompetitions.length > 1 && (
    <Select
      value={selectedCompetition?.id ?? ""}
      onChange={(e) => setSelectedCompetitionId(e.target.value)}
      wrapperClassName="ml-auto"
      aria-label={t("common.competition")}
    >
      {activeCompetitions.map((c) => (
        <option key={c.id} value={c.id}>
          {competitionDisplayName(c, t)}
        </option>
      ))}
    </Select>
  );

  return (
    <div>
      {isPreseason && (
        <Card accent="accent" className="mb-5">
          <CardBody>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent" size="sm">
                  {t(`season.phases.${seasonContext.phase}`)}
                </Badge>
                <span className="text-body font-heading font-bold text-fg">
                  {seasonContext.season_start
                    ? t("season.startsOn", { date: formatMatchDate(seasonContext.season_start) })
                    : t("season.noOpener")}
                </span>
              </div>
              <p className="text-caption text-fg-muted">{t("season.standingsLocked")}</p>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        <ViewButton active={view === "calendar"} onClick={() => setView("calendar")}>
          <CalendarIcon className="mr-1.5 inline h-4 w-4 -mt-0.5" />
          {t("schedule.calendar.title", "Calendar")}
        </ViewButton>
        <ViewButton active={view === "fixtures"} onClick={() => setView("fixtures")}>
          <TableProperties className="mr-1.5 inline h-4 w-4 -mt-0.5" />
          {t("schedule.fixtures")}
        </ViewButton>
        <ViewButton active={view === "standings"} onClick={() => setView("standings")}>
          <Trophy className="mr-1.5 inline h-4 w-4 -mt-0.5" />
          {t("schedule.standings")}
        </ViewButton>
        {hasInternational && (
          <ViewButton active={view === "international"} onClick={() => setView("international")}>
            <Globe className="mr-1.5 inline h-4 w-4 -mt-0.5" />
            {t("schedule.international")}
          </ViewButton>
        )}
        {competitionSwitcher}
      </div>

      {fetchError && (
        <p role="alert" className="mb-4 text-body text-danger">
          {fetchError}
        </p>
      )}

      {view === "calendar" && (
        <CalendarView
          slice={slice}
          competitionName={sliceCompetitionName}
          userTeamId={userTeamId ?? null}
          groupRefs={groupRefs}
          visiblePastCount={visiblePastCount}
          onShowMorePast={() => setVisiblePastCount((n) => n + PAST_PAGE_SIZE)}
          onScrollToDate={scrollToDate}
          onSelectTeam={onSelectTeam}
          buildTeamMenuItem={buildTeamMenuItem}
          t={t}
        />
      )}

      {view === "fixtures" && (
        <FixturesListView
          slice={slice}
          competitionName={sliceCompetitionName}
          userTeamId={userTeamId ?? null}
          groupRefs={groupRefs}
          onSelectTeam={onSelectTeam}
          buildTeamMenuItem={buildTeamMenuItem}
          t={t}
        />
      )}

      {view === "international" && (
        <InternationalView
          gameState={gameState}
          calledUpPlayers={calledUpPlayers}
          nationalFixtures={nationalFixtures}
          t={t}
        />
      )}

      {view === "standings" && (
        <StandingsView
          competition={selectedCompetition}
          userTeamId={userTeamId ?? null}
          isPreseason={isPreseason}
          seasonContext={seasonContext}
          onSelectTeam={onSelectTeam}
          buildTeamMenuItem={buildTeamMenuItem}
          gameState={gameState}
          t={t}
        />
      )}
    </div>
  );
}

// ─── Sub-views ──────────────────────────────────────────────────────────────

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-control px-4 py-2 font-heading text-body font-bold uppercase tracking-label transition-all ${
        active
          ? "bg-selected-fill text-on-brand shadow-md shadow-card"
          : "border border-line bg-panel text-fg-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function CalendarView({
  slice,
  competitionName,
  userTeamId,
  groupRefs,
  visiblePastCount,
  onShowMorePast,
  onScrollToDate,
  onSelectTeam,
  buildTeamMenuItem,
  t,
}: {
  slice: ScheduleSlice | null;
  competitionName: string;
  userTeamId: string | null;
  groupRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  visiblePastCount: number;
  onShowMorePast: () => void;
  onScrollToDate: (date: string) => void;
  onSelectTeam: (id: string) => void;
  buildTeamMenuItem: (label: string, teamId: string) => ContextMenuItem;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (!slice) return <LoadingPlaceholder />;

  const allGroups = [...slice.upcoming_groups, ...slice.past_groups];
  const visiblePastGroups = slice.past_groups.slice(0, visiblePastCount);

  return (
    <div className="flex flex-col gap-5">
      <ScheduleCalendarGrid
        groups={allGroups}
        userTeamId={userTeamId}
        today={slice.today}
        focusDate={slice.next_user_match_date}
        onSelectDate={onScrollToDate}
      />

      {/* Upcoming groups */}
      {slice.upcoming_groups.length > 0 ? (
        <div className="flex flex-col gap-4">
          {slice.upcoming_groups.map((group) => (
            <MatchdayGroupCard
              key={group.key}
              group={group}
              userTeamId={userTeamId}
              groupRefs={groupRefs}
              competitionName={competitionName}
              onSelectTeam={onSelectTeam}
              buildTeamMenuItem={buildTeamMenuItem}
              t={t}
            />
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-body text-fg-muted">
          {t("schedule.noUpcoming", "No upcoming fixtures.")}
        </p>
      )}

      {/* Past groups */}
      {visiblePastGroups.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-hover" />
            <span className="text-caption font-heading font-bold uppercase tracking-label text-fg-subtle">
              {t("schedule.pastResults", "Past results")}
            </span>
            <div className="flex-1 h-px bg-hover" />
          </div>
          <div className="flex flex-col gap-4">
            {visiblePastGroups.map((group) => (
              <MatchdayGroupCard
                key={group.key}
                group={group}
                userTeamId={userTeamId}
                groupRefs={groupRefs}
                competitionName={competitionName}
                dimmed
                onSelectTeam={onSelectTeam}
                buildTeamMenuItem={buildTeamMenuItem}
                t={t}
              />
            ))}
          </div>
          {slice.past_groups.length > visiblePastCount && (
            <button
              type="button"
              onClick={onShowMorePast}
              className="mx-auto mt-1 rounded-control border border-line bg-panel px-4 py-2 font-heading text-body font-bold uppercase tracking-label text-fg-muted transition-all hover:text-fg"
            >
              {t("schedule.loadMore")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FixturesListView({
  slice,
  competitionName,
  userTeamId,
  groupRefs,
  onSelectTeam,
  buildTeamMenuItem,
  t,
}: {
  slice: ScheduleSlice | null;
  competitionName: string;
  userTeamId: string | null;
  groupRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onSelectTeam: (id: string) => void;
  buildTeamMenuItem: (label: string, teamId: string) => ContextMenuItem;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (!slice) return <LoadingPlaceholder />;

  const allGroups = [...slice.upcoming_groups, ...slice.past_groups];

  if (allGroups.length === 0) {
    return <p className="py-8 text-center text-fg-muted">{t("schedule.noLeague")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {allGroups.map((group) => (
        <MatchdayGroupCard
          key={group.key}
          group={group}
          userTeamId={userTeamId}
          groupRefs={groupRefs}
          competitionName={competitionName}
          onSelectTeam={onSelectTeam}
          buildTeamMenuItem={buildTeamMenuItem}
          t={t}
        />
      ))}
    </div>
  );
}

function groupLabel(
  group: MatchdayGroup,
  competitionName: string,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const date = formatMatchDate(group.date);
  if (group.competition === "League" && group.matchday <= 0) {
    return `${competitionName} – ${date}`;
  }
  const label = getFixtureDisplayLabel(t, group, competitionName);
  // A friendly belongs to no competition, and a cup's label already is its name.
  if (group.competition === "Friendly" || label === competitionName) {
    return `${label} – ${date}`;
  }
  return `${competitionName} – ${label} – ${date}`;
}

function MatchdayGroupCard({
  group,
  userTeamId,
  groupRefs,
  competitionName,
  dimmed = false,
  onSelectTeam,
  buildTeamMenuItem,
  t,
}: {
  group: MatchdayGroup;
  userTeamId: string | null;
  groupRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  competitionName: string;
  dimmed?: boolean;
  onSelectTeam: (id: string) => void;
  buildTeamMenuItem: (label: string, teamId: string) => ContextMenuItem;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const setRef = (el: HTMLDivElement | null) => {
    if (el) {
      groupRefs.current.set(group.date, el);
    } else {
      groupRefs.current.delete(group.date);
    }
  };

  return (
    <div ref={setRef} data-group-key={group.key}>
      <Card className={dimmed ? "opacity-70" : undefined}>
        <div className="rounded-t-xl border-b border-line bg-sunken px-5 py-3">
          <div className="flex items-center gap-2">
            {group.is_next_user_match && (
              <Badge variant="primary" size="sm">
                {t("schedule.nextMatch", "Next match")}
              </Badge>
            )}
            <h4 className="font-heading text-body font-bold uppercase tracking-label text-fg-muted">
              {groupLabel(group, competitionName, t)}
            </h4>
          </div>
        </div>
        <CardBody className="p-0">
          <div className="divide-y divide-line">
            {group.fixtures.map((fixture) => {
              const isUserMatch =
                fixture.home_team_id === userTeamId || fixture.away_team_id === userTeamId;
              const completed = fixture.status === "Completed";
              const contextItems = [
                buildTeamMenuItem(
                  `${t("common.viewTeam")}: ${fixture.home_team_name}`,
                  fixture.home_team_id,
                ),
                buildTeamMenuItem(
                  `${t("common.viewTeam")}: ${fixture.away_team_name}`,
                  fixture.away_team_id,
                ),
              ];

              return (
                <ContextMenu items={contextItems} key={fixture.id}>
                  <div
                    className={`flex items-center px-5 py-3 transition-colors ${
                      isUserMatch ? "bg-selected-tint" : ""
                    }`}
                    data-testid={`schedule-fixture-${fixture.id}`}
                  >
                    <span
                      onClick={() => onSelectTeam(fixture.home_team_id)}
                      className={`flex-1 cursor-pointer text-right text-body font-semibold hover:underline ${
                        fixture.home_team_id === userTeamId ? "text-selected" : "text-fg"
                      }`}
                    >
                      {fixture.home_team_name}
                    </span>
                    <div className="mx-3 w-24 text-center">
                      {completed && fixture.result ? (
                        <span className="font-heading text-lead font-bold text-fg">
                          {fixture.result.home_goals} - {fixture.result.away_goals}
                        </span>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          vs
                        </Badge>
                      )}
                      {fixture.rescheduled_from && (
                        <MovedFromNote
                          originalDate={fixture.rescheduled_from}
                          testId={`moved-from-${fixture.id}`}
                        />
                      )}
                    </div>
                    <span
                      onClick={() => onSelectTeam(fixture.away_team_id)}
                      className={`flex-1 cursor-pointer text-left text-body font-semibold hover:underline ${
                        fixture.away_team_id === userTeamId ? "text-selected" : "text-fg"
                      }`}
                    >
                      {fixture.away_team_name}
                    </span>
                  </div>
                </ContextMenu>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function InternationalView({
  gameState,
  calledUpPlayers,
  nationalFixtures,
  t,
}: {
  gameState: GameStateData;
  calledUpPlayers: ReturnType<typeof getUserCalledUpPlayers>;
  nationalFixtures: ReturnType<typeof getNationalTeamFixtures>;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const internationalByDate = new Map<string, typeof nationalFixtures>();
  [...nationalFixtures]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .forEach((fixture) => {
      const list = internationalByDate.get(fixture.date) ?? [];
      list.push(fixture);
      internationalByDate.set(fixture.date, list);
    });

  return (
    <div className="flex flex-col gap-4">
      {calledUpPlayers.length > 0 && (
        <Card accent="accent">
          <div className="rounded-t-xl border-b border-line bg-sunken px-5 py-3">
            <h4 className="flex items-center gap-2 font-heading text-body font-bold uppercase tracking-label text-fg-muted">
              <Globe className="h-4 w-4 text-warning" />
              {t("schedule.internationalDuty")}
            </h4>
          </div>
          <CardBody className="p-0">
            <div className="divide-y divide-line">
              {calledUpPlayers.map(
                ({ player, nationalTeamId, nationalTeamName, nationalTeamNameKey }) => (
                  <div
                    key={`${player.id}-${nationalTeamId}`}
                    className="flex items-center justify-between px-5 py-2.5"
                    data-testid={`schedule-callup-${player.id}`}
                  >
                    <span className="text-body font-semibold text-fg">{player.match_name}</span>
                    <Badge variant="neutral" size="sm">
                      {nationalTeamDisplayName(nationalTeamNameKey, nationalTeamName, t)}
                    </Badge>
                  </div>
                ),
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {Array.from(internationalByDate.entries()).map(([date, fixtures]) => (
        <Card key={date}>
          <div className="rounded-t-xl border-b border-line bg-sunken px-5 py-3">
            <h4 className="font-heading text-body font-bold uppercase tracking-label text-fg-muted">
              {t("schedule.international")} - {formatMatchDate(date)}
            </h4>
          </div>
          <CardBody className="p-0">
            <div className="divide-y divide-line">
              {fixtures.map((fixture) => {
                const completed = fixture.status === "Completed";
                return (
                  <div
                    key={fixture.id}
                    className="flex items-center px-5 py-3"
                    data-testid={`schedule-international-${fixture.id}`}
                  >
                    <span className="flex-1 text-right text-body font-semibold text-fg">
                      {getNationalTeamName(gameState, fixture.home_team_id, t)}
                    </span>
                    <div className="mx-3 w-24 text-center">
                      {completed && fixture.result ? (
                        <span className="font-heading text-lead font-bold text-fg">
                          {fixture.result.home_goals} - {fixture.result.away_goals}
                        </span>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          vs
                        </Badge>
                      )}
                    </div>
                    <span className="flex-1 text-left text-body font-semibold text-fg">
                      {getNationalTeamName(gameState, fixture.away_team_id, t)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function StandingsView({
  competition,
  userTeamId,
  isPreseason,
  seasonContext,
  onSelectTeam,
  buildTeamMenuItem,
  gameState,
  t,
}: {
  competition: LeagueData | null;
  userTeamId: string | null;
  isPreseason: boolean;
  seasonContext: GameStateData["season_context"];
  onSelectTeam: (id: string) => void;
  buildTeamMenuItem: (label: string, teamId: string) => ContextMenuItem;
  gameState: GameStateData;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const standings = sortStandings(competition);
  const zones = competition
    ? getPromotionRelegationZones(getActiveCompetitions(gameState), competition)
    : { promotionSlots: 0, relegationSlots: 0 };

  if (isPreseason) {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Trophy className="h-8 w-8 text-fg-subtle" />
            <p className="text-body font-heading font-bold text-fg">
              {t("season.standingsLocked")}
            </p>
            <p className="text-caption text-fg-muted">
              {seasonContext.season_start
                ? t("season.startsOn", { date: formatMatchDate(seasonContext.season_start) })
                : t("season.noOpener")}
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <div className="rounded-t-xl border-b border-line bg-panel p-5">
        <h3 className="flex items-center gap-2 font-heading text-lead font-bold uppercase tracking-label text-fg">
          <Trophy className="h-5 w-5 text-warning" />
          {(competition && competitionDisplayName(competition, t)) || t("schedule.fixtures")} –{" "}
          {t("schedule.season", { number: competition?.season ?? 0 })}
        </h3>
      </div>
      {standings.length === 0 ? (
        <CardBody>
          <p className="py-6 text-center text-body text-fg-muted">
            {t("schedule.standingsUnavailable")}
          </p>
        </CardBody>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-sunken text-caption">
                {[
                  "#",
                  t("common.team"),
                  t("common.played"),
                  t("common.won"),
                  t("common.drawn"),
                  t("common.lost"),
                  t("common.gf"),
                  t("common.ga"),
                  t("common.gd"),
                  t("common.pts"),
                ].map((header, idx) => (
                  <th
                    key={idx}
                    className={`px-4 py-3 font-heading font-bold uppercase tracking-label text-fg-muted ${idx === 0 ? "w-8" : ""} ${idx >= 2 ? "text-center" : ""}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {standings.map((entry, index) => {
                const isUser = entry.team_id === userTeamId;
                const gd = entry.goals_for - entry.goals_against;
                const inPromotionZone = index < zones.promotionSlots;
                const inRelegationZone =
                  zones.relegationSlots > 0 && index >= standings.length - zones.relegationSlots;
                const contextItems = [buildTeamMenuItem(t("common.viewTeam"), entry.team_id)];

                return (
                  <ContextMenu items={contextItems} key={entry.team_id}>
                    <tr
                      className={`transition-colors ${
                        isUser ? "bg-selected-tint" : "hover:bg-hover/50"
                      }`}
                      data-testid={`schedule-standings-row-${entry.team_id}`}
                    >
                      <td
                        className={`px-4 py-3 font-heading text-body font-bold ${
                          inPromotionZone
                            ? "border-l-2 border-selected text-selected"
                            : inRelegationZone
                              ? "border-l-2 border-danger text-danger"
                              : "text-fg-subtle"
                        }`}
                        data-testid={
                          inPromotionZone
                            ? `standings-promotion-${entry.team_id}`
                            : inRelegationZone
                              ? `standings-relegation-${entry.team_id}`
                              : undefined
                        }
                      >
                        {index + 1}
                      </td>
                      <td
                        onClick={() => onSelectTeam(entry.team_id)}
                        className={`cursor-pointer px-4 py-3 text-body font-semibold hover:underline ${
                          isUser ? "text-selected" : "text-fg"
                        }`}
                      >
                        {getTeamName(gameState.teams, entry.team_id)}
                      </td>
                      {[
                        entry.played,
                        entry.won,
                        entry.drawn,
                        entry.lost,
                        entry.goals_for,
                        entry.goals_against,
                      ].map((val, i) => (
                        <td
                          key={i}
                          className="px-4 py-3 text-center text-body tabular-nums text-fg-muted"
                        >
                          {val}
                        </td>
                      ))}
                      <td
                        className={`px-4 py-3 text-center text-body font-semibold tabular-nums ${
                          gd > 0 ? "text-selected" : gd < 0 ? "text-danger" : "text-fg-muted"
                        }`}
                      >
                        {gd > 0 ? `+${gd}` : gd}
                      </td>
                      <td className="px-4 py-3 text-center font-heading text-body font-bold tabular-nums text-fg">
                        {entry.points}
                      </td>
                    </tr>
                  </ContextMenu>
                );
              })}
            </tbody>
          </table>
          {(zones.promotionSlots > 0 || zones.relegationSlots > 0) && (
            <div className="flex gap-5 border-t border-line px-4 py-2.5 text-caption text-fg-muted">
              {zones.promotionSlots > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-selected-fill" />
                  {t("schedule.promotionZone")}
                </span>
              )}
              {zones.relegationSlots > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-danger-solid" />
                  {t("schedule.relegationZone")}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function LoadingPlaceholder() {
  return (
    <div className="flex flex-col gap-4">
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-32 rounded-panel bg-hover animate-pulse" />
      ))}
    </div>
  );
}
