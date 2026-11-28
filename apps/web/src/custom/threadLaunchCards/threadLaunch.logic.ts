/**
 * A thread an agent started with `t3_thread_launch`, read from its tool call — see
 * `.fork/customizations.yaml#fork-thread-launch-cards`. The wire keeps only the `threadId` of
 * the tool's result (compactDynamicToolOutput), so the title comes from the call's input.
 */
import { presentPendingBackgroundWork } from "@t3tools/client-runtime/state/thread-execution";
import { resolveThreadCurrentPullRequestLink } from "@t3tools/client-runtime/thread-pull-requests";
import type {
  EnvironmentId,
  OrchestrationV2PendingBackgroundTask,
  OrchestrationV2TurnItemStatus,
  RunId,
  ThreadId,
  ThreadLinkedPullRequest,
  ThreadPullRequestLink,
  ThreadPullRequestSnapshot,
} from "@t3tools/contracts";
import { isPullRequestWatchTask } from "@t3tools/shared/orchestrationV2PendingBackgroundWork";
import { hasThreadLinks, replaceThreadLinks } from "@t3tools/shared/threadLinks";
import { visibleThreadPullRequests } from "@t3tools/shared/threadPullRequests";
import { resolveT3McpToolId } from "@t3tools/shared/t3McpToolPresentation";
import { compactDynamicToolOutput } from "@t3tools/shared/toolOutput";

import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";
import type { SidebarThreadStatus } from "~/components/Sidebar.logic";
import type { TimelineEntry } from "~/session-logic";

import { pullRequestChipStateOf } from "../composerPullRequestChip.logic";
import { forkWorkReportOfEntry, forkWorkReportThreadId } from "../forkWorkReports";

export interface ForkThreadLaunch {
  /** The input's title; null when an oversized input was cut down on the wire. */
  readonly title: string | null;
  /** Null until the call returns, or when it failed. */
  readonly threadId: ThreadId | null;
  /** Another machine the thread was started on; null for this one. */
  readonly environmentId: EnvironmentId | null;
  readonly callStatus: "starting" | "started" | "failed";
}

const IN_FLIGHT = new Set<OrchestrationV2TurnItemStatus>(["idle", "pending", "running", "waiting"]);

function stringField(input: unknown, key: string): string | null {
  if (typeof input !== "object" || input === null) return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function forkThreadLaunchFromToolItem(item: {
  readonly toolName: string | null | undefined;
  readonly input: unknown;
  readonly output?: unknown;
  readonly status: OrchestrationV2TurnItemStatus;
}): ForkThreadLaunch | undefined {
  if (resolveT3McpToolId(item.toolName) !== "t3_thread_launch") return undefined;
  const output = compactDynamicToolOutput(item.output);
  const threadId = output?.isError ? null : ((output?.threadId as ThreadId | undefined) ?? null);
  const callStatus = IN_FLIGHT.has(item.status)
    ? "starting"
    : item.status === "completed" && threadId !== null
      ? "started"
      : "failed";
  return {
    title: stringField(item.input, "title"),
    threadId: callStatus === "started" ? threadId : null,
    environmentId: stringField(item.input, "environmentId") as EnvironmentId | null,
    callStatus,
  };
}

/** Launches in one row: consecutive in the same run, as the transcript groups subagents. */
function sameLaunchGroup(
  previous: { readonly runId: RunId | null } | undefined,
  next: { readonly runId: RunId | null },
): boolean {
  return previous !== undefined && previous.runId !== null && previous.runId === next.runId;
}

function forkThreadLaunchesEqual(a: ForkThreadLaunch, b: ForkThreadLaunch | undefined): boolean {
  return (
    b !== undefined &&
    a.title === b.title &&
    a.threadId === b.threadId &&
    a.environmentId === b.environmentId &&
    a.callStatus === b.callStatus
  );
}

/** The card's "what it is doing" line: the first line of the thread's latest message, as plain
    text (markdown marks dropped), or null when it has nothing to say. */
export function threadLaunchActivityLine(text: string | null | undefined): string | null {
  if (text == null) return null;
  const line = text
    .split("\n")
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate !== "" && !candidate.startsWith("```"));
  if (line === undefined) return null;
  const plain = line
    .replace(/^(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)/, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]+/g, "")
    .trim();
  return plain === "" ? null : plain;
}

