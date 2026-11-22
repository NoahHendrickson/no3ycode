// @effect-diagnostics nodeBuiltinImport:off
/* Fork guard, see `.fork/customizations.yaml#fork-branch-link-copy`. The started thread's branch
   chip copies its link, and the branch picker's right-click menu offers the link beside the name. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("fork guard: fork-branch-link-copy", () => {
  it("makes the readout's branch chip a focusable control that copies the link", () => {
    const readout = readSibling("../custom/ThreadContextReadout.tsx");
    const chip = /<span\s+role="button"[\s\S]*?data-testid="thread-branch-readout"[\s\S]*?>/u.exec(
      readout,
    )?.[0];
    expect(chip, "the branch chip stays a span with a button role").toBeDefined();
    expect(chip).toContain("tabIndex={0}");
    expect(chip).toContain("Copy link to ${branch}");
    expect(chip).toContain("onClick={copyBranch}");
    expect(chip).toContain("onKeyDown={onBranchKeyDown}");
    expect(chip).toContain("onContextMenu={onBranchContextMenu}");
    expect(readout).toContain("copyBranchReference({ branch, url: branchUrl })");
  });

  it("offers Copy branch link in the branch picker's right-click menu", () => {
    const fence =
      /fork:begin fork-branch-link-copy[^\n]*\n([\s\S]*?)fork:end fork-branch-link-copy/gu;
    const hunks = [...readSibling("../components/BranchToolbarBranchSelector.tsx").matchAll(fence)];
    const menu = hunks.map((match) => match[1]).join("\n");
    expect(menu).toContain("refBranchUrl(");
    expect(menu).toContain('label: "Copy branch link"');
    expect(menu).toContain("copyBranchLink(branchLink)");
  });
});
