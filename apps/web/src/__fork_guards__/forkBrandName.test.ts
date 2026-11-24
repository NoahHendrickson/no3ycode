// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-brand-name`.
 *
 * The fork's name reaches upstream's inline "T3 Code" and bare "T3 <word>" copy
 * through one build-time rewrite, so a sync that drops the plugin wiring silently
 * brings upstream's name back everywhere at once.
 */

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import {
  EXCLUDED_MODULES,
  FORK_DISPLAY_NAME,
  PRESERVED_PHRASES,
  forkBrandName,
  rewriteUpstreamDisplayName,
} from "../../../../scripts/lib/fork-brand-name.ts";
import { FORK_APP_BASE_NAME } from "../custom/forkBranding";

const repoRoot = NodePath.resolve(
  NodeURL.fileURLToPath(new URL(".", import.meta.url)),
  "../../../..",
);
const read = (relativePath: string): string =>
  NodeFS.readFileSync(NodePath.join(repoRoot, relativePath), "utf8");

/** The favicon's outline cells, merged into one rect per horizontal run. */
function flowerOutlinePath(): string {
  const favicon = read("assets/fork/n3-favicon.svg");
  const cells = /<path d="([^"]*)" fill="#182E26"/u.exec(favicon)?.[1] ?? "";
  const rows = new Map<number, number[]>();
  for (const [, x, y] of cells.matchAll(/M(\d+) (\d+)h1v1h-1z/gu)) {
    rows.set(Number(y), [...(rows.get(Number(y)) ?? []), Number(x)]);
  }
  let path = "";
  for (const [y, xs] of [...rows].toSorted(([a], [b]) => a - b)) {
    xs.sort((a, b) => a - b);
    let start = xs[0] ?? 0;
    for (let i = 1; i <= xs.length; i++) {
      if (xs[i] === (xs[i - 1] ?? 0) + 1) continue;
      const width = (xs[i - 1] ?? 0) - start + 1;
      path += `M${start} ${y}h${width}v1h-${width}z`;
      start = xs[i] ?? 0;
    }
  }
  return path;
}

type TransformHook = (code: string, id: string) => { code: string; map: null } | null;
const transform = forkBrandName().transform as TransformHook;

