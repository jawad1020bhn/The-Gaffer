import type { JSX } from "react";
import type { FixtureData } from "../../store/gameStore";
import { Badge } from "../ui";

interface KnockoutRound {
  id: string;
  name: string;
  fixture_ids: string[];
  bye_team_ids?: string[];
  completed: boolean;
}

interface KnockoutBracketProps {
  rounds: KnockoutRound[];
  fixtures: FixtureData[];
  resolveTeamName: (id: string) => string;
  localizedRoundName: (name: string) => string;
  userTeamId?: string | null;
  roundCompleteLabel: string;
  roundInProgressLabel: string;
  byeLabel: string;
  tbdLabel: string;
}

interface MatchSlotProps {
  fixtureId: string;
  fixture: FixtureData | undefined;
  resolveTeamName: (id: string) => string;
  userTeamId?: string | null;
  tbdLabel: string;
}

function ScoreBadge({ score }: { score: number }): JSX.Element {
  return (
    <span className="w-6 text-center text-caption font-bold font-heading tabular-nums">
      {score}
    </span>
  );
}

/** Shootout tally shown in parentheses for a penalty-decided tie, e.g. "(4)". */
function PenaltyScore({ score }: { score: number }): JSX.Element {
  return <span className="text-caption font-semibold text-fg-muted tabular-nums">({score})</span>;
}

function MatchSlot({
  fixtureId,
  fixture,
  resolveTeamName,
  userTeamId,
  tbdLabel,
}: MatchSlotProps): JSX.Element {
  if (!fixture) {
    return (
      <div
        data-testid={`tournaments-bracket-${fixtureId}`}
        className="rounded-control border border-dashed border-line p-2 text-caption text-fg-subtle text-center italic"
      >
        {tbdLabel}
      </div>
    );
  }

  const result = fixture.result;
  const homeName = fixture.home_team_id ? resolveTeamName(fixture.home_team_id) : tbdLabel;
  const awayName = fixture.away_team_id ? resolveTeamName(fixture.away_team_id) : tbdLabel;

  // The tally is shown for a tie the shootout settled; who advances is the backend's answer.
  const decidedByPenalties =
    !!result &&
    result.home_penalties != null &&
    result.away_penalties != null &&
    result.home_goals === result.away_goals;
  const advancingTeamId = fixture.advancing_team_id ?? null;
  const isHomeWinner = !!result && advancingTeamId === fixture.home_team_id;
  const isAwayWinner = !!result && advancingTeamId === fixture.away_team_id;

  const userInvolved =
    userTeamId && (fixture.home_team_id === userTeamId || fixture.away_team_id === userTeamId);

  const baseRow = "flex items-center gap-1.5 rounded px-2 py-1 text-caption transition-colors";
  const winnerRow = "font-bold text-fg bg-primary-50 dark:bg-primary-900/20";
  const loserRow = "text-fg-muted";
  const neutralRow = "text-fg";

  const homeRowStyle = result
    ? isHomeWinner
      ? winnerRow
      : isAwayWinner
        ? loserRow
        : neutralRow
    : neutralRow;
  const awayRowStyle = result
    ? isAwayWinner
      ? winnerRow
      : isHomeWinner
        ? loserRow
        : neutralRow
    : neutralRow;

  return (
    <div
      data-testid={`tournaments-bracket-${fixtureId}`}
      className={`rounded-control border overflow-hidden ${
        userInvolved ? "border-primary-400/50 dark:border-primary-500/40" : "border-line"
      }`}
    >
      {/* Home team row */}
      <div className={`${baseRow} ${homeRowStyle}`}>
        <span className="flex-1 truncate max-w-[9rem]">{homeName}</span>
        {decidedByPenalties && <PenaltyScore score={result.home_penalties ?? 0} />}
        {result && <ScoreBadge score={result.home_goals} />}
      </div>
      {/* Divider */}
      <div className="h-px bg-gray-100 dark:bg-navy-700" />
      {/* Away team row */}
      <div className={`${baseRow} ${awayRowStyle}`}>
        <span className="flex-1 truncate max-w-[9rem]">{awayName}</span>
        {decidedByPenalties && <PenaltyScore score={result.away_penalties ?? 0} />}
        {result && <ScoreBadge score={result.away_goals} />}
      </div>
    </div>
  );
}

export default function KnockoutBracket({
  rounds,
  fixtures,
  resolveTeamName,
  localizedRoundName,
  userTeamId,
  roundCompleteLabel,
  roundInProgressLabel,
  byeLabel,
  tbdLabel,
}: KnockoutBracketProps): JSX.Element | null {
  if (rounds.length === 0) return null;

  const fixtureById = new Map(fixtures.map((f) => [f.id, f]));

  const maxSlots = Math.max(
    ...rounds.map((r) => r.fixture_ids.length + (r.bye_team_ids?.length ?? 0)),
  );

  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-panel">
      <div className="flex gap-0 min-w-max">
        {rounds.map((round, roundIdx) => {
          const roundFixtures = round.fixture_ids.map((id) => fixtureById.get(id));
          const byeTeams = round.bye_team_ids ?? [];
          const totalSlots = roundFixtures.length + byeTeams.length;

          // Calculate vertical spacing: each slot gets equal height relative to maxSlots
          const slotHeightPx = 80;
          const totalHeight = maxSlots * slotHeightPx;

          return (
            <div
              key={round.id}
              className={`flex flex-col border-r border-line last:border-r-0 ${
                roundIdx === rounds.length - 1 ? "min-w-[16rem]" : "min-w-[14rem]"
              }`}
            >
              {/* Round header */}
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-line bg-sunken/40 shrink-0">
                <span className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted truncate">
                  {localizedRoundName(round.name)}
                </span>
                <Badge variant={round.completed ? "accent" : "neutral"} size="sm">
                  {round.completed ? roundCompleteLabel : roundInProgressLabel}
                </Badge>
              </div>

              {/* Match slots */}
              <div
                className="flex flex-col justify-around p-3 gap-2"
                style={{ minHeight: `${Math.max(totalHeight, totalSlots * slotHeightPx)}px` }}
              >
                {roundFixtures.map((fixture, idx) => (
                  <MatchSlot
                    key={round.fixture_ids[idx]}
                    fixtureId={round.fixture_ids[idx]}
                    fixture={fixture}
                    resolveTeamName={resolveTeamName}
                    userTeamId={userTeamId}
                    tbdLabel={tbdLabel}
                  />
                ))}
                {byeTeams.length > 0 && (
                  <div
                    data-testid={`tournaments-byes-${round.id}`}
                    className="rounded-control border border-dashed border-line px-2 py-1.5 text-caption text-fg-muted"
                  >
                    <span className="font-heading font-semibold uppercase tracking-label text-caption text-fg-subtle mr-1.5">
                      {byeLabel}
                    </span>
                    {byeTeams.map((id) => resolveTeamName(id)).join(", ")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
