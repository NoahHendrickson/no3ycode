import { describe, expect, it } from "vite-plus/test";

import { effortLevelAt, effortStopX } from "./effortSlider";

// 4 levels on a 320pt track with a 20pt thumb: stops at 10, 110, 210, 310.
const track = { width: 320, thumbWidth: 20, levels: 4 };

describe("effort slider snapping", () => {
  it("puts each level's stop where the thumb's centre rests", () => {
    expect([0, 1, 2, 3].map((index) => effortStopX(track, index))).toEqual([10, 110, 210, 310]);
  });

  it("picks the nearest stop for a touch anywhere on the track, clamped at the ends", () => {
    expect(effortLevelAt(track, 0)).toBe(0);
    expect(effortLevelAt(track, 59)).toBe(0);
    expect(effortLevelAt(track, 61)).toBe(1);
    expect(effortLevelAt(track, 200)).toBe(2);
    expect(effortLevelAt(track, 320)).toBe(3);
    expect(effortLevelAt(track, -40)).toBe(0);
    expect(effortLevelAt(track, 900)).toBe(3);
    for (const index of [0, 1, 2, 3]) {
      expect(effortLevelAt(track, effortStopX(track, index))).toBe(index);
    }
  });

  it("stays on the only level of a one-level or unmeasured track", () => {
    expect(effortLevelAt({ ...track, levels: 1 }, 200)).toBe(0);
    expect(effortLevelAt({ ...track, width: 0 }, 200)).toBe(0);
  });
});
