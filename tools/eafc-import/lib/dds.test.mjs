/**
 * Decoding EA's 50×50 crest DDS files, cropping from 64×64, adapting dark crests
 * for dark surfaces, and encoding as PNG.
 *
 * These are the steps between `crest50x50/l<id>.dds` and a file a browser can
 * draw, so each is checked against bytes whose pixels are known exactly — no EA
 * files are needed to run this.
 */

import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { describe, it } from "node:test";

import {
  CREST_SIZE,
  adaptForDarkBackground,
  crestDdsToPng,
  cropImage,
  decodeDds,
  ddsToPng,
  encodePng,
} from "./dds.mjs";

/** A DDS header for an uncompressed 32-bit image, masks in the order EA ships. */
function bgraDds(width, height, pixels) {
  const header = Buffer.alloc(128);
  header.write("DDS ", 0, "latin1");
  header.writeUInt32LE(124, 4); // dwSize
  header.writeUInt32LE(0x1 | 0x2 | 0x4 | 0x1000, 8); // caps
  header.writeUInt32LE(height, 12);
  header.writeUInt32LE(width, 16);
  header.writeUInt32LE(width * height * 4, 20); // pitch
  header.writeUInt32LE(0x1, 76); // pfSize
  header.writeUInt32LE(0x40 | 0x1, 80); // pfFlags: RGB | ALPHAPIXELS
  header.writeUInt32LE(32, 84); // bit count
  header.writeUInt32LE(0xff0000, 92); // red
  header.writeUInt32LE(0xff00, 96); // green
  header.writeUInt32LE(0xff, 100); // blue
  header.writeUInt32LE(0xff000000, 104); // alpha
  const data = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = pixels[index][2]; // blue
    data[index * 4 + 1] = pixels[index][1]; // green
    data[index * 4 + 2] = pixels[index][0]; // red
    data[index * 4 + 3] = pixels[index][3];
  }
  return Buffer.concat([header, data]);
}

/**
 * A DXT5 image whose single 4×4 block holds one flat colour, so the expected
 * RGBA is known exactly: both colour endpoints equal, every index 0.
 */
function dxt5Dds(r, g, b, a) {
  const header = Buffer.alloc(128);
  header.write("DDS ", 0, "latin1");
  header.writeUInt32LE(124, 4);
  header.writeUInt32LE(0x1 | 0x2 | 0x4 | 0x1000, 8);
  header.writeUInt32LE(4, 12);
  header.writeUInt32LE(4, 16);
  header.writeUInt32LE(0x1, 76);
  header.writeUInt32LE(0x4, 80); // pfFlags: FOURCC
  header.write("DXT5", 84, "latin1");
  header.writeUInt32LE(32, 88);

  const block = Buffer.alloc(16);
  block[0] = a;
  block[1] = a;
  const colour = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
  block.writeUInt16LE(colour, 8);
  block.writeUInt16LE(colour, 10);
  block.writeUInt32LE(0, 12);
  return Buffer.concat([header, block]);
}

/**
 * One DXT5 block from its parts: two alpha endpoints and sixteen 3-bit alpha
 * indices, then two RGB565 endpoints and sixteen 2-bit colour indices. Texels
 * run left to right, top to bottom, lowest bits first.
 */
function dxt5Block({ alpha, alphaIndices, colours, colourIndices }) {
  const block = Buffer.alloc(16);
  block[0] = alpha[0];
  block[1] = alpha[1];
  let alphaBits = 0n;
  for (const [texel, index] of alphaIndices.entries()) {
    alphaBits |= BigInt(index) << BigInt(texel * 3);
  }
  for (let byte = 0; byte < 6; byte += 1) {
    block[2 + byte] = Number((alphaBits >> BigInt(byte * 8)) & 0xffn);
  }
  block.writeUInt16LE(colours[0], 8);
  block.writeUInt16LE(colours[1], 10);
  let colourBits = 0;
  for (const [texel, index] of colourIndices.entries()) {
    colourBits = (colourBits | (index << (texel * 2))) >>> 0;
  }
  block.writeUInt32LE(colourBits, 12);
  return block;
}

