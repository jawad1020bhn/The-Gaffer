#!/usr/bin/env node
/**
 * Packs the world the game ships into `src-tauri/packages/`, so a new career starts on real
 * clubs without the player importing anything.
 *
 * The game already knows how to do this: `list_installed_packages` copies every `.ofm` it finds
 * in `packages/` beside the executable into the player's own package directory, marks it
 * `bundled`, and the new-game screen pre-selects a bundled database. Until now only the Windows
 * portable workflow assembled that folder by hand, so every installed build and `tauri dev`
 * still opened on a generated world of fictional clubs. Declaring the archive as a Tauri
 * resource puts it in the same place for every build, and this script is what writes it.
 *
 * Why not `ofm-cli pack`, which the portable workflow uses? That needs a Rust build first, and
 * this has to run *before* one: `src-tauri/build.rs` calls it so the declared resource exists by
 * the time tauri-build looks for it. `predev` and `prebuild` call it too, for the npm-only paths.
 * So it reuses the importer's dependency-free zip writer rather than the CLI. Both produce a zip
 * whose entries sit at the root, which is all a `.ofm` is.
 *
 * Being called from build.rs is why this must never need `npm ci`: a bare `cargo test --workspace`
 * has to work on a fresh checkout with nothing but Node on PATH.
 *
 * The archive is generated, never committed: `mods/eafc-fc27/` is the source of truth, and a
 * committed binary would conflict on every data change (see scripts/check-untracked-generated.sh).
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createZip } from "../tools/eafc-import/lib/zip.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The worlds every build ships. `id` must equal the package's own `id`, because that is the name
 * the loader looks up (`<id>.ofm`) and the id the new-game screen pre-selects.
 */
export const BUNDLED_WORLDS = [
  { id: "eafc-fc27", source: "mods/eafc-fc27", output: "src-tauri/packages/eafc-fc27.ofm" },
];

/** Every file under `dir`, as sorted `/`-separated paths relative to it. */
async function listFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(full, base)));
    } else if (entry.isFile()) {
      files.push(path.relative(base, full).split(path.sep).join("/"));
    }
  }
  // Sorted so the archive does not depend on directory order, and two machines produce the same
  // bytes. `export_directory_to_ofm` walks unsorted; nothing reads order, but a stable archive
  // lets the stamp below mean "the same content" rather than "the same luck".
  return files.sort();
}

/**
 * A digest of what the archive would contain: every path and its bytes.
 *
 * Taken over content rather than mtimes because a fresh checkout gives every file the same
 * checkout time, which would make an mtime check either always rebuild or never rebuild.
 */
export async function sourceDigest(sourceDir) {
  const hash = createHash("sha256");
  for (const name of await listFiles(sourceDir)) {
    hash.update(name).update("\0");
    hash.update(await readFile(path.join(sourceDir, name)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

/**
 * Pack one world, unless the archive already holds exactly this content.
 *
 * @returns {Promise<{ id: string, output: string, written: boolean, bytes: number }>}
 */
export async function packBundledWorld(world, repoRoot = REPO_ROOT) {
  const sourceDir = path.join(repoRoot, world.source);
  const output = path.join(repoRoot, world.output);
  const stampPath = `${output}.sha256`;

  if (!existsSync(sourceDir)) {
    throw new Error(
      `pack-bundled-world: ${world.source} is missing. It is the world the game ships; ` +
        "restore it from git rather than starting without it.",
    );
  }

  const manifest = JSON.parse(await readFile(path.join(sourceDir, "package.json"), "utf8"));
  // A mismatch here would ship an archive the loader cannot find by id, and the new-game screen
  // would quietly fall back to a generated world — the exact failure this script exists to end.
  if (manifest.id !== world.id) {
    throw new Error(
      `pack-bundled-world: ${world.source}/package.json declares id "${manifest.id}", ` +
        `but it is shipped as "${world.id}". They must agree.`,
    );
  }
  if (manifest.packageType !== "database") {
    throw new Error(
      `pack-bundled-world: ${world.id} is a "${manifest.packageType}" package. Only a database ` +
        "can build a world on its own, so only a database is pre-selected.",
    );
  }

  const digest = await sourceDigest(sourceDir);
  if (existsSync(output) && existsSync(stampPath)) {
    const stamp = (await readFile(stampPath, "utf8")).trim();
    if (stamp === digest) {
      return { id: world.id, output, written: false, bytes: (await stat(output)).size };
    }
  }

  const entries = await Promise.all(
    (await listFiles(sourceDir)).map(async (name) => ({
      name,
      data: await readFile(path.join(sourceDir, name)),
    })),
  );
  const archive = createZip(entries);

  await mkdir(path.dirname(output), { recursive: true });
  // The stamp is written after the archive, so an interrupted run leaves a stale stamp and the
  // next one repacks rather than trusting a half-written file.
  await writeFile(output, archive);
  await writeFile(stampPath, `${digest}\n`);
  return { id: world.id, output, written: true, bytes: archive.length };
}

/** Pack every shipped world. */
export async function packBundledWorlds(repoRoot = REPO_ROOT) {
  const results = [];
  for (const world of BUNDLED_WORLDS) {
    results.push(await packBundledWorld(world, repoRoot));
  }
  return results;
}

// Only report when it did work: `predev` and `prebuild` run this on every start, and a line each
// time would be noise. A rebuild is worth a line because it takes a second and explains the wait.
export async function main(repoRoot = REPO_ROOT) {
  for (const result of await packBundledWorlds(repoRoot)) {
    if (result.written) {
      const mb = (result.bytes / 1024 / 1024).toFixed(1);
      console.log(`pack-bundled-world: ${result.id} packed (${mb} MB) — the default world.`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
