import { EnvironmentId, ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import { collectLimitAccounts, collectLimitPools } from "@t3tools/shared/usageLimits";
import { describe, expect, it } from "vite-plus/test";

import { compactTrayWindows, compactWindowLabel } from "./ComposerUsageLimitsReadout";

function poolFor(
  driver: string,
  windows: ReadonlyArray<{
    readonly id: string;
    readonly kind: "session" | "weekly" | "monthly" | "other";
    readonly label: string;
    readonly usedPercent: number;
    readonly windowDurationMins?: number;
  }>,
) {
  const presentations = new Map([
    [
      EnvironmentId.make("env-1"),
      {
        entry: { target: { label: "Local" } },
        serverConfig: {
          providers: [
            {
              instanceId: ProviderInstanceId.make(`${driver}-1`),
              driver: ProviderDriverKind.make(driver),
              displayName: driver,
              enabled: true,
              installed: true,
              status: "ready" as const,
              auth: { status: "authenticated" as const },
              usageLimits: {
                checkedAt: "2026-11-20T00:00:00.000Z",
                windows: [...windows],
              },
              models: [],
              slashCommands: [],
              skills: [],
              supportsReasoningEffort: false,
            },
          ],
        },
      },
    ],
  ]);
  const pools = collectLimitPools(
    collectLimitAccounts(presentations as never),
    Date.parse("2026-11-20T00:00:00.000Z"),
  );
  return pools[0]!;
}

describe("ComposerUsageLimitsReadout window helpers", () => {
  it("abbreviates to 5hr and 7d only when the reported duration matches", () => {
    const codex = poolFor("codex", [
      {
        id: "primary",
        kind: "session",
        label: "Session",
        usedPercent: 25,
        windowDurationMins: 300,
      },
      {
        id: "secondary",
        kind: "weekly",
        label: "Weekly",
        usedPercent: 10,
        windowDurationMins: 10_080,
      },
    ]);
    expect(codex.windows.map((window) => compactWindowLabel(codex, window))).toEqual(["5hr", "7d"]);

    const shortMuse = poolFor("muse", [
      { id: "session", kind: "session", label: "Session", usedPercent: 40, windowDurationMins: 60 },
    ]);
    expect(compactWindowLabel(shortMuse, shortMuse.windows[0]!)).toBe("Session");

    const unknownDuration = poolFor("codex", [
      { id: "primary", kind: "session", label: "Session", usedPercent: 40 },
    ]);
    expect(compactWindowLabel(unknownDuration, unknownDuration.windows[0]!)).toBe("Session");
  });

  it("omits Claude's Fable weekly breakdown by typed window id only", () => {
    const claude = poolFor("claudeAgent", [
      {
        id: "five_hour",
        kind: "session",
        label: "5-hour",
        usedPercent: 20,
        windowDurationMins: 300,
      },
      {
        id: "seven_day",
        kind: "weekly",
        label: "Weekly",
        usedPercent: 10,
        windowDurationMins: 10_080,
      },
      {
        id: "seven_day_fable",
        kind: "weekly",
        label: "Weekly · Fable",
        usedPercent: 5,
        windowDurationMins: 10_080,
      },
    ]);
    expect(compactTrayWindows(claude).map((window) => window.id)).toEqual([
      "five_hour",
      "seven_day",
    ]);
    expect(compactTrayWindows(claude).map((window) => compactWindowLabel(claude, window))).toEqual([
      "5hr",
      "7d",
    ]);
  });
});
