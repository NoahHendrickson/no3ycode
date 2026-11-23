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
  it("folds the stabilised rows into one live status line", () => {
    expect(readSibling("../components/chat/MessagesTimeline.tsx")).toContain(
      "forkLiveStatusRows(useStableRows(rawRows, listIdentityKey))",
    );
  });

  it("renders the folded live row as the status line", () => {
    expect(readSibling("../components/chat/TimelineWorkGroupRows.tsx")).toMatch(
      /if \(forkLine && !shimmer\) \{\s*return \(\s*<ForkLiveStatusLine/u,
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
