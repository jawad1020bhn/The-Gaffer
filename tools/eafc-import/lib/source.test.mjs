import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { it } from "node:test";
import { verifySourceLock } from "./source.mjs";

it("accepts the recorded source bytes independent of checkout commit", async () => {
  // Given the pinned file contents, when verified, then equivalent checkouts can reproduce the package.
  const directory = await mkdtemp(path.join(os.tmpdir(), "eafc-source-"));
  try {
    const bytes = Buffer.from("recorded source");
    await writeFile(path.join(directory, "source.db"), bytes);
    await assert.doesNotReject(
      verifySourceLock(directory, {
        files: [{ path: "source.db", sha256: createHash("sha256").update(bytes).digest("hex") }],
      }),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects changed source bytes before rebuilding a supposedly identical package", async () => {
  // Given a changed upstream database, when verified, then import requires an explicit provenance update.
  const directory = await mkdtemp(path.join(os.tmpdir(), "eafc-source-"));
  try {
    await writeFile(path.join(directory, "source.db"), "changed");
    await assert.rejects(
      verifySourceLock(directory, { files: [{ path: "source.db", sha256: "0".repeat(64) }] }),
      /source checksum mismatch/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
