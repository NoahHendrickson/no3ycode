import type { LimitPool, LimitPoolWindow } from "@t3tools/shared/usageLimits";
import { describe, expect, it } from "vite-plus/test";

import { compactTrayWindows, compactWindowLabel, usageBarTone } from "./no3yUsageCompact";

function poolWindow(input: {
  readonly id: string;
  readonly kind: "session" | "weekly";
  readonly label: string;
  readonly mins?: number;
}): LimitPoolWindow {
  const window = {
    id: input.id,
    kind: input.kind,
    label: input.label,
    usedPercent: 10,
    windowDurationMins: input.mins,
  };
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    members: [{ account: { limits: { windows: [window] } }, window, refillPercent: 0 }],
    columns: [],
    remainingPercent: 90,
    usedPercent: 10,
    pace: null,
    resets: [],
  } as unknown as LimitPoolWindow;
}

const pool = (driver: string, windows: ReadonlyArray<LimitPoolWindow>) =>
  ({ driver, accounts: [], windows }) as unknown as LimitPool;

describe("no3y compact usage labels", () => {
  it("abbreviates to 5hr and 7d only from typed durations", () => {
    const session = poolWindow({ id: "primary", kind: "session", label: "Session", mins: 300 });
    const weekly = poolWindow({ id: "secondary", kind: "weekly", label: "Weekly", mins: 10_080 });
    const untyped = poolWindow({ id: "other", kind: "session", label: "Daily" });
    const codex = pool("codex", [session, weekly, untyped]);
    expect([session, weekly, untyped].map((window) => compactWindowLabel(codex, window))).toEqual([
      "5hr",
      "7d",
      "Daily",
    ]);
  });

  it("keeps Claude's weekly label unless it is the seven_day id, and drops the Fable breakdown", () => {
    const weekly = poolWindow({ id: "seven_day", kind: "weekly", label: "Weekly", mins: 10_080 });
    const opus = poolWindow({ id: "seven_day_opus", kind: "weekly", label: "Opus", mins: 10_080 });
    const fable = poolWindow({ id: "seven_day_fable", kind: "weekly", label: "Fable" });
    const claude = pool("claudeAgent", [weekly, opus, fable]);
    expect(compactWindowLabel(claude, weekly)).toBe("7d");
    expect(compactWindowLabel(claude, opus)).toBe("Opus");
    expect(compactTrayWindows(claude).map((window) => window.id)).toEqual([
      "seven_day",
      "seven_day_opus",
    ]);
  });

  it("tones the bar by share left", () => {
    expect([80, 50, 49, 20, 19].map(usageBarTone)).toEqual(["good", "good", "low", "low", "out"]);
  });
});
