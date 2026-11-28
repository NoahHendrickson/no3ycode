// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-delegated-children-watch-prs`. Upstream
 * gates child watches in four places a clean sync could bring back, and a child's later wake
 * must reach its parent as a follow-up task.
 */

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const repoRoot = NodePath.resolve(
  NodeURL.fileURLToPath(new URL(".", import.meta.url)),
  "../../../..",
);
const read = (relativePath: string): string =>
  NodeFS.readFileSync(NodePath.join(repoRoot, relativePath), "utf8");

describe("fork-delegated-children-watch-prs", () => {
  it("offers the watch tools to delegated children", () => {
    expect(read("apps/server/src/mcp/toolkits/pullRequests/tools.ts")).not.toContain(
      "McpInvocationContext.hiddenFromSubagents",
    );
  });

  it("lets a delegated child's watch through", () => {
    expect(read("apps/server/src/pullRequest/PullRequestWatchService.ts")).not.toContain(
      "PullRequestWatchFromSubagentError",
    );
    expect(read("apps/server/src/orchestration-v2/Orchestrator.ts")).not.toContain(
      "its parent thread watches pull requests",
    );
    expect(read("apps/server/src/orchestration-v2/PullRequestWatchReactor.ts")).not.toContain(
      '? "subagent"',
    );
  });

  it("reports a child's PR wake to its parent as a follow-up", () => {
    const orchestrator = read("apps/server/src/orchestration-v2/Orchestrator.ts");
    expect(orchestrator).toContain("isBackgroundMonitorNotice(command.notification)");
    expect(read("packages/provider-core/src/server/subagentProjection.ts")).toContain(
      "notification.source.pullRequest === undefined",
    );
    expect(orchestrator).toContain(
      "yield* recordSubagentFollowup(message, events).pipe(mapDispatchError(command));",
    );
    expect(orchestrator).toContain(
      'command.type === "thread.pull-request-watch.sync" && command.wake !== undefined',
    );
  });

  it("lets only one of a parent and its delegated child watch a PR", () => {
    expect(read("apps/server/src/pullRequest/PullRequestWatchService.ts")).toContain(
      "const refusal = yield* relativeWatching(thread, target);",
    );
  });

  it("tells children they watch, and to unwatch only before handing back to the user", () => {
    const instructions = read("packages/provider-core/src/server/runtimeInstructions.ts");
    expect(instructions).not.toContain("Delegated children never watch");
    expect(instructions).toContain("Delegated children watch too.");
    expect(instructions).toContain("Before handing back to the user, call unwatch_pull_request");
  });
});