/** A DXT5 image of any size from its blocks, in row-major block order. */
function dxt5Image(width, height, blocks) {
  const header = Buffer.alloc(128);
  header.write("DDS ", 0, "latin1");
  header.writeUInt32LE(124, 4);
  header.writeUInt32LE(0x1 | 0x2 | 0x4 | 0x1000, 8);
  header.writeUInt32LE(height, 12);
  header.writeUInt32LE(width, 16);
  header.writeUInt32LE(0x1, 76);
  header.writeUInt32LE(0x4, 80); // pfFlags: FOURCC
  header.write("DXT5", 84, "latin1");
  return Buffer.concat([header, ...blocks]);
}

const every = (value) => Array.from({ length: 16 }, () => value);
const RGB565_WHITE = 0xffff;
const RGB565_BLACK = 0x0000;
const RGB565_RED = 0xf800;
const RGB565_BLUE = 0x001f;

const pixelAt = (image, x, y) => {
  const offset = (y * image.width + x) * 4;
  return [...image.pixels.subarray(offset, offset + 4)];
};

function solidImage(width, height, [r, g, b, a]) {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    pixels[i * 4] = r;
    pixels[i * 4 + 1] = g;
    pixels[i * 4 + 2] = b;
    pixels[i * 4 + 3] = a;
  }
  return { width, height, pixels };
}

