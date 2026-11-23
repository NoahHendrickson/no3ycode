import type { LimitPool, LimitPoolWindow } from "@t3tools/shared/usageLimits";
import { describe, expect, it } from "vite-plus/test";

import {
  compactTrayWindows,
  compactWindowLabel,
  usageBarTone,
  no3yRingUsageWindow,
  no3yUsageSheetState,
} from "./no3yUsageCompact";

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

describe("no3y usage sheet state", () => {
  const base = { connected: 1, checked: false, pools: 0, notices: 0, links: 0 };
  it("says it is checking until the refresh lands, then why there is nothing", () => {
    expect(no3yUsageSheetState(base)).toBe("checking");
    expect(no3yUsageSheetState({ ...base, checked: true })).toBe("empty");
    expect(no3yUsageSheetState({ ...base, connected: 0 })).toBe("offline");
    expect(no3yUsageSheetState({ ...base, pools: 1 })).toBeNull();
    expect(no3yUsageSheetState({ ...base, checked: true, notices: 1 })).toBeNull();
  });
});

describe("no3y usage ring window", () => {
  const window = (id: string, usedPercent: number, mins?: number) => ({
    id,
    kind: id.startsWith("five") ? ("session" as const) : ("weekly" as const),
    label: id,
    usedPercent,
    ...(mins === undefined ? {} : { windowDurationMins: mins }),
  });
  const fiveHour = (used: number) => window("five_hour", used, 300);
  const weekly = (used: number) => window("seven_day", used, 10080);

  it("shows the limit that will interrupt first: the least left", () => {
    expect(no3yRingUsageWindow("claudeAgent", [fiveHour(70), weekly(20)])).toEqual({
      id: "five_hour",
      label: "5h",
      remainingPercent: 30,
    });
    expect(no3yRingUsageWindow("claudeAgent", [fiveHour(10), weekly(85)])).toEqual({
      id: "seven_day",
      label: "7d",
      remainingPercent: 15,
    });
  });

  it("takes the shorter window on a tie, whatever the order", () => {
    expect(no3yRingUsageWindow("codex", [weekly(40), fiveHour(40)])?.id).toBe("five_hour");
    expect(no3yRingUsageWindow("codex", [fiveHour(40), weekly(40)])?.id).toBe("five_hour");
  });

  it("leaves Claude's Fable breakdown out, and reports nothing without windows", () => {
    expect(
      no3yRingUsageWindow("claudeAgent", [fiveHour(10), window("seven_day_fable", 95, 10080)])?.id,
    ).toBe("five_hour");
    expect(no3yRingUsageWindow("claudeAgent", [])).toBeNull();
    expect(no3yRingUsageWindow("claudeAgent", [window("seven_day_fable", 95, 10080)])).toBeNull();
  });

  it("labels an unknown duration by the provider's own label", () => {
    expect(no3yRingUsageWindow("cursor", [window("monthly", 50)])?.label).toBe("monthly");
  });
});
