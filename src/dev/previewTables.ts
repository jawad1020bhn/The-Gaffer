import type { PositionGroupEntry } from "../services/positionService";
import type { PlayerTier } from "../store/generated/PlayerTier";

/**
 * The two tables the screens ask the backend for that need no game: which group a position belongs
 * to, and which tier each rating is in.
 *
 * Dev only. They live here rather than in each preview so `?preview=shell`, `?preview=match` and
 * the style guide answer the same way as each other.
 */

const GROUP_OF: Record<string, string> = {
  Goalkeeper: "Goalkeeper",
  CenterBack: "Defender",
  LeftBack: "Defender",
  RightBack: "Defender",
  LeftWingBack: "Defender",
  RightWingBack: "Defender",
  DefensiveMidfielder: "Midfielder",
  CentralMidfielder: "Midfielder",
  AttackingMidfielder: "Midfielder",
  LeftMidfielder: "Midfielder",
  RightMidfielder: "Midfielder",
  LeftWinger: "Attacker",
  RightWinger: "Attacker",
  Striker: "Attacker",
};

/** The position table, in the order a squad list sorts by. */
export function previewPositionGroups(): PositionGroupEntry[] {
  return Object.keys(GROUP_OF).map((position, index) => ({
    position,
    group: GROUP_OF[position] ?? "Midfielder",
    rank: index,
  }));
}

/** One tier per rating, 0-99, the shape the backend's table has. */
export function previewRatingTiers(): PlayerTier[] {
  return Array.from({ length: 100 }, (_, rating): PlayerTier => {
    if (rating >= 85) return "S";
    if (rating >= 75) return "A";
    if (rating >= 60) return "B";
    return "Rest";
  });
}
