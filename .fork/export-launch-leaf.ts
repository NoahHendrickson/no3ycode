#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off
/**
 * Renders the no3y iOS launch screen image from the leaf model the launch overlay draws, so the
 * native splash and the overlay's first frame cannot drift. See
 * `.fork/customizations.yaml#no3y-launch-leaf`.
 *
 * Usage: node .fork/export-launch-leaf.ts [--check]
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import * as NodeZlib from "node:zlib";

import { NO3Y_LEAF_GRID, NO3Y_LEAVES } from "../apps/mobile/fork/no3yLeafMark.ts";

/** 21px a cell: the 3x render of the splash's 147pt (7pt a cell). */
const CELL_PX = 21;
const OUTPUT = NodeURL.fileURLToPath(
  new URL("../apps/mobile/fork/assets/no3y-splash-leaf.png", import.meta.url),
);

const size = NO3Y_LEAF_GRID * CELL_PX;
const stride = size * 4 + 1;
const pixels = Buffer.alloc(stride * size);
for (const leaf of NO3Y_LEAVES) {
  for (const { row, col, color } of leaf.cells) {
    const rgba = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16)).concat(255);
    for (let y = row * CELL_PX; y < (row + 1) * CELL_PX; y++) {
      for (let x = col * CELL_PX; x < (col + 1) * CELL_PX; x++) {
        pixels.set(rgba, y * stride + 1 + x * 4);
      }
    }
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = CRC_TABLE[(crc ^ byte) & 255]! ^ (crc >>> 8);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, body.length + 4);
  return out;
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0);
header.writeUInt32BE(size, 4);
header[8] = 8; // bit depth
header[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header),
  chunk("IDAT", NodeZlib.deflateSync(pixels, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

if (process.argv.includes("--check")) {
  if (!NodeFS.readFileSync(OUTPUT).equals(png)) {
    console.error("The launch leaf PNG is stale; run node .fork/export-launch-leaf.ts");
    process.exit(1);
  }
} else {
  NodeFS.writeFileSync(OUTPUT, png);
}
