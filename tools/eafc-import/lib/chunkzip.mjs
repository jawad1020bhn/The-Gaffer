/**
 * Unwrap EA's `chunkzip` container.
 *
 * EA does not store every texture as a bare file. Most of the league logos in
 * `leagues/` are a DDS cut into fixed-size blocks, each block deflated on its
 * own, behind a small header — still named `l<id>.dds`, so the extension says
 * nothing about which kind a file is. The magic does.
 *
 * The layout, every field big-endian:
 *
 *   0   "chunkzip"
 *   8   u32 version (2)
 *   12  u32 size of the unwrapped file
 *   16  u32 block size (every block but the last unwraps to this many bytes)
 *   20  u32 block count
 *   24  u32 alignment (16)
 *   28  the blocks, each: zero padding, u32 deflated size, u32 block type (1),
 *       then a raw deflate stream
 *
 * The padding before a block is whatever puts its deflate stream — not its
 * header — on a multiple of the alignment.
 *
 * Nothing here guesses: a version, block type or size that does not match what
 * the real files carry is an error, because a half-unwrapped texture still
 * decodes, to a logo with the bottom missing.
 */

import { inflateRawSync } from "node:zlib";

const MAGIC = "chunkzip";
const HEADER_BYTES = 28;
const BLOCK_HEADER_BYTES = 8;
const SUPPORTED_VERSION = 2;

/** The one block type the real files use: a raw deflate stream. */
const BLOCK_DEFLATE = 1;

/** Whether `data` is a chunkzip container rather than a bare file. */
export function isChunkzip(data) {
  return data.length >= MAGIC.length && data.subarray(0, MAGIC.length).toString("latin1") === MAGIC;
}

/**
 * The file inside a chunkzip container.
 *
 * @param {Buffer} data
 * @returns {Buffer}
 */
export function unwrapChunkzip(data) {
  if (!isChunkzip(data)) {
    throw new Error('not a chunkzip container (missing "chunkzip" magic)');
  }
  if (data.length < HEADER_BYTES) throw new Error("chunkzip header is truncated");

  const version = data.readUInt32BE(8);
  if (version !== SUPPORTED_VERSION) {
    throw new Error(`unsupported chunkzip version ${version}`);
  }
  const size = data.readUInt32BE(12);
  const blockCount = data.readUInt32BE(20);
  const alignment = data.readUInt32BE(24);
  if (alignment === 0) throw new Error("chunkzip alignment is zero");

  const blocks = [];
  let position = HEADER_BYTES;
  for (let block = 0; block < blockCount; block += 1) {
    position += (alignment - ((position + BLOCK_HEADER_BYTES) % alignment)) % alignment;
    if (position + BLOCK_HEADER_BYTES > data.length) {
      throw new Error(`chunkzip block ${block} is truncated`);
    }
    const deflatedSize = data.readUInt32BE(position);
    const blockType = data.readUInt32BE(position + 4);
    if (blockType !== BLOCK_DEFLATE) {
      throw new Error(`unsupported chunkzip block type ${blockType} in block ${block}`);
    }
    position += BLOCK_HEADER_BYTES;
    if (position + deflatedSize > data.length) {
      throw new Error(`chunkzip block ${block} is truncated`);
    }
    blocks.push(inflateRawSync(data.subarray(position, position + deflatedSize)));
    position += deflatedSize;
  }

  const unwrapped = Buffer.concat(blocks);
  if (unwrapped.length !== size) {
    throw new Error(
      `chunkzip blocks unwrap to ${unwrapped.length} bytes, but the header declares ${size}`,
    );
  }
  return unwrapped;
}
