import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  KEY_ATTRIBUTES,
  WEIGHTS,
  attributesMatchingOverall,
  canonicalPosition,
  criticalPenalty,
  ovrFromAttributes,
} from "./rating.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const rustSource = readFileSync(
  path.resolve(here, "../../../src-tauri/crates/ofm_core/src/player_rating.rs"),
  "utf8",
);

/** Every `Position::X | Position::Y => weighted_average(&[(attrs.a, 1), …])` arm. */
function rustWeightArms() {
  const body = rustSource.slice(
    rustSource.indexOf("fn weighted_score"),
    rustSource.indexOf("pub fn key_attributes"),
  );
  const arms = [];
  const armPattern =
    /Position::([A-Za-z]+)((?:\s*\|\s*Position::[A-Za-z]+)*)\s*=>\s*weighted_average\(&\[([\s\S]*?)\]\)/g;
  for (const match of body.matchAll(armPattern)) {
    const positions = [
      match[1],
      ...match[2].split("|").map((p) => p.replace("Position::", "").trim()),
    ].filter(Boolean);
    const weights = [...match[3].matchAll(/\(attrs\.(\w+),\s*(\d+)\)/g)].map(([, key, weight]) => [
      key,
      Number(weight),
    ]);
    for (const position of positions) arms.push({ position, weights });
  }
  return arms;
}

/** Every `Position::X => [A, B, C]` arm of `key_attributes`. */
function rustKeyArms() {
  const body = rustSource.slice(
    rustSource.indexOf("pub fn key_attributes"),
    rustSource.indexOf("fn critical_penalty"),
  );
  const arms = [];
  const armPattern = /Position::([A-Za-z]+)((?:\s*\|\s*Position::[A-Za-z]+)*)\s*=>\s*\[([^\]]*)\]/g;
  for (const match of body.matchAll(armPattern)) {
    const positions = [
      match[1],
      ...match[2].split("|").map((p) => p.replace("Position::", "").trim()),
    ].filter(Boolean);
    const keys = match[3]
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean)
      .map((key) => key.charAt(0).toLowerCase() + key.slice(1));
    for (const position of positions) arms.push({ position, keys });
  }
  return arms;
}

describe("the ported rating tables", () => {
  it("match the engine's weights for every scored position", () => {
    const arms = rustWeightArms();
    assert.ok(arms.length >= 14, `expected the Rust arms, found ${arms.length}`);
    for (const { position, weights } of arms) {
      const canonical = canonicalPosition(position);
      assert.ok(WEIGHTS[canonical], `no weights ported for ${position}`);
      assert.deepEqual(WEIGHTS[canonical], weights, `weights drifted for ${position}`);
      const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
      assert.equal(total, 100, `${position} weights should sum to 100`);
    }
  });

  it("match the engine's key attributes for every position", () => {
    for (const { position, keys } of rustKeyArms()) {
      const canonical = canonicalPosition(position);
      assert.deepEqual(KEY_ATTRIBUTES[canonical], keys, `key attributes drifted for ${position}`);
    }
  });

  it("keep the engine's penalty constants", () => {
    assert.match(rustSource, /if critical_min >= 45/);
    assert.match(rustSource, /\(45 - critical_min\) as f64 \* 0\.6/);
  });
});

describe("ovrFromAttributes", () => {
  const flat = (value) =>
    Object.fromEntries(
      [
        "pace",
        "stamina",
        "strength",
        "agility",
        "passing",
        "shooting",
        "tackling",
        "dribbling",
        "defending",
        "positioning",
        "vision",
        "decisions",
        "composure",
        "aggression",
        "teamwork",
        "leadership",
        "handling",
        "reflexes",
        "aerial",
      ].map((key) => [key, value]),
    );

  it("is the plain attribute value when every attribute is level and above the floor", () => {
    assert.equal(ovrFromAttributes(flat(80), "Striker"), 80);
    assert.equal(ovrFromAttributes(flat(80), "Goalkeeper"), 80);
  });

  it("charges 0.6 per point a key attribute falls below 45", () => {
    const attributes = { ...flat(80), shooting: 25 };
    // (45 - 25) * 0.6 = 12
    assert.equal(criticalPenalty(attributes, "Striker"), 12);
    // The weak attribute also drags the weighted score: shooting carries 26% of a striker's.
    const weighted = 80 - ((80 - 25) * 26) / 100;
    assert.equal(ovrFromAttributes(attributes, "Striker"), weighted - 12);
  });

  it("does not penalise a position whose key attributes are all fine", () => {
    const attributes = { ...flat(80), shooting: 25 };
    assert.equal(ovrFromAttributes(attributes, "CenterBack"), 80);
  });

  it("scores the left side with the right side's row", () => {
    const attributes = { ...flat(70), pace: 95, tackling: 40 };
    assert.equal(
      ovrFromAttributes(attributes, "LeftBack"),
      ovrFromAttributes(attributes, "RightBack"),
    );
  });

  it("reads a general group as its concrete position", () => {
    const attributes = { ...flat(75), shooting: 30 };
    assert.equal(
      ovrFromAttributes(attributes, "Forward"),
      ovrFromAttributes(attributes, "Striker"),
    );
  });

  it("stays inside 1-99", () => {
    assert.equal(ovrFromAttributes(flat(99), "Striker"), 99);
    assert.ok(ovrFromAttributes(flat(1), "Striker") >= 1);
  });
});

describe("attributesMatchingOverall", () => {
  const block = (value) =>
    Object.fromEntries(
      [
        "pace",
        "stamina",
        "strength",
        "agility",
        "passing",
        "shooting",
        "tackling",
        "dribbling",
        "defending",
        "positioning",
        "vision",
        "decisions",
        "composure",
        "aggression",
        "teamwork",
        "leadership",
        "handling",
        "reflexes",
        "aerial",
      ].map((key) => [key, value]),
    );

  it("lands the engine's rating on the target", () => {
    for (const target of [42, 55, 68, 77, 88]) {
      for (const position of ["Striker", "CenterBack", "Goalkeeper", "LeftWinger"]) {
        const { attributes, overall } = attributesMatchingOverall(block(60), position, target);
        assert.equal(Math.round(ovrFromAttributes(attributes, position)), target);
        assert.equal(overall, target);
      }
    }
  });

  it("keeps the player's shape: a shift is uniform", () => {
    const source = { ...block(60), pace: 90, tackling: 30 };
    const { attributes } = attributesMatchingOverall(source, "RightWinger", 75);
    assert.equal(attributes.pace - source.pace, attributes.tackling - source.tackling);
    assert.ok(attributes.pace > attributes.tackling);
  });

  it("clamps into the attribute range at both extremes", () => {
    const highest = attributesMatchingOverall(block(1), "Striker", 99);
    assert.equal(highest.overall, 99);
    assert.equal(highest.attributes.shooting, 99);

    const lowest = attributesMatchingOverall(block(99), "Striker", 1);
    assert.equal(lowest.overall, 1);
    for (const value of Object.values(lowest.attributes)) assert.ok(value >= 1 && value <= 99);
  });
});
