// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#pr-header-hierarchy`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function read(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const beforeIn = (source: string, first: string, second: string) =>
  source.indexOf(first) >= 0 && source.indexOf(first) < source.indexOf(second);

describe("pr-header-hierarchy", () => {
  it("draws the branch flow head into base from one component in both headers", () => {
    const layout = read("../overrides/components/pullRequest/PullRequestDetailLayout.tsx");
    const panel = read("../components/pullRequest/PullRequestDetailPanel.tsx");
    const flow = layout.slice(layout.indexOf("export function PullRequestBranchFlow"));
    expect(beforeIn(flow, "{head}", "{base}")).toBe(true);
    expect(flow).toContain('gt("merges into"');
    expect(layout).toContain('<PullRequestBranchFlow head={head} base={base} density="default" />');
    expect(panel).toContain("<PullRequestBranchFlow");
    expect(panel).toContain('density="compact"');
  });

  it("keeps the stats in the meta line and the checkout command on the branch row", () => {
    const layout = read("../overrides/components/pullRequest/PullRequestDetailLayout.tsx");
    const body = layout.slice(layout.indexOf("export function PullRequestDetailHeaderBody"));
    expect(beforeIn(body, "{diffStat}", "<PullRequestBranchFlow")).toBe(true);
    expect(beforeIn(body, "<PullRequestBranchFlow", "{checkout}")).toBe(true);
  });

  it("colours only the warning icon when the base branch is out of date", () => {
    const base = read("../overrides/components/pullRequest/PullRequestBaseBranch.tsx");
    expect(base.match(/text-warning-foreground/gu)).toHaveLength(1);
    expect(base.slice(base.indexOf("<TriangleAlertIcon"))).toMatch(
      /^<TriangleAlertIcon[^>]*text-warning-foreground/u,
    );
  });

  it("reads head into base in the thread details pull request row", () => {
    const row = read("../components/chat/ThreadDetailsPrRow.tsx");
    expect(row).toContain("{detail.headBranch} → {detail.baseBranch}");
  });
});
