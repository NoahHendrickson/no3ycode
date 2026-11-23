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
  const window = (id: string, remaining: number, mins?: number) => ({
    id,
    kind: mins !== undefined && mins < 24 * 60 ? ("session" as const) : ("weekly" as const),
    label: id,
    usedPercent: 100 - remaining,
    ...(mins === undefined ? {} : { windowDurationMins: mins }),
  });
  const ring = (driver: string, windows: ReturnType<typeof window>[]) => {
    const picked = no3yRingUsageWindow(driver, windows);
    return picked === null ? null : `${picked.label} ${picked.remainingPercent}`;
  };

  it("shows the session unless the weekly is nearly spent", () => {
    // Claude 5hr 69% / 7d 55%: the session cuts off first.
    expect(
      ring("claudeAgent", [window("five_hour", 69, 300), window("seven_day", 55, 10_080)]),
    ).toBe("5h 69");
    // Codex primary 100% / secondary 35%.
    expect(ring("codex", [window("primary", 100, 300), window("secondary", 35, 10_080)])).toBe(
      "5h 100",
    );
    expect(ring("codex", [window("primary", 80, 300), window("secondary", 15, 10_080)])).toBe(
      "7d 15",
    );
    expect(ring("codex", [window("secondary", 0, 10_080), window("primary", 90, 300)])).toBe(
      "7d 0",
    );
  });

  it("shows whichever window is reported alone", () => {
    expect(ring("claudeAgent", [window("seven_day", 55, 10_080)])).toBe("7d 55");
    expect(ring("claudeAgent", [window("five_hour", 69, 300)])).toBe("5h 69");
    expect(ring("claudeAgent", [])).toBeNull();
  });

  it("leaves Claude's Fable breakdown out", () => {
    expect(
      ring("claudeAgent", [
        window("five_hour", 69, 300),
        window("seven_day", 55, 10_080),
        window("seven_day_fable", 5, 10_080),
      ]),
    ).toBe("5h 69");
    expect(ring("claudeAgent", [window("seven_day_fable", 5, 10_080)])).toBeNull();
  });
});
