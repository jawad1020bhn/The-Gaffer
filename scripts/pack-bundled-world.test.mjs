// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readZipEntries } from "../tools/eafc-import/lib/zip.mjs";
import { BUNDLED_WORLDS, packBundledWorld, sourceDigest } from "./pack-bundled-world.mjs";

let root;

/** A minimal package directory: the four files the loader needs, and a stray doc. */
async function writeSource(dir, { id = "test-world", packageType = "database" } = {}) {
  await fs.mkdir(path.join(dir, "assets/clubs"), { recursive: true });
  await fs.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ schema: "world", id, name: "Test World", packageType }),
  );
  await fs.writeFile(
    path.join(dir, "teams.json"),
    JSON.stringify({ schema: "team", items: [{ id: "arsenal", name: "Arsenal" }] }),
  );
  await fs.writeFile(
    path.join(dir, "players.json"),
    JSON.stringify({ schema: "player", items: [{ id: "p1", name: "A Player" }] }),
  );
  await fs.writeFile(path.join(dir, "README.md"), "# Test World\n");
  await fs.writeFile(path.join(dir, "assets/clubs/1.png"), Buffer.from([137, 80, 78, 71]));
  return dir;
}

const world = {
  id: "test-world",
  source: "mods/test-world",
  output: "src-tauri/packages/test-world.ofm",
};

async function pack() {
  return packBundledWorld(world, root);
}

async function entriesOf(output) {
  return readZipEntries(await fs.readFile(output));
}

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "ofm-pack-world-"));
  await writeSource(path.join(root, world.source));
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("packBundledWorld", () => {
  /**
   * Given a package directory
   * When it is packed
   * Then every file sits at the archive root under its own relative path, which is the layout
   *      `load_world_package_from_ofm` reads and `ofm-cli pack` writes.
   */
  it("packs every file at the archive root, assets included", async () => {
    const result = await pack();

    expect(result.written).toBe(true);
    expect((await entriesOf(result.output)).map((entry) => entry.name)).toEqual([
      "README.md",
      "assets/clubs/1.png",
      "package.json",
      "players.json",
      "teams.json",
    ]);
  });

  /**
   * Given a packed world
   * When its entries are read back
   * Then the bytes are the source's, so the archive is the database rather than a summary of it.
   */
  it("round-trips the source bytes", async () => {
    const result = await pack();
    const entries = await entriesOf(result.output);
    const teams = entries.find((entry) => entry.name === "teams.json");

    expect(JSON.parse(teams.data.toString())).toEqual({
      schema: "team",
      items: [{ id: "arsenal", name: "Arsenal" }],
    });
    expect(entries.find((entry) => entry.name === "assets/clubs/1.png").data).toEqual(
      Buffer.from([137, 80, 78, 71]),
    );
  });

  /**
   * Given an archive already packed from this content
   * When the packer runs again
   * Then it does no work. `predev` and `prebuild` run this on every start, so the second run has
   *      to be cheap enough that nobody is tempted to skip the hook.
   */
  it("skips the rebuild when the content has not changed", async () => {
    await pack();
    const again = await pack();

    expect(again.written).toBe(false);
    expect(again.bytes).toBeGreaterThan(0);
  });

  /**
   * Given a packed world whose data is then edited
   * When the packer runs again
   * Then it repacks. A stale archive would ship the previous roster, and nothing on screen would
   *      say so — the world would simply be out of date.
   */
  it("repacks when a source file changes", async () => {
    await pack();
    const file = path.join(root, world.source, "teams.json");
    await fs.writeFile(
      file,
      JSON.stringify({ schema: "team", items: [{ id: "arsenal", name: "Arsenal FC" }] }),
    );

    const result = await pack();

    expect(result.written).toBe(true);
    const teams = (await entriesOf(result.output)).find((entry) => entry.name === "teams.json");
    expect(JSON.parse(teams.data.toString()).items[0].name).toBe("Arsenal FC");
  });

  /**
   * Given a packed world
   * When a file is added rather than edited
   * Then the digest notices. Hashing only the files already listed would miss a new badge pack.
   */
  it("repacks when a file is added", async () => {
    await pack();
    await fs.writeFile(
      path.join(root, world.source, "competitions.json"),
      '{"schema":"competition","items":[]}',
    );

    expect((await pack()).written).toBe(true);
  });

  /**
   * Given the same content packed twice from scratch
   * When the two archives are compared
   * Then they are byte-identical, so a rebuild is not a diff and two machines agree.
   */
  it("produces the same bytes for the same content", async () => {
    const first = await pack();
    const bytes = await fs.readFile(first.output);
    await fs.rm(first.output);
    await fs.rm(`${first.output}.sha256`);
    const second = await pack();

    expect(await fs.readFile(second.output)).toEqual(bytes);
  });

  /**
   * Given a package whose manifest id disagrees with the name it is shipped under
   * When it is packed
   * Then it fails loudly. The loader looks the world up as `<id>.ofm`, so a mismatch ships an
   *      archive nothing selects and the game silently returns to a generated world.
   */
  it("refuses a manifest id that disagrees with the shipped name", async () => {
    const bad = { id: "other-id", source: "mods/bad", output: "src-tauri/packages/bad.ofm" };
    await writeSource(path.join(root, bad.source), { id: "declared-id" });

    await expect(packBundledWorld(bad, root)).rejects.toThrow(/declares id "declared-id"/);
  });

  /**
   * Given a patch package rather than a database
   * When it is offered as the shipped world
   * Then it is refused: a patch cannot build a world on its own, so pre-selecting it would leave
   *      the player with nothing to play.
   */
  it("refuses a package that is not a database", async () => {
    const bad = { id: "patch", source: "mods/patch", output: "src-tauri/packages/patch.ofm" };
    await writeSource(path.join(root, bad.source), { id: "patch", packageType: "patch" });

    await expect(packBundledWorld(bad, root)).rejects.toThrow(/Only a database/);
  });

  /**
   * Given a checkout with the world directory missing
   * When the packer runs
   * Then it fails rather than writing an empty archive, because an empty world is the failure
   *      this whole mechanism exists to prevent.
   */
  it("refuses to pack a world that is not there", async () => {
    const missing = { id: "gone", source: "mods/gone", output: "src-tauri/packages/gone.ofm" };

    await expect(packBundledWorld(missing, root)).rejects.toThrow(/is missing/);
  });
});

