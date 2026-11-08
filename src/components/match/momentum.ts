import type { MatchEvent } from "./types";

/**
 * How much of the last few minutes each side spent on the front foot, as three percentages that add
 * up to 100: `home`, `even` (nobody clearly on top) and `away`.
 *
 * Presentation only — nothing here feeds the engine. It reads the same event feed the ticker shows,
 * which is why a goal swings the bar and a quiet spell lets it drift back to the middle.
 */
export interface Momentum {
  home: number;
  even: number;
  away: number;
}

/** The spell the bar describes. Long enough to read as pressure, short enough to react to a goal. */
export const MOMENTUM_WINDOW_MINUTES = 5;

/**
 * Event weights: what an event says about who is attacking. Anything missing is worth nothing
 * (a substitution or a kick-off is not pressure). A foul is pressure *against* the side that gave
 * it away, so it is credited to the other team below.
 */
const PRESSURE: Record<string, number> = {
  Goal: 3,
  PenaltyGoal: 3,
  PenaltyAwarded: 2,
  ShotSaved: 1.5,
  ShotOffTarget: 1.2,
  ShotBlocked: 1.2,
  Corner: 0.8,
  FreeKick: 0.6,
  Foul: 0.6,
};

const EVEN: Momentum = { home: 0, even: 100, away: 0 };

/**
 * The momentum over the `window` minutes up to `minute`, inclusive.
 *
 * The bar shows how one-sided the spell was, not the raw event split: two sides trading chances
 * sit at the middle, and one side camped in the other's half fills its end.
 */
export function momentumFor(
  events: MatchEvent[],
  minute: number,
  window: number = MOMENTUM_WINDOW_MINUTES,
): Momentum {
  const from = minute - window;
  let home = 0;
  let away = 0;

  for (const event of events) {
    if (event.minute <= from || event.minute > minute) continue;
    const weight = PRESSURE[event.event_type] ?? 0;
    if (weight === 0) continue;

    const forHome = event.event_type === "Foul" ? event.side === "Away" : event.side === "Home";
    if (forHome) home += weight;
    else away += weight;
  }

  const total = home + away;
  if (total === 0 || home === away) return EVEN;

  const edge = Math.round((Math.abs(home - away) / total) * 100);
  return home > away
    ? { home: edge, even: 100 - edge, away: 0 }
    : { home: 0, even: 100 - edge, away: edge };
}
