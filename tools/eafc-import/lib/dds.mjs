/**
 * Decode the club-crest DDS files that EA ships as `crest50x50/`.
 *
 * EA's 50×50 crest pack is a folder of 64×64 `.dds` images named by EA team id
 * (`l<id>.dds`), with the 50×50 crest artwork placed in the top-left corner and
 * transparent padding on the right and bottom edges. Unlike the legacy 16×16
 * pack, there is no separate `dark/` sibling folder, so crests whose geometry
 * or ink disappears against the game's dark surfaces are adapted deterministically
 * here after cropping to 50×50.
 *
 * Two DDS pixel formats appear in the pack:
 * - uncompressed 32-bit BGRA: a 128-byte DDS header followed by `B G R A` pixels.
 * - DXT5 / BC3: 8 bytes of interpolated alpha per 4×4 block followed by 8 bytes
 *   of interpolated colour.
 *
 * Nothing here guesses: an unsupported format is an error rather than a
 * blank crest, because a silently empty badge is indistinguishable in the UI
 * from a club that has no badge at all.
 */

import { deflateSync } from "node:zlib";

const HEADER_BYTES = 128;

/** Pixel width and height of EA's 50×50 crest region inside each 64×64 DDS. */
export const CREST_SIZE = 50;

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
        palette[2] = [
          Math.round((r0 + r1) / 2),
          Math.round((g0 + g1) / 2),
          Math.round((b0 + b1) / 2),
        ];
        palette[3] = [0, 0, 0];
      }
      const colourBits = view.getUint32(block + 12, true);

      for (let texel = 0; texel < 16; texel += 1) {
        const bitIndex = texel * 3;
        const alphaIndex =
          (alphaBits[bitIndex >>> 3] >>> (bitIndex & 7)) |
          (alphaBits[(bitIndex >>> 3) + 1] << (8 - (bitIndex & 7)));
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
  return decodeUncompressed(
    view,
    HEADER_BYTES,
    width,
    height,
    masks,
    Boolean(pfFlags & DDPF_ALPHAPIXELS),
  );
}

/* ── 50×50 cropping & dark-surface legibility ─────────────────────────────── */

/**
 * Crop an image to its top-left `width × height` region.
 *
 * EA packs 50×50 crests in the top-left of a 64×64 power-of-two DDS texture
 * with transparent padding on the right and bottom; stripping that padding
 * keeps crests centred when the UI renders them in circular or square frames.
 *
 * @param {{ width: number, height: number, pixels: Uint8Array }} image
 * @param {number} width
 * @param {number} height
 */
export function cropImage(image, width, height) {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new Error(`invalid crop dimensions ${width}×${height}`);
  }
  if (image.width < width || image.height < height) {
    throw new Error(`cannot crop ${image.width}×${image.height} image to ${width}×${height}`);
  }
  if (image.width === width && image.height === height) return image;
  const pixels = new Uint8Array(width * height * 4);
  const rowBytes = width * 4;
  for (let y = 0; y < height; y += 1) {
    const srcOffset = y * image.width * 4;
    pixels.set(image.pixels.subarray(srcOffset, srcOffset + rowBytes), y * rowBytes);
  }
  return { width, height, pixels };
}

/** Whether a pixel sinks into the dark app background (`#151d24`, RGB 21/29/36). */
function isNearDarkBackground(r, g, b) {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const distBg = Math.hypot(r - 21, g - 29, b - 36);
  return luma < 44 && distBg < 60;
}

/**
 * Ensure dark club crests stay legible on the app's dark surfaces (`#151d24`).
 *
 * Bright and well-contrasted crests (e.g. Arsenal, Barcelona, Real Madrid) are
 * returned unchanged. Only crests whose ink or outer contour would sink into
 * the dark background are adjusted:
 * 1. Ultra-dark low-contrast crests with essentially no bright pixels (e.g. Derby
 *    County, Swansea City, Napoli, Randers) are lifted to a crisp silver/ice-blue
 *    while neutralizing DXT5 near-black compression chroma drift.
 * 2. Deep dark-saturated ink (e.g. Metz crimson, Modena/Bolton/Falkirk navy) is
 *    gently brightened so team hues remain distinct from the dark canvas.
 * 3. Crests whose overall body and outer edge blend into `#151d24` (e.g. Dundee
 *    FC, Levante, Palermo, Houston Dynamo) receive a subtle 1 px light edge along
 *    dark perimeter pixels without touching internal contrast or bright crests.
 *
 * @param {{ width: number, height: number, pixels: Uint8Array }} image
 */