describe("the world this repository ships", () => {
  /**
   * Given the shipped-world list
   * When its entries are checked against the repository
   * Then each names a real database whose manifest agrees, so the default cannot rot into a
   *      missing directory or a renamed id that the new-game screen would never pre-select.
   */
  it.each(BUNDLED_WORLDS)("ships $id as a database", async (entry) => {
    const repoRoot = path.resolve(import.meta.dirname, "..");
    const manifest = JSON.parse(
      await fs.readFile(path.join(repoRoot, entry.source, "package.json"), "utf8"),
    );

    expect(manifest.id).toBe(entry.id);
    expect(manifest.packageType).toBe("database");
    expect(path.basename(entry.output)).toBe(`${entry.id}.ofm`);
    expect(await sourceDigest(path.join(repoRoot, entry.source))).toMatch(/^[0-9a-f]{64}$/);
  });

  /**
   * Given the Tauri bundle config
   * When the shipped worlds are looked up in it
   * Then each is declared as a resource landing in `packages/`, which is the only place
   *      `bundled_packages_dir` searches. Packing an archive nothing declares would leave every
   *      installed build on a generated world.
   */
  it.each(BUNDLED_WORLDS)("declares $id as a Tauri resource", async (entry) => {
    const repoRoot = path.resolve(import.meta.dirname, "..");
    const config = JSON.parse(
      await fs.readFile(path.join(repoRoot, "src-tauri/tauri.conf.json"), "utf8"),
    );
    const declaredIn = path.relative(
      path.join(repoRoot, "src-tauri"),
      path.join(repoRoot, entry.output),
    );

    expect(config.bundle.resources[declaredIn]).toBe(`packages/${entry.id}.ofm`);
  });
});
