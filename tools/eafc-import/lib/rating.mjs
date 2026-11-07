/**
 * The engine's player rating, ported from `src-tauri/crates/ofm_core/src/player_rating.rs`.
 *
 * Why this exists: a package that writes an explicit `attributes` block is rated
 * from those attributes, not from the `overall` it also wrote
 * (`ovr_from_attributes` in `generator/package.rs`). The loader refuses a package
 * whose `potential` is below that figure, and the game shows it on every screen,
 * so the importer has to be able to compute it to stay consistent.
 *
 * `rating.test.mjs` re-reads the Rust source and fails if these tables drift.
 */

/** Attribute weights per canonical position; each row sums to 100. */
export const WEIGHTS = Object.freeze({
  Goalkeeper: [
    ["handling", 28],
    ["reflexes", 28],
    ["aerial", 14],
    ["positioning", 10],
    ["decisions", 10],
    ["composure", 5],
    ["strength", 5],
  ],
  RightBack: [
    ["pace", 18],
    ["stamina", 16],
    ["tackling", 17],
    ["defending", 16],
    ["positioning", 12],
    ["passing", 10],
    ["dribbling", 6],
    ["decisions", 5],
  ],
  CenterBack: [
    ["defending", 24],
    ["tackling", 18],
    ["positioning", 18],
    ["strength", 14],
    ["aerial", 12],
    ["decisions", 8],
    ["composure", 6],
  ],
  RightWingBack: [
    ["pace", 18],
    ["stamina", 18],
    ["tackling", 14],
    ["defending", 12],
    ["passing", 13],
    ["dribbling", 11],
    ["vision", 7],
    ["decisions", 7],
  ],
  DefensiveMidfielder: [
    ["tackling", 18],
    ["positioning", 18],
    ["decisions", 16],
    ["passing", 14],
    ["defending", 12],
    ["stamina", 10],
    ["vision", 7],
    ["strength", 5],
  ],
  CentralMidfielder: [
    ["passing", 20],
    ["vision", 16],
    ["decisions", 16],
    ["stamina", 12],
    ["dribbling", 10],
    ["positioning", 9],
    ["teamwork", 9],
    ["tackling", 8],
  ],
  AttackingMidfielder: [
    ["vision", 20],
    ["passing", 18],
    ["dribbling", 16],
    ["decisions", 14],
    ["shooting", 10],
    ["positioning", 8],
    ["composure", 8],
    ["pace", 6],
  ],
  RightMidfielder: [
    ["pace", 17],
    ["stamina", 16],
    ["passing", 15],
    ["dribbling", 14],
    ["vision", 10],
    ["decisions", 10],
    ["positioning", 10],
    ["tackling", 8],
  ],
  RightWinger: [
    ["pace", 22],
    ["dribbling", 22],
    ["passing", 14],
    ["shooting", 12],
    ["vision", 10],
    ["decisions", 8],
    ["positioning", 6],
    ["stamina", 6],
  ],
  Striker: [
    ["shooting", 26],
    ["positioning", 18],
    ["decisions", 14],
    ["pace", 12],
    ["dribbling", 10],
    ["strength", 8],
    ["composure", 8],
    ["aerial", 4],
  ],
});

/** Left/right share a row in the Rust match arms. */
const MIRRORED = Object.freeze({
  LeftBack: "RightBack",
  LeftWingBack: "RightWingBack",
  LeftMidfielder: "RightMidfielder",
  LeftWinger: "RightWinger",
});

/** The three attributes a player cannot do without at a position. */
export const KEY_ATTRIBUTES = Object.freeze({
  Goalkeeper: ["handling", "reflexes", "positioning"],
  RightBack: ["tackling", "defending", "positioning"],
  CenterBack: ["defending", "tackling", "positioning"],
  RightWingBack: ["pace", "stamina", "tackling"],
  DefensiveMidfielder: ["tackling", "positioning", "passing"],
  CentralMidfielder: ["passing", "vision", "decisions"],
  AttackingMidfielder: ["vision", "passing", "dribbling"],
  RightMidfielder: ["pace", "passing", "stamina"],
  RightWinger: ["pace", "dribbling", "passing"],
  Striker: ["shooting", "positioning", "decisions"],
});

/** General groups read as a concrete position before scoring. */
export function canonicalPosition(position) {
  switch (position) {
    case "Defender":
      return "CenterBack";
    case "Midfielder":
      return "CentralMidfielder";
    case "Forward":
      return "Striker";
    default:
      return MIRRORED[position] ?? position;
  }
}

/** A weakness in a key attribute costs the player rating at that position. */
export function criticalPenalty(attributes, position) {
  const keys = KEY_ATTRIBUTES[canonicalPosition(position)];
  const lowest = Math.min(...keys.map((key) => attributes[key] ?? 0));
  return lowest >= 45 ? 0 : (45 - lowest) * 0.6;
}

/**
 * `ovr_from_attributes`: the weighted attribute score less the critical penalty,
 * clamped to 1-99. Mirrors the Rust, including its rounding order (the caller
 * rounds).
 */
export function ovrFromAttributes(attributes, position) {
  const canonical = canonicalPosition(position);
  const weights = WEIGHTS[canonical];
  if (!weights) throw new Error(`no rating weights for position ${position}`);
  const base = weights.reduce((sum, [key, weight]) => sum + (attributes[key] ?? 0) * weight, 0) / 100;
  const score = Math.min(99, Math.max(1, base - criticalPenalty(attributes, canonical)));
  return score;
}

/**
 * Shift a whole attribute block so the engine's rating lands on `target`.
 *
 * EA's overall and the engine's weighted score do not agree for the same data
 * (EA weighs its own attribute set, the engine weighs a different one), so an
 * imported squad read four to seven points light on average before this. A
 * uniform shift keeps the player's *shape* — who is fast, who cannot tackle —
 * while restoring the rating people know him by.
 *
 * The search walks outward from no shift so the smallest correction that lands
 * on the target wins, and it stops at the edge of the attribute range.
 */
export function attributesMatchingOverall(attributes, position, target) {
  const clampedTarget = Math.min(99, Math.max(1, Math.round(target)));
  const keys = Object.keys(attributes);
  const shifted = (delta) =>
    Object.fromEntries(keys.map((key) => [key, Math.min(99, Math.max(1, attributes[key] + delta))]));

  let best = { delta: 0, score: Math.round(ovrFromAttributes(attributes, position)) };
  for (let step = 0; step <= 99; step += 1) {
    for (const delta of step === 0 ? [0] : [step, -step]) {
      const candidate = shifted(delta);
      const score = Math.round(ovrFromAttributes(candidate, position));
      if (Math.abs(score - clampedTarget) < Math.abs(best.score - clampedTarget)) {
        best = { delta, score };
      }
      if (score === clampedTarget) return { attributes: candidate, overall: score };
    }
  }
  return { attributes: shifted(best.delta), overall: best.score };
}