/** Where a pull request stands, as the next thing it waits on. */
export type ThreadPullRequestStage =
  | "draft"
  | "checks-failing"
  | "checks-running"
  | "ready"
  | "merged"
  | "closed";

export const THREAD_PULL_REQUEST_STAGE_LABELS: Record<ThreadPullRequestStage, string> = {
  draft: "Draft",
  "checks-failing": "Checks failing",
  "checks-running": "Checks running",
  ready: "Ready to merge",
  merged: "Merged",
  closed: "Closed",
};

/** The PR chip's state (open, draft, merged, closed), with an open PR's checks read as the next
    step reads them; null while open with nothing to report or nothing synced yet. */
export function threadPullRequestStage(
  snapshot: ThreadPullRequestSnapshot | null | undefined,
): ThreadPullRequestStage | null {
  if (snapshot == null) return null;
  const state = pullRequestChipStateOf(snapshot);
  if (state !== "open") return state ?? null;
  if (snapshot.checksState === "failing") return "checks-failing";
  if (snapshot.checksState === "pending") return "checks-running";
  return snapshot.checksState === "passing" &&
    snapshot.mergeability === "mergeable" &&
    snapshot.reviewDecision !== "changes-requested"
    ? "ready"
    : null;
}

export interface ThreadLaunchPullRequest {
  readonly number: number;
  readonly url: string;
  readonly title: string | null;
  readonly stage: ThreadPullRequestStage | null;
}

interface ThreadPullRequestSource {
  readonly pullRequests: ReadonlyArray<ThreadPullRequestLink>;
  readonly linkedPullRequest?: ThreadLinkedPullRequest | null;
  readonly branchPullRequest?: ThreadLinkedPullRequest | null;
}

/** Every pull request the thread has: its links, then the one linked to it or found on its
    branch (which the composer's chip shows, and the links can lack), each once. A thread still
    at work (`idle` false) holds back "Ready to merge", since its work can change the PR. */
export function threadLaunchPullRequests(
  thread: ThreadPullRequestSource,
  idle = true,
): ReadonlyArray<ThreadLaunchPullRequest> {
  const seen = new Set<string>();
  const out: ThreadLaunchPullRequest[] = [];
  const add = (pr: ThreadLaunchPullRequest) => {
    if (seen.has(pr.url)) return;
    seen.add(pr.url);
    out.push(pr);
  };
  for (const link of visibleThreadPullRequests(thread.pullRequests)) {
    add({
      number: link.number,
      url: link.url,
      title: link.snapshot?.title ?? null,
      stage: idleStage(threadPullRequestStage(link.snapshot), idle),
    });
  }
  for (const pr of [thread.linkedPullRequest, thread.branchPullRequest]) {
    if (pr != null) add({ number: pr.number, url: pr.url, title: null, stage: null });
  }
  return out;
}

function idleStage(
  stage: ThreadPullRequestStage | null,
  idle: boolean,
): ThreadPullRequestStage | null {
  return stage === "ready" && !idle ? null : stage;
}

/** A row's live read of its thread: its background work, and PRs that read "Ready to merge" only
    once nothing runs. A PR watch is not work: on a ready PR it waits on the owner's merge. `ready`
    is the current PR when it reads ready, the one place that decides it. */
export function threadRowLiveState(
  thread:
    | (ThreadPullRequestSource & {
        readonly pendingBackgroundTasks: ReadonlyArray<OrchestrationV2PendingBackgroundTask>;
        readonly runtime: { readonly status: string } | null;
      })
    | null,
  status: SidebarThreadStatus | null,
): {
  readonly activity: string | null;
  readonly pullRequests: ReadonlyArray<ThreadLaunchPullRequest>;
  readonly ready: ThreadPullRequestLink | null;
} {
  if (thread === null) return { activity: null, pullRequests: [], ready: null };
  const work = thread.pendingBackgroundTasks.filter((task) => !isPullRequestWatchTask(task));
  const activity = presentPendingBackgroundWork(work)?.title ?? null;
  // "waiting" is also a turn blocked on a thread wait; only a parked runtime waits on its PR.
  const parked = status === "waiting" && thread.runtime?.status === "idle";
  const idle = (status === "ready" || parked) && activity === null;
  const current = idle ? resolveThreadCurrentPullRequestLink(thread.pullRequests) : null;
  return {
    activity,
    pullRequests: threadLaunchPullRequests(thread, idle),
    ready:
      current !== null && threadPullRequestStage(current.snapshot) === "ready" ? current : null,
  };
}

