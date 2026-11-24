import {
  presentPendingBackgroundWork,
  type PendingBackgroundWorkItem,
} from "@t3tools/client-runtime/state/thread-execution";
import type {
  OrchestrationV2PendingBackgroundTask,
  OrchestrationV2Run,
  OrchestrationV2Subagent,
  ThreadId,
} from "@t3tools/contracts";
import { forkShellCommandParsing as shell } from "@t3tools/client-runtime/work-log/command-label";

import { forkSubagentRowFromAgent, type ForkSubagentTreeRow } from "./forkSubagentTree";

/** A background task, with its transcript card row when the task is a subagent's. */
export interface ComposerBackgroundWorkItem extends PendingBackgroundWorkItem {
  readonly subagent?: ForkSubagentTreeRow | undefined;
}

const LIVE_SUBAGENT_STATUSES: ReadonlySet<OrchestrationV2Subagent["status"]> = new Set([
  "pending",
  "running",
  "waiting",
]);

// The runs deriveThreadPendingBackgroundTasks treats as live, whose items it leaves out as foreground.
const LIVE_RUN_STATUSES: ReadonlySet<OrchestrationV2Run["status"]> = new Set([
  "queued",
  "preparing",
  "starting",
  "running",
]);

/** A follow-up delegation reuses its child thread, so the live record wins over a finished one. */
function subagentForChildThread(
  childThreadId: ThreadId | undefined,
  subagents: ReadonlyArray<OrchestrationV2Subagent>,
): OrchestrationV2Subagent | undefined {
  if (childThreadId === undefined) return undefined;
  const matches = subagents.filter((candidate) => candidate.childThreadId === childThreadId);
  return (
    matches.find((candidate) => LIVE_SUBAGENT_STATUSES.has(candidate.status)) ?? matches.at(-1)
  );
}

/** What the chip lists: the pending list, plus a live run's own subagents, which that list leaves
 * out as foreground work. Each subagent is matched to its record once and carries its card row.
 * Once the run settles only the pending list counts, so a record that lost its end cannot hold
 * the chip up. */
export function composerBackgroundWorkItems(
  pendingTasks: ReadonlyArray<OrchestrationV2PendingBackgroundTask>,
  subagents: ReadonlyArray<OrchestrationV2Subagent> | null | undefined,
  runs: ReadonlyArray<Pick<OrchestrationV2Run, "id" | "status">> | null | undefined,
): ReadonlyArray<ComposerBackgroundWorkItem> {
  const agents = subagents ?? [];
  const agentByTaskId = new Map<string, OrchestrationV2Subagent>();
  const claimedAgentIds = new Set<string>();
  const claimedThreadIds = new Set<ThreadId>();
  for (const task of pendingTasks) {
    if (task.kind !== "subagent") continue;
    const byThread = subagentForChildThread(task.childThreadId, agents);
    const byId = agents.find(
      (candidate) =>
        candidate.id === task.taskId || candidate.nativeTaskRef?.nativeId === task.taskId,
    );
    for (const agent of [byThread, byId]) if (agent) claimedAgentIds.add(agent.id);
    if (task.childThreadId !== undefined) claimedThreadIds.add(task.childThreadId);
    const agent =
      (byThread && LIVE_SUBAGENT_STATUSES.has(byThread.status) ? byThread : undefined) ??
      byId ??
      byThread;
    if (agent) agentByTaskId.set(task.taskId, agent);
  }
  const liveRunIds = new Set(
    (runs ?? []).filter((run) => LIVE_RUN_STATUSES.has(run.status)).map((run) => run.id),
  );
  const tasks = [...pendingTasks];
  for (const agent of agents) {
    if (
      agent.runId === null ||
      !liveRunIds.has(agent.runId) ||
      !LIVE_SUBAGENT_STATUSES.has(agent.status) ||
      claimedAgentIds.has(agent.id) ||
      (agent.childThreadId !== null && claimedThreadIds.has(agent.childThreadId))
    ) {
      continue;
    }
    const description = agent.title?.trim() || agent.prompt.trim();
    tasks.push({
      taskId: agent.id,
      kind: "subagent",
      ...(description.length === 0 ? {} : { description }),
      ...(agent.childThreadId === null ? {} : { childThreadId: agent.childThreadId }),
    });
    agentByTaskId.set(agent.id, agent);
  }
  // The presenter labels and orders the rows; each subagent row then takes its matched record.
  return (presentPendingBackgroundWork(tasks)?.items ?? []).map((item) => {
    const agent = agentByTaskId.get(item.taskId);
    if (agent === undefined) return item;
    return {
      ...item,
      childThreadId: item.childThreadId ?? agent.childThreadId ?? undefined,
      subagent: forkSubagentRowFromAgent(agent),
    };
  });
}

/** The first index from which every token is a redirection, or null when the command has none. */
function redirectionTailStart(tokens: ReadonlyArray<string>): number | null {
  for (let start = 1; start < tokens.length; start++) {
    let index = start;
    while (index < tokens.length) {
      const next = shell.indexAfterShellRedirection(tokens, index);
      if (next === null || next > tokens.length) break;
      index = next;
    }
    if (index === tokens.length) return start;
  }
  return null;
}

/** One kind names itself: subagents alone count, anything else alone is monitoring. A mix is
 * background tasks. */
export function composerBackgroundWorkLabel(
  items: ReadonlyArray<Pick<PendingBackgroundWorkItem, "kind">>,
): string {
  const subagents = items.filter((item) => item.kind === "subagent").length;
  if (subagents === 0) return "Monitoring";
  if (subagents === items.length)
    return `${subagents} ${subagents === 1 ? "subagent" : "subagents"}`;
  return "Background tasks";
}

/** A background command as its gist for the work list: no `cd <dir> &&` lead-in, and a single
 * command loses its trailing redirects and `&`. `vp run dev --no-seed 2>&1` reads
 * `vp run dev --no-seed`. Anything the shell reader cannot settle stays as written. */
export function glanceCommandLabel(command: string): string {
  let label = command.trim();
  for (;;) {
    const split = shell.splitFirstShellCommand(label);
    if (split.remainingCommand === null) {
      if (split.separator === "&") label = split.firstCommand.trim();
      break;
    }
    const tokens = shell.tokenizeShellCommand(split.firstCommand);
    const leadingCd =
      (split.separator === "&&" || split.separator === ";") &&
      tokens?.length === 2 &&
      tokens[0] === "cd";
    if (!leadingCd) return label;
    label = split.remainingCommand;
  }

  // The tokenizer reads a quote inside `$(...)` as closing the outer one, so a redirect-looking
  // word there could be quoted text.
  if (label.includes("$(") || label.includes("`")) return label;
  const tokens = shell.tokenizeShellCommand(label);
  const start = tokens === null ? null : redirectionTailStart(tokens);
  if (tokens === null || start === null) return label;
  const kept = JSON.stringify(tokens.slice(0, start));
  // Drop whole words from the end until what is left reads as exactly the kept tokens.
  for (let cut = label; /\s/u.test(cut);) {
    cut = cut.replace(/\s+\S*$/u, "");
    const cutTokens = shell.tokenizeShellCommand(cut);
    if (cutTokens === null || cutTokens.length < start) break;
    if (JSON.stringify(cutTokens) === kept) return cut;
  }
  return label;
}
