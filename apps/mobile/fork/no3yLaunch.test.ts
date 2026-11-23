import { describe, expect, it } from "vite-plus/test";

import { createNo3yLaunchGate, NO3Y_LAUNCH_MIN_VISIBLE_MS, no3yLaunchOutroAt } from "./no3yLaunch";

describe("no3y launch sparkle", () => {
  it("ends as soon as the app is ready, after a short floor", () => {
    expect(no3yLaunchOutroAt(0)).toBe(NO3Y_LAUNCH_MIN_VISIBLE_MS);
    expect(no3yLaunchOutroAt(900)).toBe(900);
  });

  it("plays once per process and reports readiness once", () => {
    const gate = createNo3yLaunchGate();
    expect([gate.claim(), gate.claim()]).toEqual([true, false]);
    let calls = 0;
    gate.subscribe(() => (calls += 1));
    expect(gate.ready()).toBe(false);
    gate.markReady();
    gate.markReady();
    expect([gate.ready(), calls]).toEqual([true, 1]);
  });
});