type LaunchRow = Extract<MessagesTimelineRow, { kind: "fork-thread-launch" }>;

/** Each work report in the entries, with the thread it names and the launched thread id when that
    thread was launched here (a launch comes before its reports). */
function* threadReports(entries: ReadonlyArray<TimelineEntry>) {
  const launched = new Set<ThreadId>();
  for (const entry of entries) {
    if (entry.kind === "fork-thread-launch" && entry.launch.threadId !== null) {
      launched.add(entry.launch.threadId);
    }
    if (entry.kind !== "work") continue;
    const report = forkWorkReportOfEntry(entry);
    if (report === null) continue;
    const threadId = report.threadId ?? forkWorkReportThreadId(report.key, launched);
    const launchedThreadId = threadId !== null && launched.has(threadId) ? threadId : null;
    yield { entry, report, threadId, launchedThreadId };
  }
}

type MessageText = { readonly text: string };
const linkedThreadIdsByMessage = new WeakMap<MessageText, ReadonlySet<ThreadId>>();

/** The thread ids a reply's chips name, parsed once per message object. Uses `replaceThreadLinks`
    as a visitor to read `ThreadLink`s without an environment, collecting both written and
    percent-decoded ids as `threadLinkCandidates` does (matched by thread id across environments). */
function linkedThreadIds(message: MessageText): ReadonlySet<ThreadId> {
  let ids = linkedThreadIdsByMessage.get(message);
  if (ids === undefined) {
    const found = new Set<ThreadId>();
    if (hasThreadLinks(message.text)) {
      replaceThreadLinks(message.text, (link) => {
        found.add(link.threadId);
        try {
          const decoded = decodeURIComponent(link.threadId);
          if (decoded !== link.threadId && decoded !== "") found.add(decoded as ThreadId);
        } catch {
          // Malformed escapes keep only the written id.
        }
        return undefined;
      });
    }
    ids = found;
    linkedThreadIdsByMessage.set(message, ids);
  }
  return ids;
}

export interface ForkLaunchedThreads {
  /** Reports that draw no row, since their thread's launch row already shows it. */
  readonly hiddenReportIds: ReadonlySet<string>;
  /** Each hidden-report wake run's launched threads, which can pull their launch row down. */
  readonly reportThreadsByRun: ReadonlyMap<RunId, ReadonlySet<ThreadId>>;
  /** Runs where a kept request report already draws a thread inline, so that run never pulls its
      launch row too (even if the wake's reply links its chip). */
  readonly inlineThreadsByRun: ReadonlyMap<RunId, ReadonlySet<ThreadId>>;
}

function addRunThread(
  map: Map<RunId, Set<ThreadId>>,
  runId: RunId | null | undefined,
  threadId: ThreadId,
) {
  if (runId == null) return;
  let threads = map.get(runId);
  if (threads === undefined) {
    threads = new Set();
    map.set(runId, threads);
  }
  threads.add(threadId);
}

/** A thread's row shows once, under the latest reply about it, and reads its status live there,
    so a later report of that thread draws no row; a question or approval keeps its card where the
    conversation answers inline. The entries stay: a report notice starts its wake's turn. */
export function forkLaunchedThreads(
  entries: ReadonlyArray<TimelineEntry>,
  keepRequestReports: boolean,
): ForkLaunchedThreads {
  const hiddenReportIds = new Set<string>();
  const reportThreadsByRun = new Map<RunId, Set<ThreadId>>();
  const inlineThreadsByRun = new Map<RunId, Set<ThreadId>>();
  for (const { entry, report, launchedThreadId } of threadReports(entries)) {
    if (launchedThreadId === null) continue;
    // A question or approval answered inline draws the thread in its own wake already.
    if (keepRequestReports && report.requestKind !== null) {
      addRunThread(inlineThreadsByRun, entry.entry.runId, launchedThreadId);
      continue;
    }
    hiddenReportIds.add(entry.id);
    addRunThread(reportThreadsByRun, entry.entry.runId, launchedThreadId);
  }
  return { hiddenReportIds, reportThreadsByRun, inlineThreadsByRun };
}

/** The finished report that stays when a quiet wake hides it: each thread's latest, as its one
    row, unless the thread shows under its launch here. An older server names the thread only in
    the key, so each of its reports stays. */
