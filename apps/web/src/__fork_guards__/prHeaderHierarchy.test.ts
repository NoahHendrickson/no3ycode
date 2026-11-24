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
  it("reads the branch flow head into base in the full and condensed header", () => {
    const layout = read("../overrides/components/pullRequest/PullRequestDetailLayout.tsx");
    const panel = read("../components/pullRequest/PullRequestDetailPanel.tsx");
    expect(beforeIn(layout, "{head}", "{base}")).toBe(true);
    expect(layout).toContain('gt("merges into"');
    const fenced = panel.slice(
      panel.indexOf("{/* fork:begin pr-header-hierarchy"),
      panel.indexOf("{/* fork:end pr-header-hierarchy */}"),
    );
    expect(beforeIn(fenced, "detail.headBranch", "<PullRequestBaseBranch")).toBe(true);
  });

  it("keeps the checkout command on the branch row and the stats in the meta line", () => {
    const layout = read("../overrides/components/pullRequest/PullRequestDetailLayout.tsx");
    expect(beforeIn(layout, "{diffStat}", "{head}")).toBe(true);
    expect(beforeIn(layout, "{base}", "{checkout}")).toBe(true);
  });

  it("colours only the warning icon when the base branch is out of date", () => {
    const base = read("../overrides/components/pullRequest/PullRequestBaseBranch.tsx");
    expect(base.match(/text-warning-foreground/gu)).toHaveLength(1);
    expect(base).toContain('"size-3.5 shrink-0 text-warning-foreground"');
  });
});
