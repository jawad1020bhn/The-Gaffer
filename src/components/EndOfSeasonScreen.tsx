import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameStateData, SeasonAwardsData } from "../store/gameStore";
import { useGameStore } from "../store/gameStore";
import { invokeForCareer } from "../services/careerInvoke";
import { Card, CardBody } from "./ui";
import { competitionDisplayName } from "../lib/competitionName";
import AwardsCeremonyScreen from "./season/AwardsCeremonyScreen";
import { Trophy, Star, ArrowRight, Crown } from "lucide-react";

export interface EndOfSeasonSummary {
  season: number;
  league_name: string;
  champion_id: string;
  champion_name: string;
  user_position: number;
  user_points: number;
  user_won: number;
  user_drawn: number;
  user_lost: number;
  user_goals_for: number;
  user_goals_against: number;
  golden_boot_player: string;
  golden_boot_goals: number;
  poty_player: string;
  poty_rating: number;
  total_teams: number;
  season_awards: SeasonAwardsData;
}

/**
 * Where the player is once the next season has been started: the awards of the one just played,
 * then the new season's announcement. Held by the dashboard, not here: the same game update that
 * carries the new season says the old one is no longer complete, which unmounts this screen, and
 * what it kept in its own state went with it.
 */
export interface SeasonTransition {
  summary: EndOfSeasonSummary;
  step: "ceremony" | "done";
}

interface EndOfSeasonScreenProps {
  gameState: GameStateData;
  onGameUpdate: (g: GameStateData) => void;
  transition: SeasonTransition | null;
  onTransitionChange: (transition: SeasonTransition | null) => void;
}

