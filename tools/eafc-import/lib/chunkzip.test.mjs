/**
 * Unwrapping EA's `chunkzip` container.
 *
 * Most of the league logos EA ships are not DDS files on disk: each is a DDS
 * cut into blocks, every block deflated on its own, behind a `chunkzip` header.
 * A logo that fails to unwrap must fail loudly — a half-inflated texture decodes
 * to a plausible image with the bottom missing, which is worse than no logo.
 *
 * The containers here are written by the test itself, to the layout the real
 * files have, so no EA file is needed to run this.
 */

import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { describe, it } from "node:test";

import { isChunkzip, unwrapChunkzip } from "./chunkzip.mjs";

/**
 * Wrap `payload` the way EA does: a 28-byte big-endian header, then each block
 * as zero padding, an 8-byte block header and a raw deflate stream. The padding
 * is whatever puts the deflate stream on a multiple of `alignment`.
 */
function chunkzip(payload, { blockSize = 16, alignment = 16, version = 2, blockType = 1 } = {}) {
  const blockCount = Math.ceil(payload.length / blockSize);
  const header = Buffer.alloc(28);
  header.write("chunkzip", 0, "latin1");
  header.writeUInt32BE(version, 8);
  header.writeUInt32BE(payload.length, 12);
  header.writeUInt32BE(blockSize, 16);
  header.writeUInt32BE(blockCount, 20);
  header.writeUInt32BE(alignment, 24);

  const parts = [header];
  let position = header.length;
  for (let block = 0; block < blockCount; block += 1) {
    const padding = (alignment - ((position + 8) % alignment)) % alignment;
    const deflated = deflateRawSync(payload.subarray(block * blockSize, (block + 1) * blockSize));
    const blockHeader = Buffer.alloc(8);
    blockHeader.writeUInt32BE(deflated.length, 0);
    blockHeader.writeUInt32BE(blockType, 4);
    parts.push(Buffer.alloc(padding), blockHeader, deflated);
    position += padding + 8 + deflated.length;
  }
  return Buffer.concat(parts);
}

/** Bytes that do not repeat, so a block put back in the wrong place is visible. */
const payloadOf = (length) => Buffer.from(Array.from({ length }, (_, index) => (index * 7) % 251));

describe("isChunkzip", () => {
  it("tells a wrapped texture from a bare one", () => {
    assert.equal(isChunkzip(chunkzip(payloadOf(40))), true);
    assert.equal(isChunkzip(Buffer.from("DDS |\0\0\0", "latin1")), false);
  });

  it("does not mistake a file too short to hold the magic", () => {
    assert.equal(isChunkzip(Buffer.from("chunk", "latin1")), false);
  });
});

describe("unwrapChunkzip", () => {
  it("returns the bytes EA wrapped, across blocks and a short last one", () => {
    // 40 bytes in blocks of 16: two full blocks and one of 8.
    const payload = payloadOf(40);
    assert.deepEqual(unwrapChunkzip(chunkzip(payload)), payload);
  });

  it("skips the padding that puts each block on its alignment", () => {
    // A 28-byte header and an 8-byte block header leave the first deflate
    // stream at 36, so EA pads it to 48. Reading the block header from 28 would
    // take twelve zero bytes for a length.
    const payload = payloadOf(16);
    const wrapped = chunkzip(payload);
    assert.deepEqual(
      [...wrapped.subarray(28, 40)],
      Array.from({ length: 12 }, () => 0),
    );
    assert.deepEqual(unwrapChunkzip(wrapped), payload);
  });

  it("refuses a file that is not a chunkzip container", () => {
    assert.throws(
      () => unwrapChunkzip(Buffer.from("DDS and then some bytes that follow it")),
      /chunkzip/,
    );
  });

  it("refuses a container version it has never seen", () => {
    assert.throws(() => unwrapChunkzip(chunkzip(payloadOf(16), { version: 3 })), /version 3/);
  });

  it("refuses a block that is not deflated", () => {
    // Every block EA writes is type 1. Anything else is a layout this has not
    // been checked against, and inflating it would be a guess.
    assert.throws(() => unwrapChunkzip(chunkzip(payloadOf(16), { blockType: 0 })), /block type 0/);
  });

  it("refuses a container that stops short", () => {
    const wrapped = chunkzip(payloadOf(40));
    assert.throws(() => unwrapChunkzip(wrapped.subarray(0, wrapped.length - 5)), /truncated/);
    assert.throws(() => unwrapChunkzip(wrapped.subarray(0, 20)), /truncated/);
  });

  it("refuses blocks that do not add up to the size the header declares", () => {
    const wrapped = chunkzip(payloadOf(40));
    wrapped.writeUInt32BE(41, 12);
    assert.throws(() => unwrapChunkzip(wrapped), /40 bytes.*41/);
  });

  it("refuses an alignment of zero rather than dividing by it", () => {
    const wrapped = chunkzip(payloadOf(16));
    wrapped.writeUInt32BE(0, 24);
    assert.throws(() => unwrapChunkzip(wrapped), /alignment/);
  });
});