export function adaptForDarkBackground(image) {
  const { width, height, pixels } = image;
  let weightSum = 0;
  let lumaSum = 0;
  let chromaSum = 0;
  let brightWeight = 0;
  let darkSatWeight = 0;
  let edgeCount = 0;
  let darkEdgeCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const a = pixels[i + 3] / 255;
      if (a < 0.08) continue;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const maxC = Math.max(r, g, b);
      const chroma = maxC - Math.min(r, g, b);

      weightSum += a;
      lumaSum += luma * a;
      chromaSum += chroma * a;
      if (maxC >= 110) brightWeight += a;
      if (luma < 55 && chroma > 32) darkSatWeight += a;

      if (a >= 0.35) {
        let isEdge = false;
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (
            nx < 0 ||
            nx >= width ||
            ny < 0 ||
            ny >= height ||
            pixels[(ny * width + nx) * 4 + 3] < 50
          ) {
            isEdge = true;
            break;
          }
        }
        if (isEdge) {
          edgeCount += 1;
          if (isNearDarkBackground(r, g, b)) darkEdgeCount += 1;
        }
      }
    }
  }

  if (weightSum === 0) return image;
  const avgLuma = lumaSum / weightSum;
  const avgChroma = chromaSum / weightSum;
  const brightFrac = brightWeight / weightSum;
  const darkSatFrac = darkSatWeight / weightSum;
  const darkEdgeFrac = edgeCount > 0 ? darkEdgeCount / edgeCount : 0;

  const out = new Uint8Array(pixels);

  // 1. Ultra-dark/monochrome crests with virtually no bright details.
  if (avgLuma < 50 && brightFrac < 0.06 && (avgChroma < 65 || darkEdgeFrac > 0.6)) {
    for (let i = 0; i < out.length; i += 4) {
      if (out[i + 3] === 0) continue;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const maxC = Math.max(r, g, b);
      const chroma = maxC - Math.min(r, g, b);
      if (chroma < 26) {
        const gray = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
        const target = Math.min(242, Math.round(218 + (gray / 255) * 24));
        out[i] = target;
        out[i + 1] = target;
        out[i + 2] = target;
      } else {
        const lift = Math.max(155, 222 - avgLuma);
        const factor = (maxC + lift) / Math.max(1, maxC);
        const nr = Math.min(255, Math.round(r * factor));
        const ng = Math.min(255, Math.round(g * factor));
        const nb = Math.min(255, Math.round(b * factor));
        out[i] = Math.round(0.38 * 235 + 0.62 * nr);
        out[i + 1] = Math.round(0.38 * 240 + 0.62 * ng);
        out[i + 2] = Math.round(0.38 * 246 + 0.62 * nb);
      }
    }
    return { width, height, pixels: out };
  }

  let modified = false;

  // 2. Lift ultra-dark saturated hues (navy/crimson details that sink into #151d24).
  if (avgLuma < 58 || darkEdgeFrac >= 0.4 || (avgLuma < 120 && darkSatFrac >= 0.22)) {
    for (let i = 0; i < out.length; i += 4) {
      if (out[i + 3] === 0) continue;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const maxC = Math.max(r, g, b);
      const chroma = maxC - Math.min(r, g, b);
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (maxC > 40 && luma < 52 && chroma > 32) {
        const factor = Math.min(2.1, 70 / Math.max(12, luma));
        out[i] = Math.min(255, Math.round(r * factor));
        out[i + 1] = Math.min(255, Math.round(g * factor));
        out[i + 2] = Math.min(255, Math.round(b * factor));
        modified = true;
      }
    }
  }

  // 3. 1 px light rim around dark outer edges on overall-dark crests.
  if (avgLuma < 88 && brightFrac < 0.56 && darkEdgeFrac >= 0.65) {
    const base = new Uint8Array(out);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width + x) * 4;
        const a = base[idx + 3];
        if (a >= 200) continue;
        let maxNeighborDark = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const nIdx = (ny * width + nx) * 4;
            const na = base[nIdx + 3];
            if (na < 110) continue;
            const nr = base[nIdx];
            const ng = base[nIdx + 1];
            const nb = base[nIdx + 2];
            if (isNearDarkBackground(nr, ng, nb)) {
              const nl = 0.2126 * nr + 0.7152 * ng + 0.0722 * nb;
              const weight = (dx === 0 || dy === 0 ? 1.0 : 0.7) * (na / 255) * ((48 - nl) / 48);
              if (weight > maxNeighborDark) maxNeighborDark = weight;
            }
          }
        }
        if (maxNeighborDark > 0.14) {
          modified = true;
          const rimAlpha = Math.min(205, Math.round(maxNeighborDark * 240));
          if (a === 0) {
            out[idx] = 225;
            out[idx + 1] = 232;
            out[idx + 2] = 240;
            out[idx + 3] = rimAlpha;
          } else {
            const fa = a / 255;
            const ra = rimAlpha / 255;
            const outA = fa + ra * (1 - fa);
            out[idx] = Math.round((base[idx] * fa + 225 * ra * (1 - fa)) / outA);
            out[idx + 1] = Math.round((base[idx + 1] * fa + 232 * ra * (1 - fa)) / outA);
            out[idx + 2] = Math.round((base[idx + 2] * fa + 240 * ra * (1 - fa)) / outA);
            out[idx + 3] = Math.round(outA * 255);
          }
        }
      }
    }
  }

  return modified ? { width, height, pixels: out } : image;
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
 * @returns {Buffer}
 */
export function encodePng({ width, height, pixels }) {
  // Filter type 0 (None) on every row: a 50×50 crest is compact flat/antialiased
  // artwork, so extra filter passes cost more than they save.
  const rowBytes = width * 4;
  const stride = rowBytes + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0;
    const from = y * rowBytes;
    raw.set(pixels.subarray(from, from + rowBytes), rowStart + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
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
export function ddsToPng(data) {
  return encodePng(decodeDds(data));
}

/**
 * Decode a `crest50x50/` DDS file, crop to its 50×50 crest region, apply dark-UI
 * contrast adaptation, and encode as PNG.
 *
 * Both `scripts/build-club-badges.mjs` and `tools/eafc-import/badges-from-crest-pack.mjs`
 * call this so CI's byte-for-byte asset diff always matches.
 *
 * @param {Buffer} data
 * @param {{ size?: number, darkBackground?: boolean }} [options]
 * @returns {Buffer}
 */
export function crestDdsToPng(data, { size = CREST_SIZE, darkBackground = true } = {}) {
  const decoded = decodeDds(data);
  const cropped = cropImage(decoded, size, size);
  const adapted = darkBackground ? adaptForDarkBackground(cropped) : cropped;
  return encodePng(adapted);
}
