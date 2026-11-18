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
      /if \(isForkStatusLine\(row\) && !shimmer\) \{\s*return \(\s*<ForkLiveStatusLine/u,
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
});
