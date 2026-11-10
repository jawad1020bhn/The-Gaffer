import type { GameStateData } from "../../store/gameStore";
import {
  Card,
  CardBody,
  CardHeader,
  CountryFlag,
  ProgressBar,
  SceneBackdrop,
  SceneState,
  Ticker,
} from "../ui";
import { ManagerCareerChart } from "./ManagerCareerChart";
import { formatDate } from "../../lib/helpers";
import { useTranslation } from "react-i18next";
import { countryName } from "../../lib/countries";
import ContextMenu from "../ContextMenu";
import { buildViewTeamMenuItem } from "../playerActions/playerContextMenuItems";
import type { BoardMood } from "../../store/generated/BoardMood";
import type { BoardWarning } from "../../store/generated/BoardWarning";
import type { FansMood } from "../../store/generated/FansMood";
import { useManagerStanding } from "./useManagerStanding";

/** The words for each board mood the backend sends; every mood has one. */
const BOARD_MOOD_KEYS: Record<BoardMood, string> = {
  very_pleased: "manager.boardVeryPleased",
  satisfied: "manager.boardSatisfied",
  concerned: "manager.boardConcerns",
  under_threat: "manager.boardThreat",
};

/** The line for each board warning on record, and its colour; none shows nothing. */
const BOARD_WARNING_LINES: Record<Exclude<BoardWarning, "none">, { key: string; tone: string }> = {
  warned: { key: "manager.boardWarned", tone: "text-warning" },
  final_warning: { key: "manager.boardFinalWarning", tone: "text-danger" },
};

/** The words for each fans' mood the backend sends; every mood has one. */
const FANS_MOOD_KEYS: Record<FansMood, string> = {
  adore: "manager.fanAdore",
  behind: "manager.fanBehind",
  mixed: "manager.fanMixed",
  restless: "manager.fanRestless",
  unrest: "manager.fanUnrest",
};

interface ManagerTabProps {
  gameState: GameStateData;
  onSelectTeam?: (id: string) => void;
}

