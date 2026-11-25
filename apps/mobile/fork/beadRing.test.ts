import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import { BEAD_RING_STILL_PROGRESS, BEAD_RING_STRETCH, beadRingPath } from "./beadRing";

describe("bead ring path", () => {
  it("draws the line and four beads as five arcs", () => {
    expect(beadRingPath(0.3, BEAD_RING_STRETCH).match(/M/g)).toHaveLength(5);
  });

  it("loops seamlessly: the last frame of a loop is the first of the next", () => {
    expect(beadRingPath(0.999_999, BEAD_RING_STRETCH)).toBe(beadRingPath(0, BEAD_RING_STRETCH));
    expect(beadRingPath(1.25, BEAD_RING_STRETCH)).toBe(beadRingPath(0.25, BEAD_RING_STRETCH));
  });

  it("is what the Live Activity's bead ring asset draws", () => {
    const svg = NodeFS.readFileSync(
      new URL("./assets/widget/No3yBeadRing.svg", import.meta.url),
      "utf8",
    );
    expect(svg).toContain(`d="${beadRingPath(BEAD_RING_STILL_PROGRESS, 0)}"`);
  });
});