describe("decodeDds", () => {
  it("swaps the BGRA byte order EA writes into RGBA", () => {
    const image = decodeDds(
      bgraDds(2, 1, [
        [10, 20, 30, 255],
        [40, 50, 60, 128],
      ]),
    );
    assert.equal(image.width, 2);
    assert.deepEqual(pixelAt(image, 0, 0), [10, 20, 30, 255]);
    assert.deepEqual(pixelAt(image, 1, 0), [40, 50, 60, 128]);
  });

  it("decodes a DXT5 block", () => {
    const image = decodeDds(dxt5Dds(200, 100, 50, 255));
    const [r, g, b, a] = pixelAt(image, 1, 1);
    assert.ok(r >= 196, `red ${r}`);
    assert.ok(g >= 96, `green ${g}`);
    assert.ok(b >= 48, `blue ${b}`);
    assert.equal(a, 255);
  });

  it("steps a DXT5 block's alpha through six shades between its endpoints", () => {
    // The first endpoint being the larger selects the eight-value palette:
    // both endpoints, then six evenly spaced shades from the first to the second.
    const image = decodeDds(
      dxt5Image(4, 4, [
        dxt5Block({
          alpha: [255, 0],
          alphaIndices: [0, 1, 2, 3, 4, 5, 6, 7, ...Array.from({ length: 8 }, () => 0)],
          colours: [RGB565_WHITE, RGB565_WHITE],
          colourIndices: every(0),
        }),
      ]),
    );
    const alphas = Array.from(
      { length: 8 },
      (_, texel) => pixelAt(image, texel % 4, texel >> 2)[3],
    );
    assert.deepEqual(alphas, [255, 0, 219, 182, 146, 109, 73, 36]);
  });

  it("keeps a DXT5 block's fully clear and fully solid alpha steps", () => {
    // The first endpoint not being the larger selects four shades between the
    // endpoints plus explicit 0 and 255: how a block holds a hard edge and a
    // soft one at once.
    const image = decodeDds(
      dxt5Image(4, 4, [
        dxt5Block({
          alpha: [0, 255],
          alphaIndices: [0, 1, 2, 3, 4, 5, 6, 7, ...Array.from({ length: 8 }, () => 0)],
          colours: [RGB565_WHITE, RGB565_WHITE],
          colourIndices: every(0),
        }),
      ]),
    );
    const alphas = Array.from(
      { length: 8 },
      (_, texel) => pixelAt(image, texel % 4, texel >> 2)[3],
    );
    assert.deepEqual(alphas, [0, 255, 51, 102, 153, 204, 0, 255]);
  });

  it("blends a DXT5 block's two colours in thirds", () => {
    const image = decodeDds(
      dxt5Image(4, 4, [
        dxt5Block({
          alpha: [255, 255],
          alphaIndices: every(0),
          colours: [RGB565_WHITE, RGB565_BLACK],
          colourIndices: [0, 1, 2, 3, ...Array.from({ length: 12 }, () => 0)],
        }),
      ]),
    );
    assert.deepEqual(pixelAt(image, 0, 0), [255, 255, 255, 255]);
    assert.deepEqual(pixelAt(image, 1, 0), [0, 0, 0, 255]);
    assert.deepEqual(pixelAt(image, 2, 0), [170, 170, 170, 255]);
    assert.deepEqual(pixelAt(image, 3, 0), [85, 85, 85, 255]);
  });

  it("lays DXT5 blocks out four texels at a time, row by row", () => {
    // Two rows of two blocks, each a flat colour and its own alpha, so a block
    // landing in the wrong place or a texel in the wrong row shows up at once.
    const flat = (colour, alpha) =>
      dxt5Block({
        alpha: [alpha, alpha],
        alphaIndices: every(0),
        colours: [colour, colour],
        colourIndices: every(0),
      });
    const image = decodeDds(
      dxt5Image(8, 8, [
        flat(RGB565_RED, 255),
        flat(RGB565_BLUE, 200),
        flat(RGB565_WHITE, 100),
        flat(RGB565_BLACK, 50),
      ]),
    );
    assert.deepEqual(pixelAt(image, 3, 3), [255, 0, 0, 255]);
    assert.deepEqual(pixelAt(image, 4, 3), [0, 0, 255, 200]);
    assert.deepEqual(pixelAt(image, 3, 4), [255, 255, 255, 100]);
    assert.deepEqual(pixelAt(image, 4, 4), [0, 0, 0, 50]);
  });

  it("drops the DXT5 texels that fall outside a size that is not a multiple of four", () => {
    // A 6×5 image still stores 2×2 whole blocks; only the texels inside the
    // image belong to it.
    const flat = (colour) =>
      dxt5Block({
        alpha: [255, 255],
        alphaIndices: every(0),
        colours: [colour, colour],
        colourIndices: every(0),
      });
    const image = decodeDds(
      dxt5Image(6, 5, [
        flat(RGB565_RED),
        flat(RGB565_BLUE),
        flat(RGB565_WHITE),
        flat(RGB565_BLACK),
      ]),
    );
    assert.equal(image.width, 6);
    assert.equal(image.height, 5);
    assert.equal(image.pixels.length, 6 * 5 * 4);
    assert.deepEqual(pixelAt(image, 5, 3), [0, 0, 255, 255]);
    assert.deepEqual(pixelAt(image, 0, 4), [255, 255, 255, 255]);
    assert.deepEqual(pixelAt(image, 5, 4), [0, 0, 0, 255]);
  });

  it("refuses DXT5 data that stops short", () => {
    const whole = dxt5Image(8, 4, [
      dxt5Block({
        alpha: [255, 255],
        alphaIndices: every(0),
        colours: [RGB565_RED, RGB565_RED],
        colourIndices: every(0),
      }),
    ]);
    // Eight texels wide needs two blocks; only one is there.
    assert.throws(() => decodeDds(whole), /truncated/);
  });

  it("keeps transparency, which is what makes a crest a crest", () => {
    const image = decodeDds(bgraDds(1, 1, [[255, 255, 255, 0]]));
    assert.equal(pixelAt(image, 0, 0)[3], 0);
  });

  it("refuses a file that is not a DDS", () => {
    assert.throws(() => decodeDds(Buffer.from("not a dds file at all")), /DDS/);
  });

  it("refuses a format it cannot decode rather than returning a blank crest", () => {
    const header = Buffer.alloc(128);
    header.write("DDS ", 0, "latin1");
    header.writeUInt32LE(1, 12);
    header.writeUInt32LE(1, 16);
    header.writeUInt32LE(0x4, 80);
    header.write("DXT1", 84, "latin1");
    assert.throws(() => decodeDds(header), /DXT1/);
  });

  it("refuses pixel data that stops short", () => {
    const truncated = bgraDds(
      2,
      2,
      Array.from({ length: 4 }, () => [0, 0, 0, 255]),
    );
    assert.throws(() => decodeDds(truncated.subarray(0, 128 + 8)), /truncated/);
  });
});