export default function ManagerTab({ gameState, onSelectTeam }: ManagerTabProps) {
  const { t, i18n } = useTranslation();
  const mgr = gameState.manager;
  const standing = useManagerStanding(gameState);
  const myTeam = gameState.teams.find((tm) => tm.id === mgr.team_id);
  const stats = mgr.career_stats;

  return (
    <div className="panel-stagger grid h-full min-h-0 grid-cols-12 grid-rows-[auto_minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
      {/* Profile card */}
      <Card accent="primary" className="relative isolate col-span-12">
        <SceneBackdrop scene="career" strength="hero" />
        <div className="flex items-center gap-6 p-5">
          <div className="w-20 h-20 rounded-panel bg-selected-tint flex items-center justify-center font-heading font-bold text-display text-selected border-2 border-selected/40">
            {mgr.first_name.charAt(0)}
            {mgr.last_name.charAt(0)}
          </div>
          <div>
            <h2 className="text-title font-heading font-bold text-fg uppercase tracking-label">
              {mgr.display_name}
            </h2>
            <p className="text-fg-subtle text-body mt-1">
              <CountryFlag
                code={mgr.nationality}
                locale={i18n.language}
                className="mr-1 text-body leading-none"
              />
              {countryName(mgr.nationality, i18n.language)} • {t("manager.born")}{" "}
              {formatDate(mgr.date_of_birth, i18n.language)}
            </p>
            {myTeam && onSelectTeam ? (
              <ContextMenu items={[buildViewTeamMenuItem(t, () => onSelectTeam(myTeam.id))]}>
                <button
                  type="button"
                  data-testid="manager-current-team"
                  onClick={() => onSelectTeam(myTeam.id)}
                  className="text-selected text-body font-semibold mt-0.5 hover:text-selected transition-colors"
                >
                  {t("manager.managerOf", { team: myTeam.name })}
                </button>
              </ContextMenu>
            ) : myTeam ? (
              <p className="text-selected text-body font-semibold mt-0.5">
                {t("manager.managerOf", { team: myTeam.name })}
              </p>
            ) : null}
          </div>
          <div className="ml-auto rounded-control bg-panel-glass surface-panel px-4 py-2 text-right shadow-panel">
            <p className="text-caption text-fg-subtle font-heading uppercase tracking-label">
              {t("manager.reputation")}
            </p>
            <p className="font-heading font-bold text-title text-warning">{mgr.reputation}</p>
          </div>
        </div>
      </Card>

      {/* Career stats */}
      <Card accent="accent" className="col-span-8">
        <CardHeader>{t("manager.careerStats")}</CardHeader>
        <CardBody>
          <div className="grid h-full grid-cols-6 grid-rows-1 gap-3">
            <StatBlock label={t("manager.matches")} value={stats.matches_managed} />
            <StatBlock label={t("manager.wins")} value={stats.wins} />
            <StatBlock label={t("manager.draws")} value={stats.draws} />
            <StatBlock label={t("manager.losses")} value={stats.losses} />
            <StatBlock label={t("manager.trophies")} value={stats.trophies} />
            <StatBlock
              label={t("manager.winPercent")}
              value={
                stats.matches_managed > 0
                  ? `${((stats.wins / stats.matches_managed) * 100).toFixed(0)}%`
                  : "—"
              }
            />
          </div>
        </CardBody>
      </Card>

      {/* Board satisfaction + Fan approval */}
      <Card className="col-span-4">
        <CardHeader>{t("manager.boardStatus")}</CardHeader>
        <CardBody>
          <div className="grid h-full grid-cols-2 items-center gap-4">
            {/* Board */}
            <div>
              <div className="text-center mb-2">
                <p className="font-heading font-bold text-display text-fg">{mgr.satisfaction}%</p>
                <p className="text-caption text-fg-subtle font-heading uppercase tracking-label mt-0.5">
                  {t("manager.board")}
                </p>
              </div>
              <ProgressBar value={mgr.satisfaction} variant="auto" size="md" />
              <p className="text-caption text-fg-subtle text-center mt-2">
                {standing ? t(BOARD_MOOD_KEYS[standing.board]) : null}
              </p>
              {standing && standing.warning !== "none" ? (
                <p
                  className={`text-caption font-semibold text-center mt-1 ${BOARD_WARNING_LINES[standing.warning].tone}`}
                >
                  {t(BOARD_WARNING_LINES[standing.warning].key)}
                </p>
              ) : null}
            </div>
            {/* Fans */}
            <div>
              <div className="text-center mb-2">
                <p className="font-heading font-bold text-display text-fg">
                  {mgr.fan_approval ?? 50}%
                </p>
                <p className="text-caption text-fg-subtle font-heading uppercase tracking-label mt-0.5">
                  {t("manager.fans")}
                </p>
              </div>
              <ProgressBar value={mgr.fan_approval ?? 50} variant="auto" size="md" />
              <p className="text-caption text-fg-subtle text-center mt-2">
                {standing ? t(FANS_MOOD_KEYS[standing.fans]) : null}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Career history */}
      <Card className="col-span-12">
        <CardHeader>{t("manager.careerHistory")}</CardHeader>
        <CardBody padded={false} className="flex flex-col">
          {mgr.career_history.length === 0 ? (
            <SceneState
              title={t("manager.noHistoryTitle", "No appointments yet")}
              detail={t(
                "manager.noHistoryDetail",
                "This is your first club. Every result you manage here becomes the first line of your record.",
              )}
              className="m-4"
            />
          ) : (
            <>
              <div className="px-4 pt-4 pb-2">
                <ManagerCareerChart
                  history={mgr.career_history}
                  wonLabel={t("manager.wins")}
                  drawnLabel={t("manager.draws")}
                  lostLabel={t("manager.losses")}
                />
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sunken border-b border-line text-caption">
                    <th className="py-3 px-5 font-heading font-bold uppercase tracking-label text-fg-muted">
                      {t("manager.club")}
                    </th>
                    <th className="py-3 px-5 font-heading font-bold uppercase tracking-label text-fg-muted">
                      {t("manager.period")}
                    </th>
                    <th className="py-3 px-5 font-heading font-bold uppercase tracking-label text-fg-muted text-center">
                      {t("common.played")}
                    </th>
                    <th className="py-3 px-5 font-heading font-bold uppercase tracking-label text-fg-muted text-center">
                      {t("common.won")}
                    </th>
                    <th className="py-3 px-5 font-heading font-bold uppercase tracking-label text-fg-muted text-center">
                      {t("common.drawn")}
                    </th>
                    <th className="py-3 px-5 font-heading font-bold uppercase tracking-label text-fg-muted text-center">
                      {t("common.lost")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {mgr.career_history.map((entry, i) => {
                    const canSelectTeam =
                      !!onSelectTeam && gameState.teams.some((team) => team.id === entry.team_id);
                    const historyRow = (
                      <tr
                        key={i}
                        data-testid={`manager-history-${entry.team_id}`}
                        onClick={canSelectTeam ? () => onSelectTeam(entry.team_id) : undefined}
                        onKeyDown={
                          canSelectTeam
                            ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  onSelectTeam(entry.team_id);
                                }
                              }
                            : undefined
                        }
                        role={canSelectTeam ? "button" : undefined}
                        tabIndex={canSelectTeam ? 0 : undefined}
                        className={
                          canSelectTeam
                            ? "cursor-pointer hover:bg-hover/30 transition-colors"
                            : undefined
                        }
                      >
                        <td className="py-3 px-5 font-semibold text-body text-fg">
                          {entry.team_name}
                        </td>
                        <td className="py-3 px-5 text-body text-fg-muted">
                          {entry.start_date.substring(0, 4)} —{" "}
                          {entry.end_date?.substring(0, 4) || t("common.present")}
                        </td>
                        <td className="py-3 px-5 text-center text-body text-fg-muted tabular-nums">
                          {entry.matches}
                        </td>
                        <td className="py-3 px-5 text-center text-body text-fg-muted tabular-nums">
                          {entry.wins}
                        </td>
                        <td className="py-3 px-5 text-center text-body text-fg-muted tabular-nums">
                          {entry.draws}
                        </td>
                        <td className="py-3 px-5 text-center text-body text-fg-muted tabular-nums">
                          {entry.losses}
                        </td>
                      </tr>
                    );

                    if (!canSelectTeam) {
                      return historyRow;
                    }

                    return (
                      <ContextMenu
                        items={[buildViewTeamMenuItem(t, () => onSelectTeam(entry.team_id))]}
                        key={i}
                      >
                        {historyRow}
                      </ContextMenu>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-control bg-sunken surface-well p-3 text-center shadow-well">
      <p className="font-heading text-display font-bold text-fg tabular-nums">
        {typeof value === "number" ? <Ticker value={value} /> : value}
      </p>
      <p className="text-caption text-fg-subtle font-heading uppercase tracking-label mt-0.5">
        {label}
      </p>
    </div>
  );
}