describe("fork guard: fork-brand-name", () => {
  it("rewrites upstream's display name and keeps every preserved phrase", () => {
    expect(FORK_DISPLAY_NAME).toBe(FORK_APP_BASE_NAME);
    for (const [input, expected] of [
      ["T3 Code failed to start", "no3y Code failed to start"],
      ["Run T3 Code's CLI. Restart T3 Code.", "Run no3y Code's CLI. Restart no3y Code."],
      ["<title>T3 Code (Beta)</title>", "<title>no3y Code (Beta)</title>"],
      ["`${reason}\\n\\nT3 Code will restart`", "`${reason}\\n\\nno3y Code will restart`"],
      ["Sign in to T3 Connect on the T3 server", null],
      ["Link T3 Chat for more tunnels", null],
      ["Unable to connect to the T3 server WebSocket.", null],
      ["This T3 home is unavailable. Open T3 Account.", null],
      ["const T3 = 1; type T3Mark = T3;", null],
      [
        '"Start\\nStarting\\nStarted\\na T3 thread"',
        '"Start\\nStarting\\nStarted\\na no3y thread"',
      ],
      ["{completed {Created T3 threads}}", "{completed {Created no3y threads}}"],
      ["Use T3 desktop. T3 could not ask.", "Use no3y desktop. no3y could not ask."],
      ['"Create\\nCreated\\nT3 threads"', '"Create\\nCreated\\nno3y threads"'],
    ] as const) {
      expect(rewriteUpstreamDisplayName(input)).toBe(expected);
    }
    for (const phrase of PRESERVED_PHRASES) {
      expect(rewriteUpstreamDisplayName(`Before ${phrase} after, T3 Code.`)).toBe(
        `Before ${phrase} after, no3y Code.`,
      );
    }
  });

  it("transforms built scripts only, never dependencies or excluded identities", () => {
    const source = 'const label = "T3 Code";';
    expect(transform(source, "/repo/apps/web/src/a.tsx?v=1")).toEqual({
      code: 'const label = "no3y Code";',
      map: null,
    });
    expect(transform(source, "/repo/node_modules/pkg/index.js")).toBeNull();
    expect(transform(source, "node_modules/pkg/index.js")).toBeNull();
    expect(transform(source, "/repo/apps/web/src/index.css")).toBeNull();
    for (const path of ["/repo/apps/desktop/src/app/DesktopUserData.ts"]) {
      expect(EXCLUDED_MODULES.some((pattern) => pattern.test(path))).toBe(true);
      expect(transform(source, path)).toBeNull();
    }
  });

  it("wires the rewrite into the web build and both desktop pack entries", () => {
    expect(read("apps/web/vite.config.ts")).toContain("forkBrandName()");
    expect(
      read("apps/desktop/vite.config.ts").match(/plugins: \[forkBrandName\(\)\]/gu),
    ).toHaveLength(2);
  });

  it("names the installable web app and the macOS permission prompts after the fork", () => {
    const manifest = JSON.parse(read("apps/web/public/manifest.webmanifest")) as {
      name: string;
      short_name: string;
    };
    expect(manifest.name).toBe(FORK_APP_BASE_NAME);
    expect(manifest.short_name).toBe(FORK_APP_BASE_NAME);
    const packaging = read("scripts/build-desktop-artifact.ts");
    for (const key of [
      "NSLocalNetworkUsageDescription",
      "NSScreenCaptureUsageDescription",
      "NSCameraUsageDescription",
    ]) {
      expect(packaging).toMatch(new RegExp(`${key}:\\s*"no3y Code `, "u"));
    }
  });

  it("draws the no3y flower where upstream draws its T3 letters", () => {
    const glyph = read("apps/web/src/overrides/components/T3Wordmark.tsx");
    expect(glyph).toContain("export function T3Wordmark(");
    expect(glyph).toContain('viewBox="-0.5 -0.5 16 16"');
    // One path everywhere, derived from the favicon's outline cells.
    for (const file of [
      "apps/web/src/overrides/components/T3Wordmark.tsx",
      "apps/mobile/src/components/T3Wordmark.tsx",
      "apps/mobile/assets/widget/T3Mark.svg",
    ]) {
      expect(read(file)).toContain(`d="${flowerOutlinePath()}"`);
    }
    const standalone = read("apps/web/src/components/ui/standalone-page.tsx");
    expect(standalone).toContain(">no3y Code</span>");
  });

  it("rebrands the mobile app through Metro and its own marks", () => {
    expect(read("apps/mobile/metro.config.js")).toContain("./fork/forkBrandNameTransformer.cjs");
    expect(read("apps/mobile/fork/forkBrandNameTransformer.cjs")).toContain(
      "rewriteUpstreamDisplayName(props.src)",
    );
    expect(read("apps/mobile/src/components/CompactBrandTitle.tsx")).toContain(
      'const WORDMARK_SUFFIX = "no3y Code";',
    );
    expect(read("apps/mobile/src/components/brandAssets.ts")).not.toMatch(
      /assets\/(dev|nightly|prod)\//u,
    );
    expect(read("apps/mobile/src/widgets/subscriptionUsageSnapshot.ts")).not.toContain('app: "T3"');
    for (const widget of [
      "apps/mobile/src/widgets/SubscriptionUsage.tsx",
      "apps/mobile/src/widgets/SubscriptionUsage.android.tsx",
      "apps/mobile/src/widgets/AgentActivityWidget.tsx",
    ]) {
      expect(read(widget)).not.toMatch(/\bT3( Code)?\b[^_]/u);
    }
  });

  it("credits upstream in Settings and the desktop About panel", () => {
    expect(read("apps/web/src/components/settings/SettingsPanels.tsx")).toContain(
      "<ForkUpstreamCreditRow />",
    );
    expect(read("apps/web/src/custom/ForkUpstreamCreditRow.tsx")).toContain(
      "https://github.com/pingdotgg/t3code",
    );
    expect(read("apps/desktop/src/app/DesktopAppIdentity.ts")).toContain(
      'credits: "Fork of T3 Code"',
    );
  });
});
