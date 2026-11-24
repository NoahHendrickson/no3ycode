// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#no3y-linked-pr-row`.
 *
 * Pins the mobile linked PR row's title-first layout and its wrapping meta line,
 * which an upstream sync could silently revert to the clipped one-line header.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const row = NodeFS.readFileSync(
  NodeURL.fileURLToPath(
    new URL("../../../mobile/src/features/threads/LinkedPullRequestList.tsx", import.meta.url),
  ),
  "utf8",
);
const fenced = row.slice(row.indexOf("export const LinkedPullRequestRow"));

describe("no3y-linked-pr-row", () => {
  it("renders the title before the meta line", () => {
    expect(fenced.indexOf('gt("Waiting for host state")')).toBeGreaterThan(0);
    expect(fenced.indexOf('gt("Waiting for host state")')).toBeLessThan(
      fenced.indexOf("{link.number}"),
    );
  });

  it("wraps the meta line instead of clipping it", () => {
    expect(fenced).toContain('className="flex-row flex-wrap items-center gap-x-2.5 gap-y-0.5"');
    expect(row).not.toContain("metaLineHeight");
  });

  it("shares one model and menu between the row and the no3y cards", () => {
    expect(fenced).toContain("useLinkedPullRequestModel(props.line, props.openPullRequest");
    expect(fenced).toContain("<LinkedPullRequestMenu link={link} actions={props.actions}>");
  });
});

describe("no3y-linked-pr-row cards", () => {
  const sheet = NodeFS.readFileSync(
    NodeURL.fileURLToPath(
      new URL("../../../mobile/src/features/threads/ThreadPullRequestsSheet.tsx", import.meta.url),
    ),
    "utf8",
  );

  it("swaps the Linked pull requests sheet's list for the glass cards", () => {
    expect(sheet).toMatch(
      /<No3yLinkedPullRequestCardsSwap[\s\S]*?>\s*\{content\}\s*<\/No3yLinkedPullRequestCardsSwap>/u,
    );
  });
});
