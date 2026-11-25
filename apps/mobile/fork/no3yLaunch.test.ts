import { describe, expect, it } from "vite-plus/test";

import { createNo3yLaunchGate } from "./no3yLaunch";

describe("no3y launch leaf", () => {
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
