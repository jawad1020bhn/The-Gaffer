import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { it } from "node:test";
import { createZip } from "./zip.mjs";

const cli = fileURLToPath(new URL("../audit.mjs", import.meta.url));
const run = (target) =>
  JSON.parse(execFileSync(process.execPath, [cli, target, "--json"], { encoding: "utf8" }));

it("audits a directory and its archive identically without rewriting source bytes", async () => {
  // Given the same JSON in a directory and archive, when the CLI reads both, then reports and original bytes agree.
  const directory = await mkdtemp(path.join(os.tmpdir(), "eafc-audit-"));
  try {
    const documents = {
      "package.json": { schema: "world", baseYear: 2027 },
      "teams.json": { schema: "team", items: [{ id: "club", name: "Club" }] },
      "players.json": {
        schema: "player",
        items: [{ id: "player", club: "club", contractEnd: "2026-06-30" }],
      },
    };
    const entries = Object.entries(documents).map(([name, document]) => ({
      name,
      data: Buffer.from(JSON.stringify(document)),
    }));
    for (const entry of entries) await writeFile(path.join(directory, entry.name), entry.data);
    const archive = createZip(entries);
    const archivePath = path.join(directory, "package.ofm");
    await writeFile(archivePath, archive);
    const fromDirectory = run(directory);
    assert.deepEqual(run(archivePath), fromDirectory);
    assert.equal(fromDirectory.contractsBeforeBaseYear.length, 1);
    assert.equal(fromDirectory.coverage.wage.missing, 1);
    for (const entry of entries)
      assert.deepEqual(await readFile(path.join(directory, entry.name)), entry.data);
    assert.deepEqual(await readFile(archivePath), archive);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("reports usage errors with a nonzero exit status", () => {
  // Given no input path, when invoked, then the CLI explains usage rather than reporting empty coverage.
  const result = spawnSync(process.execPath, [cli], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage:/);
});

it("reports unreadable inputs as failures rather than clean audits", async () => {
  // Given a missing package in an isolated directory, when invoked, then the CLI fails clearly.
  const directory = await mkdtemp(path.join(os.tmpdir(), "eafc-audit-"));
  try {
    const result = spawnSync(process.execPath, [cli, path.join(directory, "missing"), "--json"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /audit failed:/);
    assert.equal(result.stdout, "");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
