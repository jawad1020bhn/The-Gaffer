/**
 * Decoding EA's crest DDS files and encoding them as PNG.
 *
 * These are the two steps between `crest16x16/l<id>.dds` and a file a browser
 * can draw, so each is checked against bytes whose pixels are known exactly —
 * no EA files are needed to run this.
 */

import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { describe, it } from "node:test";

import { decodeDds, ddsToPng, encodePng, upscaleToAtLeast } from "./dds.mjs";

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
  // Six bytes of zero alpha indices, then the colour endpoints and indices.
  const colour = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
  block.writeUInt16LE(colour, 8);
  block.writeUInt16LE(colour, 10);
  block.writeUInt32LE(0, 12);
  return Buffer.concat([header, block]);
}

const pixelAt = (image, x, y) => {
  const offset = (y * image.width + x) * 4;
  return [...image.pixels.subarray(offset, offset + 4)];
};

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
    // 5/6-bit endpoints cannot represent every 8-bit value; a few levels of
    // quantisation is the format, not an error.
    const [r, g, b, a] = pixelAt(image, 1, 1);
    assert.ok(r >= 196, `red ${r}`);
    assert.ok(g >= 96, `green ${g}`);
    assert.ok(b >= 48, `blue ${b}`);
    assert.equal(a, 255);
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

  it("upscales by whole pixels so a crest stays sharp", () => {
    const image = { width: 2, height: 1, pixels: new Uint8Array([1, 1, 1, 255, 2, 2, 2, 255]) };
    const png = encodePng(image, { scale: 2 });
    assert.equal(png.readUInt32BE(16), 4); // IHDR width
    assert.equal(png.readUInt32BE(20), 2); // IHDR height
  });
});

describe("upscaleToAtLeast", () => {
  it("rounds up to a whole multiple", () => {
    assert.equal(upscaleToAtLeast({ width: 16, height: 16 }, 64), 4);
    assert.equal(upscaleToAtLeast({ width: 16, height: 16 }, 65), 5);
    assert.equal(upscaleToAtLeast({ width: 16, height: 16 }, 16), 1);
    assert.equal(upscaleToAtLeast({ width: 16, height: 16 }, 8), 1);
  });
});

describe("ddsToPng", () => {
  it("turns DDS bytes into a PNG of the scaled size", () => {
    const png = ddsToPng(
      bgraDds(
        16,
        16,
        Array.from({ length: 256 }, () => [1, 2, 3, 255]),
      ),
      { scale: 4 },
    );
    assert.equal(png.readUInt32BE(16), 64);
    assert.equal(png.readUInt32BE(20), 64);
  });
});
