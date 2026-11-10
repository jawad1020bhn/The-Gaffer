/**
 * Decode the club-crest DDS files that EA ships as `crest16x16/`.
 *
 * EA's crest pack is a folder of 16×16 `.dds` images named by EA team id
 * (`l<id>.dds`, with a `dark/` sibling that is recoloured for a dark
 * background). The importer's graphics packs take PNG, so a badge pack built
 * from that folder has to decode these first. Two formats appear in it:
 *
 * - uncompressed 32-bit BGRA (2,036 of 2,052 files in the pack this was written
 *   against): a 128-byte DDS header then 1,024 bytes of `B G R A` pixels.
 * - DXT5 / BC3 (the other 16): 8 bytes of interpolated alpha per 4×4 block
 *   followed by 8 bytes of interpolated colour.
 *
 * Nothing here guesses: an unsupported format is an error rather than a
 * blank crest, because a silently empty badge is indistinguishable in the UI
 * from a club that has no badge at all.
 */

import { deflateSync } from "node:zlib";

const HEADER_BYTES = 128;

/** Code points in the DDS pixel-format block. */
const DDPF_FOURCC = 0x4;
const DDPF_RGB = 0x40;
const DDPF_ALPHAPIXELS = 0x1;

/** Uncompressed BGRA/RGBA: `{ width, height, pixels }` with RGBA bytes. */
function decodeUncompressed(view, dataOffset, width, height, masks, hasAlpha) {
  const { rMask, gMask, bMask, aMask } = masks;
  const pixelBytes = 4;
  const needed = dataOffset + width * height * pixelBytes;
  if (view.byteLength < needed) {
    throw new Error("DDS pixel data is truncated");
  }
  const pixels = new Uint8Array(width * height * 4);
  /** Value of a colour channel from a 32-bit pixel, given its bit mask. */
  const channel = (pixel, mask) => {
    if (mask === 0) return 0;
    // Sane DDS masks are contiguous runs of 8 bits at one of four offsets.
    let shift = 0;
    let bits = 0;
    for (let bit = 0; bit < 32; bit += 1) {
      if ((mask >>> bit) & 1) {
        if (bits === 0) shift = bit;
        bits += 1;
      }
    }
    const max = (1 << bits) - 1;
    const raw = (pixel >>> shift) & max;
    // Scale to 8 bits; a 24/32-bit mask lands exactly, 5/6-bit ones round.
    return bits === 8 ? raw : Math.round((raw / max) * 255);
  };
  for (let index = 0; index < width * height; index += 1) {
    const offset = dataOffset + index * pixelBytes;
    const pixel =
      (view.getUint8(offset) |
        (view.getUint8(offset + 1) << 8) |
        (view.getUint8(offset + 2) << 16) |
        (view.getUint8(offset + 3) << 24)) >>>
      0;
    pixels[index * 4] = channel(pixel, rMask);
    pixels[index * 4 + 1] = channel(pixel, gMask);
    pixels[index * 4 + 2] = channel(pixel, bMask);
    pixels[index * 4 + 3] = hasAlpha ? channel(pixel, aMask) : 255;
  }
  return { width, height, pixels };
}

/** Expand five- or six-bit colour components to eight bits. */
const expand5 = (value) => (value << 3) | (value >>> 2);
const expand6 = (value) => (value << 2) | (value >>> 4);

/** Decode DXT5/BC3: 4×4 blocks of interpolated alpha then interpolated colour. */
function decodeDxt5(view, dataOffset, width, height) {
  const pixels = new Uint8Array(width * height * 4);
  const blocksWide = Math.ceil(width / 4);
  const blocksHigh = Math.ceil(height / 4);
  const blockBytes = 16;
  if (view.byteLength < dataOffset + blocksWide * blocksHigh * blockBytes) {
    throw new Error("DDS DXT5 data is truncated");
  }

  const colour = Array.from({ length: 16 }, () => [0, 0, 0, 255]);

  for (let blockY = 0; blockY < blocksHigh; blockY += 1) {
    for (let blockX = 0; blockX < blocksWide; blockX += 1) {
      const block = dataOffset + (blockY * blocksWide + blockX) * blockBytes;

      // Alpha: two endpoint bytes, then 48 bits of 3-bit indices.
      const alpha0 = view.getUint8(block);
      const alpha1 = view.getUint8(block + 1);
      const alphaPalette = new Array(8).fill(255);
      alphaPalette[0] = alpha0;
      alphaPalette[1] = alpha1;
      if (alpha0 > alpha1) {
        for (let i = 1; i <= 6; i += 1) {
          alphaPalette[i + 1] = Math.round(((7 - i) * alpha0 + i * alpha1) / 7);
        }
      } else {
        for (let i = 1; i <= 4; i += 1) {
          alphaPalette[i + 1] = Math.round(((5 - i) * alpha0 + i * alpha1) / 5);
        }
        alphaPalette[6] = 0;
        alphaPalette[7] = 255;
      }
      const alphaBits = Array.from({ length: 6 }, (_, index) => view.getUint8(block + 2 + index));

      // Colour: two RGB565 endpoints and 16 2-bit indices.
      const colour0 = view.getUint16(block + 8, true);
      const colour1 = view.getUint16(block + 10, true);
      const r0 = expand5((colour0 >>> 11) & 0x1f);
      const g0 = expand6((colour0 >>> 5) & 0x3f);
      const b0 = expand5(colour0 & 0x1f);
      const r1 = expand5((colour1 >>> 11) & 0x1f);
      const g1 = expand6((colour1 >>> 5) & 0x3f);
      const b1 = expand5(colour1 & 0x1f);
      const palette = [
        [r0, g0, b0],
        [r1, g1, b1],
        [0, 0, 0],
        [0, 0, 0],
      ];
      if (colour0 > colour1) {
        palette[2] = [
          Math.round((2 * r0 + r1) / 3),
          Math.round((2 * g0 + g1) / 3),
          Math.round((2 * b0 + b1) / 3),
        ];
        palette[3] = [
          Math.round((r0 + 2 * r1) / 3),
          Math.round((g0 + 2 * g1) / 3),
          Math.round((b0 + 2 * b1) / 3),
        ];
      } else {
        palette[2] = [Math.round((r0 + r1) / 2), Math.round((g0 + g1) / 2), Math.round((b0 + b1) / 2)];
        palette[3] = [0, 0, 0];
      }
      const colourBits = view.getUint32(block + 12, true);

      for (let texel = 0; texel < 16; texel += 1) {
        const bitIndex = texel * 3;
        const alphaIndex =
          (alphaBits[bitIndex >>> 3] >>> (bitIndex & 7)) | (alphaBits[(bitIndex >>> 3) + 1] << (8 - (bitIndex & 7)));
        const [r, g, b] = palette[(colourBits >>> (texel * 2)) & 0x3];
        colour[texel] = [r, g, b, alphaPalette[(alphaIndex >>> 0) & 0x7]];
      }

      for (let texel = 0; texel < 16; texel += 1) {
        const x = blockX * 4 + (texel % 4);
        const y = blockY * 4 + Math.floor(texel / 4);
        if (x >= width || y >= height) continue;
        const [r, g, b, a] = colour[texel];
        const offset = (y * width + x) * 4;
        pixels[offset] = r;
        pixels[offset + 1] = g;
        pixels[offset + 2] = b;
        pixels[offset + 3] = a;
      }
    }
  }
  return { width, height, pixels };
}

