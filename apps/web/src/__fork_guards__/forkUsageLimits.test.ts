// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and
 * `.fork/customizations.yaml#fork-usage-limits-surface` /
 * `#fork-composer-usage-limits`.
 *
 * A sync that drops the composer fence leaves no limits bar with CI green,
 * and one that rewords or reformats upstream's notices brings Grok's
 * "No limits reported." warning back.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { composerRingWindow } from "../custom/ComposerUsageLimitsReadout";
import { actionableLimitNotices } from "../custom/usageLimitNotices";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

function provider(overrides: Partial<ServerProvider>): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make("codex"),
    driver: ProviderDriverKind.make("codex"),
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-09-03T11:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
    ...overrides,
  };
}

describe("fork guard: fork-composer-usage-limits", () => {
  it("renders the circular limits meter at the far right, opening the limits menu", () => {
    const composer = readSibling("../components/chat/ChatComposer.tsx");
    expect(composer).toContain("composerUsageReadout(");
    expect(composer).toContain("usageControls={usageReadout}");
    expect(composer).not.toContain("topVessel=");
    const readout = readSibling("../custom/ComposerUsageLimitsReadout.tsx");
    expect(readout).toContain("<UsageCircleMeter");
    expect(readout).toContain("<PopoverTrigger");
    expect(readout).toContain(
      "<UsageLimitsPooled presentations={presentations} now={props.now} compact />",
    );
  });

  it("falls back to the account-wide weekly window when no session window exists", () => {
    const weekly = { id: "seven_day", kind: "weekly", label: "Weekly", usedPercent: 40 } as const;
    const fable = {
      id: "seven_day_fable",
      kind: "weekly",
      label: "Weekly · Fable",
      usedPercent: 90,
    } as const;
    expect(composerRingWindow([fable, weekly])).toBe(weekly);
    expect(composerRingWindow([fable])).toBeUndefined();
  });
});

describe("fork guard: fork-usage-limits-surface", () => {
  it("drops the warning for a provider with no windows and keeps failures", () => {
    const checkedAt = "2026-09-03T11:00:00.000Z";
    const presentations = new Map([
      [
        EnvironmentId.make("env-a"),
        {
          entry: { target: { label: "Laptop" } },
          serverConfig: {
            providers: [
              provider({ displayName: "Grok", usageLimits: { checkedAt, windows: [] } }),
              provider({
                instanceId: ProviderInstanceId.make("claude"),
                driver: ProviderDriverKind.make("claudeAgent"),
                displayName: "Claude Max",
                usageLimits: { checkedAt, windows: [], unavailable: { reason: "probeFailed" } },
              }),
            ],
          },
        },
      ],
    ]);
    expect(actionableLimitNotices(presentations)).toEqual(["Claude Max: Could not read limits."]);
  });
});