export function lastThreadReportIds(entries: ReadonlyArray<TimelineEntry>): ReadonlySet<string> {
  const lastByThread = new Map<string, string>();
  for (const { entry, report, threadId, launchedThreadId } of threadReports(entries)) {
    if (launchedThreadId === null && report.requestKind === null)
      lastByThread.set(threadId ?? report.key, entry.id);
  }
  return new Set(lastByThread.values());
}

/** Before grouping, every launch row carries the single `t3_thread_launch` call it came from. */
function launchThreadId(row: LaunchRow): ThreadId | null {
  return row.launches[0]!.launch.threadId;
}

/** A turn's launched threads drawn by its last reply shown, between its text and actions, or by a
    later turn's when that turn's reply links the thread or a hidden work report woke it, so a row
    follows the talk about it. With no reply shown they stay where the calls were, one run's
    consecutive calls in one row. Rows come one per call; this is the only place they group. */
export function placeLaunchesUnderReplies(
  rows: ReadonlyArray<MessagesTimelineRow>,
  launched: ForkLaunchedThreads,
): MessagesTimelineRow[] {
  const launchedThreadIds = new Set<ThreadId>();
  const replyByRun = new Map<RunId, { readonly index: number; readonly message: MessageText }>();
  rows.forEach((row, index) => {
    if (row.kind === "fork-thread-launch") {
      const threadId = launchThreadId(row);
      if (threadId !== null) launchedThreadIds.add(threadId);
    } else if (
      row.kind === "message" &&
      row.message.role === "assistant" &&
      row.message.runId != null
    ) {
      // Delete first so iteration stays in ascending reply-index order across runs.
      replyByRun.delete(row.message.runId);
      replyByRun.set(row.message.runId, { index, message: row.message });
    }
  });
  const latestAbout = new Map<ThreadId, { readonly runId: RunId; readonly index: number }>();
  if (launchedThreadIds.size > 0) {
    for (const [runId, { index, message }] of replyByRun) {
      const inline = launched.inlineThreadsByRun.get(runId);
      for (const threadId of [
        ...(launched.reportThreadsByRun.get(runId) ?? []),
        ...linkedThreadIds(message),
      ]) {
        if (launchedThreadIds.has(threadId) && !inline?.has(threadId)) {
          latestAbout.set(threadId, { runId, index });
        }
      }
    }
  }
  const anchorByRowId = new Map<string, RunId>();
  const groups = new Map<RunId, LaunchRow[]>();
  rows.forEach((row, rowIndex) => {
    if (row.kind !== "fork-thread-launch") return;
    const threadId = launchThreadId(row);
    const later = threadId === null ? undefined : latestAbout.get(threadId);
    const ownReply = row.runId === null ? undefined : replyByRun.get(row.runId);
    const runId =
      later !== undefined &&
      later.index >= rowIndex &&
      (ownReply === undefined || later.index >= ownReply.index)
        ? later.runId
        : ownReply !== undefined
          ? row.runId
          : null;
    if (runId === null) return;
    anchorByRowId.set(row.id, runId);
    groups.set(runId, [...(groups.get(runId) ?? []), row]);
  });
  const runAtReply = new Map<number, RunId>();
  for (const [runId, { index }] of replyByRun) if (groups.has(runId)) runAtReply.set(index, runId);
  const out: MessagesTimelineRow[] = [];
  rows.forEach((row, index) => {
    if (row.kind === "fork-thread-launch") {
      if (anchorByRowId.has(row.id)) return;
      const previous = out.at(-1);
      if (previous?.kind === "fork-thread-launch" && sameLaunchGroup(previous, row)) {
        out[out.length - 1] = { ...previous, launches: [...previous.launches, ...row.launches] };
      } else {
        out.push(row);
      }
      return;
    }
    const runId = runAtReply.get(index);
    const group = runId === undefined ? undefined : groups.get(runId);
    out.push(
      row.kind === "message" && group !== undefined
        ? { ...row, forkLaunches: group.flatMap((launch) => launch.launches) }
        : row,
    );
  });
  return out;
}

export function forkThreadLaunchListsEqual(
  a: ReadonlyArray<{ readonly id: string; readonly launch: ForkThreadLaunch }> | undefined,
  b: ReadonlyArray<{ readonly id: string; readonly launch: ForkThreadLaunch }> | undefined,
): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined || a.length !== b.length) return false;
  return a.every(
    (entry, index) =>
      entry.id === b[index]?.id && forkThreadLaunchesEqual(entry.launch, b[index]?.launch),
  );
}
