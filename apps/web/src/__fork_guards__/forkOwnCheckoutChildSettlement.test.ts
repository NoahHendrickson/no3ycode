// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-own-checkout-child-settlement`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

function readCustomizationHunks(source: string): string {
  const begin = "fork:begin fork-own-checkout-child-settlement";
  const end = "fork:end fork-own-checkout-child-settlement";
  const hunks: string[] = [];
  let cursor = 0;
  for (;;) {
    const start = source.indexOf(begin, cursor);
    if (start === -1) break;
    const stop = source.indexOf(end, start);
    if (stop === -1) throw new Error("unterminated fork-own-checkout-child-settlement hunk");
    hunks.push(source.slice(start, stop));
    cursor = stop + end.length;
  }
  return hunks.join("\n");
}

const server = "../../../server/src";
const store = readCustomizationHunks(readSibling(`${server}/orchestration-v2/ProjectionStore.ts`));
const sweep = readCustomizationHunks(
  readSibling(`${server}/orchestration-v2/ThreadSettlementService.ts`),
);
const cleanup = readCustomizationHunks(readSibling(`${server}/storageCleanup.ts`));

describe("fork guard: fork-own-checkout-child-settlement", () => {
  it("lets a delegate in its own checkout skip its parent's settlement", () => {
    // The store names the fact once, and its gate holds back only children that share the work.
    expect(store).toContain("readonly settlesWithParent: boolean;");
    expect(store).toContain("${FORK_DELEGATED_TASK_THREAD_PREFIX}");
    expect(store).toContain("AS settles_with_parent");
    expect(store).toContain("NOT ${settlesWithParent}");
    // The sweep's settle-with-parent shortcut reads it.
    expect(sweep.match(/thread\.settlesWithParent/g)?.length).toBe(3);
  });

  it("does not let the parent's link of a delegate's pull request block its merge", () => {
    expect(sweep).toContain("linkedByAnotherThread(threadPullRequestKeyOf(");
    expect(sweep).toContain("ownedByAnotherThread(remembered, group)");
    expect(sweep).toContain("ownedByAnotherThread(fresh, group)");
  });

  it("never removes a delegate's worktree on its parent's settlement", () => {
    expect(cleanup).toContain("isForkOwnCheckoutDelegate(current, parent) ||");
  });
});