/**
 * Decode one DDS file to `{ width, height, pixels }`, pixels being RGBA bytes.
 *
 * @param {Buffer} data
 */
export function decodeDds(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length < HEADER_BYTES || data.subarray(0, 4).toString("latin1") !== "DDS ") {
    throw new Error('not a DDS file (missing "DDS " magic)');
  }
  const height = view.getUint32(12, true);
  const width = view.getUint32(16, true);
  if (width === 0 || height === 0) throw new Error("DDS has a zero dimension");

  const pfFlags = view.getUint32(80, true);
  const fourCC = data.subarray(84, 88).toString("latin1");
  const masks = {
    rMask: view.getUint32(92, true),
    gMask: view.getUint32(96, true),
    bMask: view.getUint32(100, true),
    aMask: view.getUint32(104, true),
  };

  if (pfFlags & DDPF_FOURCC) {
    if (fourCC === "DXT5") return decodeDxt5(view, HEADER_BYTES, width, height);
    throw new Error(`unsupported DDS fourCC "${fourCC}"`);
  }
  if (!(pfFlags & DDPF_RGB)) {
    throw new Error("unsupported DDS pixel format (not RGB and not DXT5)");
  }
  return decodeUncompressed(view, HEADER_BYTES, width, height, masks, Boolean(pfFlags & DDPF_ALPHAPIXELS));
}

/* ── PNG encoding ────────────────────────────────────────────────────────── */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "latin1"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

/**
 * Encode RGBA pixels as a PNG, using `node:zlib` for the deflate stream.
 *
 * @param {{ width: number, height: number, pixels: Uint8Array }} image
 * @param {{ scale?: number }} [options] integer nearest-neighbour upscale
 * @returns {Buffer}
 */
export function encodePng({ width, height, pixels }, { scale = 1 } = {}) {
  if (!Number.isInteger(scale) || scale < 1) throw new Error(`invalid PNG scale ${scale}`);
  const outWidth = width * scale;
  const outHeight = height * scale;

  // Filter type 0 (None) on every row: a crest is 16 px of flat colour, so the
  // extra filter passes cost more than they save.
  const stride = outWidth * 4 + 1;
  const raw = Buffer.alloc(stride * outHeight);
  for (let y = 0; y < outHeight; y += 1) {
    const sourceY = Math.floor(y / scale);
    const rowStart = y * stride;
    raw[rowStart] = 0;
    for (let x = 0; x < outWidth; x += 1) {
      const sourceX = Math.floor(x / scale);
      const from = (sourceY * width + sourceX) * 4;
      const to = rowStart + 1 + x * 4;
      raw[to] = pixels[from];
      raw[to + 1] = pixels[from + 1];
      raw[to + 2] = pixels[from + 2];
      raw[to + 3] = pixels[from + 3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(outWidth, 0);
  ihdr.writeUInt32BE(outHeight, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** DDS bytes straight to PNG bytes. */
export function ddsToPng(data, options) {
  return encodePng(decodeDds(data), options);
}

/**
 * Repeat a decoded image until it is at least `target` pixels on its shortest
 * side, keeping whole multiples of the source so no pixel is invented.
 *
 * EA's crest pack is 16×16 and the team logo renders at up to 80 px, so an
 * unscaled crest is magnified by the browser with a smoothing filter and reads
 * as a smear. Scaling up in whole steps keeps the stripes and initials sharp
 * when the UI scales the rest of the way.
 */
export function upscaleToAtLeast(image, target) {
  const shortest = Math.min(image.width, image.height);
  return Math.max(1, Math.ceil(target / shortest));
}