describe("cropImage", () => {
  it("extracts the top-left 50×50 crest from a padded 64×64 image", () => {
    const pixels = new Uint8Array(64 * 64 * 4);
    // Mark a corner inside the 50×50 region and another pixel in the 64×64 padding.
    const insideOffset = (49 * 64 + 49) * 4;
    pixels[insideOffset] = 210;
    pixels[insideOffset + 3] = 255;
    const paddingOffset = (50 * 64 + 50) * 4;
    pixels[paddingOffset] = 99;
    pixels[paddingOffset + 3] = 255;

    const cropped = cropImage({ width: 64, height: 64, pixels }, CREST_SIZE, CREST_SIZE);
    assert.equal(cropped.width, 50);
    assert.equal(cropped.height, 50);
    assert.deepEqual(pixelAt(cropped, 49, 49), [210, 0, 0, 255]);
  });

  it("refuses to crop when the source is smaller than the target box", () => {
    assert.throws(
      () => cropImage(solidImage(16, 16, [255, 255, 255, 255]), 50, 50),
      /cannot crop 16×16/,
    );
  });
});

describe("adaptForDarkBackground", () => {
  it("lifts near-black monochrome crests to crisp neutral light ink without colour cast", () => {
    // Include slight near-black compression noise (0, 2, 1) like EA's DXT5 crests.
    const lifted = adaptForDarkBackground(solidImage(8, 8, [0, 2, 1, 255]));
    const [r, g, b, a] = pixelAt(lifted, 4, 4);
    assert.equal(a, 255);
    assert.ok(r >= 215 && g >= 215 && b >= 215, `expected bright ink, got ${[r, g, b]}`);
    assert.equal(r, g);
    assert.equal(g, b);
  });

  it("adds a subtle light perimeter edge to dark-bordered crests without washing out their core", () => {
    // 10×10 canvas with a 4×4 near-black badge centered inside transparent padding.
    const pixels = new Uint8Array(10 * 10 * 4);
    for (let y = 3; y <= 6; y += 1) {
      for (let x = 3; x <= 6; x += 1) {
        const i = (y * 10 + x) * 4;
        pixels[i] = 10;
        pixels[i + 1] = 14;
        pixels[i + 2] = 20;
        pixels[i + 3] = 255;
      }
    }
    // Give the interior bright detail so it uses the perimeter halo path rather than full lift.
    for (const [x, y] of [
      [4, 4],
      [5, 4],
      [4, 5],
      [5, 5],
    ]) {
      const i = (y * 10 + x) * 4;
      pixels[i] = 220;
      pixels[i + 1] = 190;
      pixels[i + 2] = 80;
    }
    const adapted = adaptForDarkBackground({ width: 10, height: 10, pixels });
    // Center bright gold stays intact; pixel just outside the dark rim gains light halo alpha.
    assert.deepEqual(pixelAt(adapted, 4, 4), [220, 190, 80, 255]);
    assert.ok(pixelAt(adapted, 2, 3)[3] > 0, "expected outer rim pixel to gain halo alpha");
  });

  it("leaves already-bright colourful crests untouched", () => {
    const bright = solidImage(8, 8, [220, 35, 45, 255]);
    const result = adaptForDarkBackground(bright);
    assert.equal(result, bright);
  });
});

describe("encodePng", () => {
  it("writes a PNG whose IDAT is a zlib stream", () => {
    const png = encodePng({ width: 1, height: 1, pixels: new Uint8Array([1, 2, 3, 255]) });
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    const idatStart = png.indexOf(Buffer.from("IDAT", "latin1"));
    const length = png.readUInt32BE(idatStart - 4);
    const body = png.subarray(idatStart + 4, idatStart + 4 + length);
    // Raw deflate here would throw: a PNG IDAT is zlib-wrapped (RFC 2083 §10.1).
    assert.deepEqual([...inflateSync(body)], [0, 1, 2, 3, 255]);
  });
});

describe("ddsToPng & crestDdsToPng", () => {
  it("encodes DDS bytes directly to PNG at native dimensions", () => {
    const png = ddsToPng(
      bgraDds(
        8,
        8,
        Array.from({ length: 64 }, () => [1, 2, 3, 255]),
      ),
    );
    assert.equal(png.readUInt32BE(16), 8);
    assert.equal(png.readUInt32BE(20), 8);
  });

  it("crops a 64×64 crest DDS down to a crisp 50×50 PNG", () => {
    const png = crestDdsToPng(
      bgraDds(
        64,
        64,
        Array.from({ length: 64 * 64 }, () => [200, 30, 40, 255]),
      ),
    );
    assert.equal(png.readUInt32BE(16), 50);
    assert.equal(png.readUInt32BE(20), 50);
  });
});