export default function EndOfSeasonScreen({
  gameState,
  onGameUpdate,
  transition,
  onTransitionChange,
}: EndOfSeasonScreenProps) {
  const { t } = useTranslation();
  const setShowFiredModal = useGameStore((s) => s.setShowFiredModal);
  const [loading, setLoading] = useState(false);
  const summary = transition?.summary ?? null;
  const step = transition?.step ?? "review";

  const league = gameState.league;
  const userTeamId = gameState.manager.team_id;
  const userTeam = gameState.teams.find((t) => t.id === userTeamId);

  // Compute standings for display
  const standings = league
    ? [...league.standings].sort(
        (a, b) =>
          b.points - a.points ||
          b.goals_for - b.goals_against - (a.goals_for - a.goals_against) ||
          b.goals_for - a.goals_for,
      )
    : [];

  const userStandingIdx = standings.findIndex((s) => s.team_id === userTeamId);
  const userStanding = standings[userStandingIdx];
  // A manager with no club has no place in the table: nothing of a club summary is drawn for them.
  const userHasStanding = userStandingIdx >= 0;
  const userPosition = userStandingIdx + 1;
  const champion = standings[0];
  const championName = gameState.teams.find((t) => t.id === champion?.team_id)?.name || "";
  const isChampion = champion?.team_id === userTeamId;

  const handleAdvance = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await invokeForCareer<{
        action?: string;
        game: GameStateData;
        summary: EndOfSeasonSummary;
      }>("advance_to_next_season");
      if (result.action === "fired") {
        onGameUpdate(result.game);
        setShowFiredModal(true);
        return;
      }
      // The transition first: the game update below is what ends the season this screen reviews.
      onTransitionChange({ summary: result.summary, step: "ceremony" });
      onGameUpdate(result.game);
    } catch (err) {
      console.error("Failed to advance season:", err);
    } finally {
      setLoading(false);
    }
  };

  const posLabel = (pos: number) => {
    if (pos === 1) return t("common.place.1");
    if (pos === 2) return t("common.place.2");
    if (pos === 3) return t("common.place.3");
    return t("common.place.other", { n: pos });
  };

  return (
    <div className="py-8 px-4">
      {step === "review" && (
        <>
          {/* Hero */}
          <div className="text-center mb-8">
            <div
              className={`w-20 h-20 mx-auto rounded-panel flex items-center justify-center mb-4 ${
                isChampion
                  ? "bg-gradient-to-br from-warning-solid to-warning-solid shadow-lg shadow-accent-500/30"
                  : "bg-panel"
              }`}
            >
              {isChampion ? (
                <Crown className="w-10 h-10 text-fg" />
              ) : (
                <Trophy className="w-10 h-10 text-fg-subtle" />
              )}
            </div>
            <h1 className="text-display font-heading font-bold text-fg uppercase tracking-label">
              {t("endOfSeason.seasonComplete")}
            </h1>
            <p className="text-heading text-fg-muted mt-1">
              {t("endOfSeason.seasonLine", {
                league: league ? competitionDisplayName(league, t) : "",
                season: league?.season ?? "",
              })}
            </p>
            {isChampion && (
              <p className="text-heading font-heading font-bold text-warning mt-2 uppercase tracking-label animate-pulse">
                {t("endOfSeason.champions")}
              </p>
            )}
          </div>

          {/* User team summary */}
          {userHasStanding && (
            <Card accent={isChampion ? "accent" : "primary"} className="mb-6">
              <CardBody>
                <div className="text-center">
                  <p className="text-caption font-heading font-bold uppercase tracking-label text-fg-subtle mb-1">
                    {userTeam?.name}
                  </p>
                  <div className="flex items-center justify-center gap-6 mb-4">
                    <div>
                      <p className="text-display font-heading font-bold text-fg">
                        {posLabel(userPosition)}
                      </p>
                      <p className="text-caption text-fg-subtle font-heading uppercase">
                        {t("endOfSeason.position")}
                      </p>
                    </div>
                    <div className="w-px h-12 bg-hover" />
                    <div>
                      <p className="text-display font-heading font-bold text-selected">
                        {userStanding?.points || 0}
                      </p>
                      <p className="text-caption text-fg-subtle font-heading uppercase">
                        {t("endOfSeason.points")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-8 text-body">
                    <span className="text-positive font-heading font-bold">
                      {userStanding?.won || 0}
                      {t("common.won")}
                    </span>
                    <span className="text-fg-muted font-heading font-bold">
                      {userStanding?.drawn || 0}
                      {t("common.drawn")}
                    </span>
                    <span className="text-danger font-heading font-bold">
                      {userStanding?.lost || 0}
                      {t("common.lost")}
                    </span>
                    <span className="text-fg-subtle">
                      {userStanding?.goals_for || 0} {t("common.gf")} —{" "}
                      {userStanding?.goals_against || 0} {t("common.ga")}
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Final top 5 standings */}
          <Card className="mb-6">
            <CardBody>
              <h3 className="font-heading font-bold text-body uppercase tracking-label text-fg-muted mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-warning" /> {t("endOfSeason.finalStandings")}
              </h3>
              <div className="divide-y divide-line">
                {standings.slice(0, 5).map((entry, idx) => {
                  const teamName = gameState.teams.find((t) => t.id === entry.team_id)?.name || "";
                  const isUser = entry.team_id === userTeamId;
                  const gd = entry.goals_for - entry.goals_against;
                  return (
                    <div
                      key={entry.team_id}
                      className={`flex items-center py-2.5 gap-3 ${isUser ? "bg-selected-tint -mx-2 px-2 rounded-control" : ""}`}
                    >
                      <span
                        className={`font-heading font-bold text-body w-6 text-center ${idx === 0 ? "text-warning" : "text-fg-subtle"}`}
                      >
                        {idx + 1}
                      </span>
                      <span
                        className={`flex-1 text-body font-semibold ${isUser ? "text-selected" : "text-fg"}`}
                      >
                        {teamName}
                      </span>
                      <span className="text-caption text-fg-muted tabular-nums w-16 text-center">
                        {entry.won}W {entry.drawn}D {entry.lost}L
                      </span>
                      <span
                        className={`text-caption font-semibold tabular-nums w-8 text-center ${gd > 0 ? "text-selected" : gd < 0 ? "text-danger" : "text-fg-muted"}`}
                      >
                        {gd > 0 ? `+${gd}` : gd}
                      </span>
                      <span className="font-heading font-bold text-body text-fg tabular-nums w-8 text-right">
                        {entry.points}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* Champion + awards */}
          {!isChampion && (
            <Card className="mb-6">
              <CardBody>
                <div className="flex items-center gap-3">
                  <Crown className="w-6 h-6 text-warning" />
                  <div>
                    <p className="text-body font-heading font-bold text-fg uppercase tracking-label">
                      {t("endOfSeason.leagueChampions")}
                    </p>
                    <p className="text-heading font-heading font-bold text-warning">
                      {championName}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Action */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleAdvance}
              disabled={loading}
              className="px-8 py-4 bg-selected-fill text-on-brand rounded-panel font-heading font-bold text-heading uppercase tracking-label hover:bg-selected-fill transition-all shadow-lg shadow-card hover:shadow-xl hover:shadow-card disabled:opacity-50 flex items-center gap-3 mx-auto"
            >
              {loading ? t("endOfSeason.processing") : t("endOfSeason.startNextSeason")}
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-caption text-fg-subtle mt-3">{t("endOfSeason.statsArchived")}</p>
          </div>
        </>
      )}

      {step === "ceremony" && summary && (
        <AwardsCeremonyScreen
          season={summary.season}
          leagueName={summary.league_name}
          gameState={gameState}
          awards={summary.season_awards}
          onContinue={() => onTransitionChange({ summary, step: "done" })}
        />
      )}

      {step === "done" && summary && (
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-panel bg-gradient-to-br from-selected-fill to-selected-fill flex items-center justify-center mb-4 shadow-lg shadow-card">
            <Star className="w-10 h-10 text-on-brand" />
          </div>
          <h1 className="text-display font-heading font-bold text-fg uppercase tracking-label mb-2">
            {t("endOfSeason.newSeason", { n: summary.season + 1 })}
          </h1>
          <p className="text-fg-muted mb-8">{t("endOfSeason.newScheduleReleased")}</p>

          <button
            type="button"
            onClick={() => onTransitionChange(null)}
            className="px-8 py-3 bg-selected-fill text-on-brand rounded-panel font-heading font-bold uppercase tracking-label hover:bg-selected-fill transition-all shadow-lg shadow-card"
          >
            {t("endOfSeason.continueDashboard")}
          </button>
        </div>
      )}
    </div>
  );
}
