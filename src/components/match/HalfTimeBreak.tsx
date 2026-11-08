import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameStateData } from "../../store/gameStore";
import {
  type MatchSnapshot,
  type SubstitutionOutcome,
  type SubstitutionSwap,
  type MatchEvent,
  FORMATIONS,
  PLAY_STYLES,
  getTeamTalkOptions,
  type TeamTalkTone,
} from "./types";
import MatchEventSideBadge from "./MatchEventSideBadge";
import { getEventDisplay, getPlayerName, makeTeamFallback } from "./helpers";
import { getTalkIcon } from "./TeamTalkIcons";
import { SubPanel } from "./SubPanel";
import { applyRoleChange } from "./applyRoleChange";
import { sendMatchCommand } from "./matchCommands";
import { applySubstitutions } from "./applySubstitutions";
import { Badge, TeamLogo } from "../ui";
import { Play, RefreshCw, Shield, Zap, Target, Crosshair, Flag, MessageCircle } from "lucide-react";
import { invokeForCareer } from "../../services/careerInvoke";

interface HalfTimeBreakProps {
  snapshot: MatchSnapshot;
  gameState: GameStateData;
  userSide: "Home" | "Away";
  isSpectator: boolean;
  importantEvents: MatchEvent[];
  onResume: () => void;
  onUpdateSnapshot: (snap: MatchSnapshot) => void;
}

const PLAY_STYLE_ICONS: Record<string, React.ReactNode> = {
  Balanced: <Target className="w-3.5 h-3.5" />,
  Attacking: <Zap className="w-3.5 h-3.5" />,
  Defensive: <Shield className="w-3.5 h-3.5" />,
  Possession: <RefreshCw className="w-3.5 h-3.5" />,
  Counter: <Crosshair className="w-3.5 h-3.5" />,
  HighPress: <Flag className="w-3.5 h-3.5" />,
};

