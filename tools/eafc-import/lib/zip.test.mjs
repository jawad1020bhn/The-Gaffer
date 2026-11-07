import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { crc32, createZip, readZipEntries } from "./zip.mjs";

describe("crc32", () => {
  it("matches the standard check value", () => {
    assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  });
});

describe("createZip", () => {
  it("round-trips entries at the archive root", () => {
    const archive = createZip([
      { name: "package.json", data: '{"schema":"world"}' },
      { name: "players.json", data: "x".repeat(2000) },
    ]);
    const entries = readZipEntries(archive);
    assert.deepEqual(
      entries.map((entry) => entry.name),
      ["package.json", "players.json"],
    );
    assert.equal(entries[0].data.toString(), '{"schema":"world"}');
    assert.equal(entries[1].data.toString().length, 2000);
  });

  it("is byte-for-byte repeatable", () => {
    const entries = [{ name: "a.json", data: "hello" }];
    assert.deepEqual(createZip(entries), createZip(entries));
  });
});
