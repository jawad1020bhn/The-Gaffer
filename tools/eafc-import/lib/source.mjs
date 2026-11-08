import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Pin input bytes, not a Git checkout: identical published kits can reproduce the same import. */
export async function verifySourceLock(kitDirectory, lock) {
  for (const file of lock.files) {
    const bytes = await readFile(path.join(kitDirectory, file.path));
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== file.sha256) {
      throw new Error(
        `source checksum mismatch: ${file.path}. Review the roster changes and update tools/eafc-import/data/fc27-source-lock.json explicitly before importing.`,
      );
    }
  }
}
