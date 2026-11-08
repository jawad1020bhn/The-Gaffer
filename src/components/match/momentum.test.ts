import { describe, expect, it } from "vitest";
import { momentumFor } from "./momentum";
import type { MatchEvent } from "./types";

function event(minute: number, event_type: string, side: "Home" | "Away"): MatchEvent {
  return {
    minute,
    event_type,
    side,
    zone: "Midfield",
    player_id: null,
    secondary_player_id: null,
  };
}

describe("momentumFor", () => {
  /** Given nothing worth counting, when the window is read, then the bar sits in the middle. */
  it("is even before anything happens", () => {
    expect(momentumFor([], 10)).toEqual({ home: 0, even: 100, away: 0 });
  });

  /** Given chances for both sides, when they are level, then the bar stays in the middle. */
  it("stays even while the two sides trade chances", () => {
    const events = [event(41, "ShotSaved", "Home"), event(42, "ShotSaved", "Away")];

    expect(momentumFor(events, 45)).toEqual({ home: 0, even: 100, away: 0 });
  });

  /** Given one side attacking, when only it has chances, then its end takes the whole bar. */
  it("fills one end when only one side has chances", () => {
    const events = [event(41, "ShotSaved", "Home"), event(42, "Corner", "Home")];

    expect(momentumFor(events, 45)).toEqual({ home: 100, even: 0, away: 0 });
  });

  /** Given a lopsided spell, when it is read, then the bar splits in proportion to the pressure. */
  it("splits the bar by how one-sided the spell was", () => {
    const events = [
      event(41, "Goal", "Home"), // 3
      event(42, "ShotSaved", "Home"), // 1.5
      event(43, "Corner", "Away"), // 0.8
    ];

    // Home 4.5 of 5.3 -> 70% of the bar; the rest belongs to nobody.
    expect(momentumFor(events, 45)).toEqual({ home: 70, even: 30, away: 0 });
  });

  /** Given a foul, when the bar is read, then the side that won it gets the credit. */
  it("credits a foul to the side that did not give it away", () => {
    expect(momentumFor([event(30, "Foul", "Home")], 32)).toEqual({
      home: 0,
      even: 0,
      away: 100,
    });
  });

  /** Given an event older than the window, when the bar is read, then it no longer counts. */
  it("forgets pressure from before the window", () => {
    const events = [event(10, "Goal", "Home")];

    expect(momentumFor(events, 30)).toEqual({ home: 0, even: 100, away: 0 });
    expect(momentumFor(events, 12)).toEqual({ home: 100, even: 0, away: 0 });
  });

  /** Given events beyond the current minute, when the bar is read, then they are not counted yet. */
  it("ignores events from later than the current minute", () => {
    const events = [event(50, "Goal", "Away")];

    expect(momentumFor(events, 20)).toEqual({ home: 0, even: 100, away: 0 });
  });

  /** Given bookkeeping events, when the bar is read, then they move nothing. */
  it("ignores events that say nothing about pressure", () => {
    const events = [
      event(30, "Substitution", "Home"),
      event(31, "KickOff", "Home"),
      event(32, "YellowCard", "Away"),
    ];

    expect(momentumFor(events, 33)).toEqual({ home: 0, even: 100, away: 0 });
  });
});
