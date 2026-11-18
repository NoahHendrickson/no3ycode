import { describe, expect, it } from "vite-plus/test";

import { bayerMatrix, DITHER_LEVELS } from "./EffortDither";

describe("effort dither", () => {
  it("ranks each cell once and lights one more cell at each level", () => {
    const ranks = Array.from({ length: 64 }, (_, rank) => rank);
    expect(
      bayerMatrix(8)
        .flat()
        .toSorted((a, b) => a - b),
    ).toEqual(ranks);
    const litCells = DITHER_LEVELS.map(({ path }) => path.split("M").length - 1);
    expect(litCells).toEqual(ranks.map((rank) => rank + 1));
  });
});
