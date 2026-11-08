/**
 * The badge pack is pure data over the file system: manifest shape, per-file
 * checksums, and the EA id → package path crosswalk. No database kit needed.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createHash } from "node:crypto";
import {
  BadgePackError,
  badgeAssetPath,
  packageManifest as badgePackageManifest,
  readBadgeManifest,
  verifyBadgePack,
} from "./badges.mjs";

const fixtureDir = fileURLToPath(new URL("../test/fixtures/badges", import.meta.url));

describe("badge pack manifest", () => {
  it("loads the fixture manifest and validates every entry", async () => {
    const pack = await readBadgeManifest(fixtureDir);
    assert.equal(pack.badges.length, 5);
    assert.equal(pack.source, "https://github.com/klunn91/team-logos");
    const byEaId = new Map(pack.badges.map((badge) => [badge.eaTeamId, badge]));
    const arsenal = byEaId.get(1);
    assert.ok(arsenal, "arsenal fixture entry present");
    assert.equal(arsenal.ofmClubId, "arsenal");
    assert.equal(arsenal.file, "arsenal.png");
    assert.equal(
      arsenal.source,
      "https://github.com/klunn91/team-logos/blob/master/Premier_League/arsenal.png",
    );
    assert.equal(
      arsenal.checksum,
      "sha256:4cf481c111462ed2802ec6896240d9a137b72175bc8ccffe4e30073a8c5668dc",
    );
    const bournemouth = byEaId.get(1943);
    assert.ok(bournemouth, "bournemouth fixture entry present");
    assert.equal(bournemouth.ofmClubId, "afc-bournemouth");
    assert.equal(bournemouth.file, "bournemouth.png");
  });

  it("verifies every fixture checksum", async () => {
    const badges = await verifyBadgePack(fixtureDir);
    assert.equal(badges.length, 5);
    for (const badge of badges) {
      assert.ok(badge.path.endsWith(badge.file));
      assert.ok(Number.isInteger(badge.bytes) && badge.bytes > 0);
    }
  });

  it("names badge assets by EA team id inside the package", () => {
    assert.equal(badgeAssetPath({ eaTeamId: 1, file: "arsenal.png" }), "assets/clubs/1.png");
    assert.equal(badgeAssetPath({ eaTeamId: 7, file: "badge.svg" }), "assets/clubs/7.svg");
  });

  it("carries provenance into the packed manifest", () => {
    const entries = [
      {
        eaTeamId: 10001,
        ofmClubId: "arsenal",
        file: "arsenal.png",
        source: "https://example.com/arsenal.png",
        licence: "MIT",
        attribution: "Example",
        checksum: `sha256:${"a".repeat(64)}`,
      },
    ];
    const manifest = badgePackageManifest(
      { version: 1, source: "https://example.com", licence: "MIT" },
      entries,
    );
    assert.equal(manifest.badges.length, 1);
    assert.equal(manifest.badges[0].asset, "assets/clubs/10001.png");
    assert.equal(manifest.badges[0].ofmClubId, "arsenal");
    assert.equal(manifest.badges[0].source, "https://example.com/arsenal.png");
    assert.equal(manifest.badges[0].attribution, "Example");
  });

  it("refuses a pack with no manifest", async () => {
    const dir = await tempDir([]);
    await assert.rejects(
      readBadgeManifest(dir),
      (err) => err instanceof BadgePackError && /no badge manifest/.test(err.message),
    );
    await rm(dir, { recursive: true, force: true });
  });

  it("refuses a malformed entry", async () => {
    const dir = await tempDir([["manifest.json", JSON.stringify({ badges: [{ eaTeamId: 0 }] })]]);
    await assert.rejects(readBadgeManifest(dir), BadgePackError);
    await rm(dir, { recursive: true, force: true });
  });

  it("refuses a missing badge file", async () => {
    const dir = await tempDir([
      [
        "manifest.json",
        JSON.stringify({
          badges: [
            {
              eaTeamId: 1,
              ofmClubId: "example",
              file: "missing.png",
              source: "https://example.com/missing.png",
              licence: "MIT",
              attribution: "Example",
              checksum: `sha256:${"0".repeat(64)}`,
            },
          ],
        }),
      ],
    ]);
    await assert.rejects(
      verifyBadgePack(dir),
      (err) => err instanceof BadgePackError && /missing/.test(err.message),
    );
    await rm(dir, { recursive: true, force: true });
  });

  it("refuses a badge file that is not an image", async () => {
    const dir = await tempDir([
      [
        "manifest.json",
        JSON.stringify({
          badges: [
            {
              eaTeamId: 1,
              ofmClubId: "example",
              file: "not-an-image.png",
              source: "https://example.com/not-an-image.png",
              licence: "MIT",
              attribution: "Example",
              checksum: `sha256:${createHash("sha256").update("not an image").digest("hex")}`,
            },
          ],
        }),
      ],
      ["not-an-image.png", "not an image"],
    ]);
    await assert.rejects(
      verifyBadgePack(dir),
      (err) => err instanceof BadgePackError && /not a recognised image/.test(err.message),
    );
    await rm(dir, { recursive: true, force: true });
  });

  it("refuses a checksum mismatch", async () => {
    const manifest = JSON.parse(await readFile(path.join(fixtureDir, "manifest.json"), "utf8"));
    manifest.badges[0].checksum = `sha256:${"0".repeat(64)}`;
    const files = await fixtureFiles();
    const dir = await tempDir([["manifest.json", JSON.stringify(manifest)], ...files]);
    await assert.rejects(
      verifyBadgePack(dir),
      (err) => err instanceof BadgePackError && /mismatch/.test(err.message),
    );
    await rm(dir, { recursive: true, force: true });
  });
});

/** Copy listed `[name, content]` pairs into a fresh temp dir. */
async function tempDir(files) {
  const dir = path.join(
    tmpdir(),
    `ofm-badges-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(dir, { recursive: true });
  for (const [name, content] of files) {
    const full = path.join(dir, name);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content);
  }
  return dir;
}

/** All fixture files except the manifest, as `[name, Buffer]` pairs. */
async function fixtureFiles() {
  const files = [];
  for (const name of await readdir(fixtureDir)) {
    if (name === "manifest.json") continue;
    files.push([name, await readFile(path.join(fixtureDir, name))]);
  }
  return files;
}
