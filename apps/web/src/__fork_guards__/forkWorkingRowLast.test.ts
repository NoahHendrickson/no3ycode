// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-working-row-last`.
 *
 * The transcript's working row trails the live turn without a divider. A sync
 * that takes upstream's MessagesTimeline or WorkingTimelineRow compiles clean
 * and silently puts the row back at the turn head with its bottom border.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { cssRules } from "./cssRules";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("fork guard: fork-working-row-last", () => {
  it("folds the stabilised rows into one live status line unless the tail is taken", () => {
    const timeline = readSibling("../components/chat/MessagesTimeline.tsx");
    expect(timeline).toContain("const stableRows = useStableRows(rawRows, listIdentityKey);");
    expect(timeline).toMatch(/forkLiveStatusRows\(\s*stableRows,\s*awaitingUser !== null \|\|/u);
  });

  it("renders the folded live row as the status line", () => {
    expect(readSibling("../components/chat/TimelineWorkGroupRows.tsx")).toMatch(
      /if \(isForkStatusLine\(row\)\) \{\s*return \(\s*<ForkLiveStatusLine/u,
    );
  });

  it("shows a word where upstream says Thinking", () => {
    expect(readSibling("../custom/ForkLiveStatusLine.tsx")).toMatch(
      /\?\?\s*forkThinkingWord\(row\.forkWordSeed\)/u,
    );
  });

  it("stills the shine on a running tool's transcript row", () => {
    const rule = cssRules(readSibling("../theme.custom.css")).find((candidate) =>
      candidate.selector.includes('[data-timeline-row-kind="work-live"] .live-tool-shine'),
    );
    expect(rule?.body).toContain("animation: none");
    expect(readSibling("../components/chat/TimelineWorkGroupRows.tsx")).toContain(
      'active && "live-tool-shine"',
    );
  });

  it("retimes upstream's shimmer on the status line only", () => {
    const line = readSibling("../custom/ForkLiveStatusLine.tsx");
    expect(line).toContain("data-fork-status-line");
    expect(line).toContain("<ActivityShimmerOverlay");
    const css = readSibling("../theme.custom.css");
    expect(css).toMatch(
      /\[data-fork-status-line\] \.live-activity-focus \{\s*animation-name: fork-status-line-flash;/u,
    );
    expect(css).toMatch(
      /\[data-fork-status-line\] \.live-activity-focus-counter \{\s*animation-name: fork-status-line-flash-counter;/u,
    );
    expect(readSibling("../index.css")).toMatch(/@utility live-activity-focus-counter \{/u);
  });

  it("drops the working row's bottom divider", () => {
    const rows = readSibling("../components/chat/TimelineWorkGroupRows.tsx");
    const start = rows.indexOf("export function WorkingTimelineRow");
    expect(start).toBeGreaterThan(-1);
    const workingRow = rows.slice(start);
    expect(
      workingRow.slice(0, workingRow.indexOf("function BackgroundWorktreeSetupChip")),
    ).not.toContain("border-b");
  });

  it("drops the finished turn's fold divider, which upstream draws on the row's outer element", () => {
    const timeline = readSibling("../components/chat/MessagesTimeline.tsx");
    const start = timeline.indexOf("function TurnFoldTimelineRow");
    expect(start).toBeGreaterThan(-1);
    // The theme rule reaches the border through `> *`, so it must stay on the row's root.
    expect(timeline.slice(start)).toMatch(/return \(\s*<div className="[^"]*\bborder-b\b/u);
    expect(readSibling("../theme.custom.css")).toMatch(
      /\[data-timeline-row-kind="turn-fold"\] > \* \{\s*border-bottom-width: 0;/u,
    );
  });
});