export default function HalfTimeBreak({
  snapshot,
  gameState,
  userSide,
  isSpectator,
  importantEvents,
  onResume,
  onUpdateSnapshot,
}: HalfTimeBreakProps) {
  const { t } = useTranslation();
  const teamTalkOptions = getTeamTalkOptions(t);
  const [selectedTalk, setSelectedTalk] = useState<TeamTalkTone | null>(null);
  const [showSubPanel, setShowSubPanel] = useState(false);
  const [talkDelivered, setTalkDelivered] = useState(false);
  const [talkPending, setTalkPending] = useState(false);
  const [talkError, setTalkError] = useState<string | null>(null);
  const [talkResults, setTalkResults] = useState<
    {
      player_id: string;
      player_name: string;
      old_morale: number;
      new_morale: number;
      delta: number;
    }[]
  >([]);

  const homeFullTeam = gameState.teams.find((t) => t.id === snapshot.home_team.id);
  const awayFullTeam = gameState.teams.find((t) => t.id === snapshot.away_team.id);
  const homeTeam = homeFullTeam ?? makeTeamFallback(snapshot.home_team.name);
  const awayTeam = awayFullTeam ?? makeTeamFallback(snapshot.away_team.name);
  const homeTeamColor = homeFullTeam?.colors?.primary || "#10b981";
  const awayTeamColor = awayFullTeam?.colors?.primary || "#6366f1";

  const userTeam = userSide === "Home" ? snapshot.home_team : snapshot.away_team;

  // First half key events
  const firstHalfEvents = importantEvents.filter((e) =>
    [
      "Goal",
      "PenaltyGoal",
      "YellowCard",
      "RedCard",
      "SecondYellow",
      "Injury",
      "PenaltyMiss",
    ].includes(e.event_type),
  );

  const handleFormationChange = async (formation: string) => {
    try {
      const snap = await sendMatchCommand({ ChangeFormation: { side: userSide, formation } });
      onUpdateSnapshot(snap);
    } catch (err) {
      console.error("Formation change failed:", err);
    }
  };

  const handleRoleChange = (playerId: string, role: string) =>
    applyRoleChange(userSide, playerId, role, onUpdateSnapshot);

  const handlePlayStyleChange = async (playStyle: string) => {
    try {
      const snap = await sendMatchCommand({
        ChangePlayStyle: { side: userSide, play_style: playStyle },
      });
      onUpdateSnapshot(snap);
    } catch (err) {
      console.error("Play style change failed:", err);
    }
  };

  const handleSubstitutions = async (swaps: SubstitutionSwap[]): Promise<SubstitutionOutcome> => {
    const outcome = await applySubstitutions(userSide, swaps, onUpdateSnapshot);
    if (outcome.applied) {
      setShowSubPanel(false);
    }
    return outcome;
  };

  const handleDeliverTalk = async () => {
    if (!selectedTalk || talkPending) return;
    const userScore = userSide === "Home" ? snapshot.home_score : snapshot.away_score;
    const oppScore = userSide === "Home" ? snapshot.away_score : snapshot.home_score;
    const context = userScore > oppScore ? "winning" : userScore < oppScore ? "losing" : "drawing";
    setTalkPending(true);
    setTalkError(null);
    try {
      const results = await invokeForCareer<
        {
          player_id: string;
          player_name: string;
          old_morale: number;
          new_morale: number;
          delta: number;
        }[]
      >("apply_team_talk", { tone: selectedTalk, context });
      setTalkResults(results);
      // Delivered only once the backend applied it: a refused talk (the career changed, say)
      // moved no morale, so the choices must stay for another try.
      setTalkDelivered(true);
    } catch (err) {
      console.error("Team talk failed:", err);
      setTalkError(t("match.teamTalkFailed"));
    } finally {
      setTalkPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-hover text-fg flex flex-col transition-colors duration-300">
      {/* Header scoreboard */}
      <header className="bg-linear-to-r from-hover via-panel to-hover to-panel border-b border-line px-4 py-4 transition-colors duration-300">
        <div className="relative">
          <div className="absolute right-0 top-0 flex items-center gap-3">
            <button
              type="button"
              onClick={onResume}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-selected-fill to-selected-fill rounded-panel font-heading font-bold uppercase tracking-label text-body text-on-brand shadow-lg shadow-card transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-4 h-4" />
              {t("match.resumeMatch")}
            </button>
          </div>
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-3">
              <TeamLogo
                team={homeTeam}
                className="w-12 h-12 rounded-panel flex items-center justify-center font-heading font-bold overflow-hidden"
                imageClassName="h-9 w-9 object-contain drop-shadow"
                style={{
                  backgroundColor: `${homeTeamColor}30`,
                  borderColor: homeTeamColor,
                  borderWidth: 2,
                }}
              />
              <p className="font-heading font-bold text-fg">{snapshot.home_team.name}</p>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-display font-heading font-bold text-fg tabular-nums">
                {snapshot.home_score}
              </span>
              <div className="text-center">
                <p className="text-caption font-heading uppercase tracking-labelst text-warning">
                  {snapshot.phase === "ExtraTimeHalfTime"
                    ? t("match.extraTimeHalfTime")
                    : t("match.halfTime")}
                </p>
                <p className="text-lead font-heading font-bold text-fg-muted">{t("match.ht")}</p>
              </div>
              <span className="text-display font-heading font-bold text-fg tabular-nums">
                {snapshot.away_score}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <p className="font-heading font-bold text-fg">{snapshot.away_team.name}</p>
              <TeamLogo
                team={awayTeam}
                className="w-12 h-12 rounded-panel flex items-center justify-center font-heading font-bold overflow-hidden"
                imageClassName="h-9 w-9 object-contain drop-shadow"
                style={{
                  backgroundColor: `${awayTeamColor}30`,
                  borderColor: awayTeamColor,
                  borderWidth: 2,
                }}
              />
            </div>
          </div>

          {/* Possession bar */}
          <div className="max-w-md mx-auto mt-3">
            <div className="flex items-center gap-2 text-caption">
              <span className="font-heading font-bold text-selected w-12 text-right">
                {snapshot.home_possession_pct.toFixed(0)}%
              </span>
              <div className="flex-1 h-1.5 bg-line-strong rounded-full overflow-hidden flex transition-colors duration-300">
                <div
                  className="h-full bg-selected-fill transition-all"
                  style={{ width: `${snapshot.home_possession_pct}%` }}
                />
                <div
                  className="h-full bg-info-solid transition-all"
                  style={{ width: `${snapshot.away_possession_pct}%` }}
                />
              </div>
              <span className="font-heading font-bold text-info w-12">
                {snapshot.away_possession_pct.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6 grid grid-cols-3 gap-6">
          {/* Left: First Half Summary */}
          <div className="flex flex-col gap-4">
            <div className="bg-panel rounded-panel border border-line shadow-sm p-4 transition-colors duration-300">
              <h3 className="text-caption font-heading font-bold uppercase tracking-labelst text-fg-muted mb-3">
                {t("match.firstHalfEvents")}
              </h3>
              {firstHalfEvents.length === 0 ? (
                <p className="text-caption text-fg-muted">{t("match.noMajorEvents")}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {firstHalfEvents.map((evt, i) => {
                    const display = getEventDisplay(evt);
                    return (
                      <div key={i} className="flex items-center gap-2 text-caption">
                        <span className="text-fg-muted tabular-nums w-6 text-right font-heading">
                          {evt.minute}'
                        </span>
                        <span>{display.icon}</span>
                        <span className={`${display.color} font-medium truncate`}>
                          {getPlayerName(snapshot, evt.player_id)}
                        </span>
                        <MatchEventSideBadge
                          side={evt.side}
                          homeTeam={homeTeam}
                          awayTeam={awayTeam}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Center: Team Talk (user only) */}
          <div className="flex flex-col gap-4">
            {!isSpectator ? (
              <div className="bg-panel rounded-panel border border-line shadow-sm p-4 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-4">
                  <MessageCircle className="w-4 h-4 text-warning" />
                  <h3 className="text-caption font-heading font-bold uppercase tracking-labelst text-fg-muted">
                    {t("match.teamTalk")}
                  </h3>
                </div>

                {!talkDelivered ? (
                  <>
                    <p className="text-caption text-fg-muted mb-3">{t("match.teamTalkPrompt")}</p>
                    <div className="flex flex-col gap-2">
                      {teamTalkOptions.map((opt) => (
                        <button
                          type="button"
                          key={opt.id}
                          onClick={() => setSelectedTalk(opt.id)}
                          className={`flex items-center gap-3 p-3 rounded-control text-left transition-all ${
                            selectedTalk === opt.id
                              ? "bg-selected-tint ring-2 ring-selected/50"
                              : "bg-hover hover:bg-hover/50"
                          }`}
                        >
                          <span className="text-title">{getTalkIcon(opt.icon)}</span>
                          <div>
                            <p
                              className={`text-body font-heading font-bold ${
                                selectedTalk === opt.id ? "text-selected" : "text-fg"
                              }`}
                            >
                              {opt.label}
                            </p>
                            <p className="text-caption text-fg-muted">{opt.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    {selectedTalk && (
                      <button
                        type="button"
                        onClick={handleDeliverTalk}
                        disabled={talkPending}
                        className="w-full mt-3 py-2.5 bg-selected-tint hover:bg-selected-tint text-selected rounded-control font-heading font-bold text-body uppercase tracking-label transition-colors disabled:opacity-50"
                      >
                        {t("match.deliverTeamTalk")}
                      </button>
                    )}
                    {talkError && (
                      <p role="alert" className="text-body text-danger mt-2">
                        {talkError}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-1">
                      {getTalkIcon(selectedTalk || "")}
                      <p className="text-body font-heading font-bold text-selected">
                        {teamTalkOptions.find((o) => o.id === selectedTalk)?.label}
                      </p>
                      <Badge variant="success" size="sm">
                        {t("match.delivered")}
                      </Badge>
                    </div>
                    {talkResults.length > 0 && (
                      <div className="flex flex-col gap-0.5 max-h-48 overflow-auto">
                        {talkResults.map((r) => (
                          <div
                            key={r.player_id}
                            className="flex items-center gap-2 px-2 py-1 text-caption"
                          >
                            <span className="text-fg-muted flex-1 truncate">{r.player_name}</span>
                            <span
                              className={`font-heading font-bold tabular-nums ${r.delta > 0 ? "text-positive" : r.delta < 0 ? "text-danger" : "text-fg-muted"}`}
                            >
                              {r.delta > 0 ? "+" : ""}
                              {r.delta}
                            </span>
                            <div className="w-12 h-1.5 bg-line-strong rounded-full overflow-hidden transition-colors duration-300">
                              <div
                                className={`h-full rounded-full ${r.new_morale >= 70 ? "bg-positive-solid" : r.new_morale >= 40 ? "bg-warning-solid" : "bg-danger-solid"}`}
                                style={{ width: `${r.new_morale}%` }}
                              />
                            </div>
                            <span className="text-fg-muted tabular-nums w-6 text-right">
                              {r.new_morale}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-panel rounded-panel border border-line shadow-sm p-4 flex flex-col items-center justify-center py-8 transition-colors duration-300">
                <p className="text-caption font-heading uppercase tracking-labelst text-fg-muted mb-1">
                  {t("match.spectatorMode")}
                </p>
                <p className="text-body text-fg-muted text-center">{t("match.spectatorHT")}</p>
              </div>
            )}
          </div>

          {/* Right: Tactical Changes (user only) */}
          <div className="flex flex-col gap-4">
            {!isSpectator && (
              <>
                {/* Formation */}
                <div className="bg-panel rounded-panel border border-line shadow-sm p-4 transition-colors duration-300">
                  <h3 className="text-caption font-heading font-bold uppercase tracking-labelst text-fg-muted mb-3">
                    {t("match.formation")}
                  </h3>
                  <div className="grid grid-cols-3 gap-1.5">
                    {FORMATIONS.map((f) => (
                      <button
                        type="button"
                        key={f}
                        onClick={() => handleFormationChange(f)}
                        className={`py-2 rounded-control text-caption font-heading font-bold transition-all ${
                          userTeam.formation === f
                            ? "bg-selected-tint text-selected ring-1 ring-selected/50"
                            : "bg-hover text-fg-muted hover:text-fg"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Play Style */}
                <div className="bg-panel rounded-panel border border-line shadow-sm p-4 transition-colors duration-300">
                  <h3 className="text-caption font-heading font-bold uppercase tracking-labelst text-fg-muted mb-3">
                    {t("match.playStyle")}
                  </h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PLAY_STYLES.map((style) => (
                      <button
                        type="button"
                        key={style}
                        onClick={() => handlePlayStyleChange(style)}
                        className={`flex items-center gap-1.5 py-2 px-3 rounded-control text-caption font-heading font-bold transition-all ${
                          userTeam.play_style === style
                            ? "bg-selected-tint text-selected ring-1 ring-selected/50"
                            : "bg-hover text-fg-muted hover:text-fg"
                        }`}
                      >
                        {PLAY_STYLE_ICONS[style]}
                        {t(`common.playStyles.${style}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Substitutions */}
                <div className="bg-panel rounded-panel border border-line shadow-sm p-4 transition-colors duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-caption font-heading font-bold uppercase tracking-labelst text-fg-muted">
                      {t("match.substitutions")}
                    </h3>
                    <Badge variant="neutral" size="sm">
                      {userSide === "Home" ? snapshot.home_subs_made : snapshot.away_subs_made}/
                      {snapshot.max_subs}
                    </Badge>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSubPanel(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-hover hover:bg-line-strong rounded-control text-body font-heading uppercase tracking-label text-fg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("match.makeSubstitution")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Substitution Modal — reuses the full SubPanel from MatchLive */}
      {showSubPanel && (
        <SubPanel
          snapshot={snapshot}
          side={userSide}
          onSubstitute={handleSubstitutions}
          onFormationChange={handleFormationChange}
          onPlayStyleChange={handlePlayStyleChange}
          onChangeRole={handleRoleChange}
          onClose={() => setShowSubPanel(false)}
        />
      )}
    </div>
  );
}
