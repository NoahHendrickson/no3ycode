/**
 * A thread an agent started with `t3_thread_launch`, read from its tool call — see
 * `.fork/customizations.yaml#fork-thread-launch-cards`. The wire keeps only the `threadId` of
 * the tool's result (compactDynamicToolOutput), so the title comes from the call's input.
 */
import type {
  EnvironmentId,
  OrchestrationV2TurnItemStatus,
  RunId,
  ThreadId,
  ThreadLinkedPullRequest,
  ThreadPullRequestLink,
  ThreadPullRequestSnapshot,
} from "@t3tools/contracts";
import { visibleThreadPullRequests } from "@t3tools/shared/threadPullRequests";
import { resolveT3McpToolId } from "@t3tools/shared/t3McpToolPresentation";
import { compactDynamicToolOutput } from "@t3tools/shared/toolOutput";

import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";

import { resolvePullRequestChipState } from "../composerPullRequestChip.logic";

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
export function sameLaunchGroup(
  previous: { readonly runId: RunId | null } | undefined,
  next: { readonly runId: RunId | null },
): boolean {
  return previous !== undefined && previous.runId !== null && previous.runId === next.runId;
}

export function forkThreadLaunchesEqual(
  a: ForkThreadLaunch,
  b: ForkThreadLaunch | undefined,
): boolean {
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
  const state = resolvePullRequestChipState({ badge: null, pr: snapshot, pullRequests: [] });
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

/** Every pull request the thread has: its links, then the one linked to it or found on its
    branch (which the composer's chip shows, and the links can lack), each once. */
export function threadLaunchPullRequests(thread: {
  readonly pullRequests: ReadonlyArray<ThreadPullRequestLink>;
  readonly linkedPullRequest?: ThreadLinkedPullRequest | null;
  readonly branchPullRequest?: ThreadLinkedPullRequest | null;
}): ReadonlyArray<ThreadLaunchPullRequest> {
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
      stage: threadPullRequestStage(link.snapshot),
    });
  }
  for (const pr of [thread.linkedPullRequest, thread.branchPullRequest]) {
    if (pr != null) add({ number: pr.number, url: pr.url, title: null, stage: null });
  }
  return out;
}

// The server's work-report message ids (orchestration-v2/forkBotWorkReports): the prefix, then the
// reporting thread's id and the run or request it reports on. A notification's turn item id is
// `turn-item:message:` and that message id, URI-encoded.
const NOTIFICATION_ITEM_PREFIX = "turn-item:message:";
const WORK_REPORT_PREFIXES = ["message:fork-bot-work-report:", "message:fork-bot-work-seen:"];

function notificationMessageId(itemId: string): string | null {
  if (!itemId.startsWith(NOTIFICATION_ITEM_PREFIX)) return null;
  try {
    return decodeURIComponent(itemId.slice(NOTIFICATION_ITEM_PREFIX.length));
  } catch {
    return null;
  }
}

/** What follows a work report's prefix in its notification's item id, or null for another item. */
export function forkWorkReportKey(itemId: string): string | null {
  const messageId = notificationMessageId(itemId);
  if (messageId === null) return null;
  const prefix = WORK_REPORT_PREFIXES.find((candidate) => messageId.startsWith(candidate));
  return prefix === undefined ? null : messageId.slice(prefix.length);
}

// orchestration-v2/DelegatedTaskQuestionReactor's message id: the prefix, the parent thread's id,
// then the child's request id.
const DELEGATED_QUESTION_PREFIX = "message:delegated-task-question:";

/** The request a delegated child's question notice names, or null for any other notice. */
export function delegatedQuestionRequestId(itemId: string, parentThreadId: string): string | null {
  const messageId = notificationMessageId(itemId);
  const prefix = `${DELEGATED_QUESTION_PREFIX}${parentThreadId}:`;
  if (messageId === null || !messageId.startsWith(prefix)) return null;
  return messageId.slice(prefix.length) || null;
}

/** The thread a report key names. Thread ids can hold colons, so it is the longest of the
    candidates the key starts with, followed by a colon. */
export function forkWorkReportThreadId(key: string, threadIds: Iterable<string>): string | null {
  let best: string | null = null;
  for (const id of threadIds) {
    if (key.startsWith(`${id}:`) && (best === null || id.length > best.length)) best = id;
  }
  return best;
}

/** A report about a thread waiting on its owner: the server's summary ends with what it waits on. */
export function forkWorkReportRequestKind(summary: string): "question" | "approval" | null {
  if (summary.endsWith(" has a question")) return "question";
  if (summary.endsWith(" needs an approval")) return "approval";
  return null;
}

/** The request a report key names is the one the thread still waits on. */
export function forkWorkReportIsPending(
  key: string,
  threadId: string,
  pendingRequestId: string | null | undefined,
): boolean {
  return pendingRequestId != null && key === `${threadId}:${pendingRequestId}`;
}

export interface SprintAnswer {
  readonly question: string;
  readonly answer: string;
}

/** One ANSWERS.md entry's text: each question, an arrow, its answer as JSON; several joined by
    "; ". An approval's question is what it asked to do, its answer the decision. */
export function sprintAnswerLine(answers: ReadonlyArray<SprintAnswer>): string {
  return answers.map((entry) => `${entry.question} → ${JSON.stringify(entry.answer)}`).join("; ");
}

/** The owner's latest answers to a thread in the sprint's ANSWERS.md, or null when there are none. */
export function sprintAnswersFor(
  log: string,
  threadId: string,
): ReadonlyArray<SprintAnswer> | null {
  const marker = `(${threadId}): `;
  const line = log
    .split("\n")
    .filter((entry) => entry.startsWith("- ") && entry.includes(marker))
    .at(-1);
  if (line === undefined) return null;
  const said = line.slice(line.indexOf(marker) + marker.length);
  const answers = said.split("; ").flatMap((part) => {
    const arrow = part.lastIndexOf(" → ");
    if (arrow === -1) return [];
    const raw = part.slice(arrow + 3);
    let answer = raw;
    try {
      const parsed: unknown = JSON.parse(raw);
      answer = Array.isArray(parsed) ? parsed.join(", ") : String(parsed);
    } catch {
      // Written by hand: keep the words.
    }
    return [{ question: part.slice(0, arrow), answer }];
  });
  return answers.length === 0 ? null : answers;
}

/** One line in the sprint's ANSWERS.md for an answer the owner gave a thread directly; the log
    keeps the newest `keep` lines under its title. */
export function withSprintAnswer(log: string, line: string, keep = 20): string {
  const entries = log
    .split("\n")
    .filter((entry) => entry.startsWith("- "))
    .slice(-(keep - 1));
  return `# Answers\n\nYour owner answered these threads directly, from the sprint's conversation.\n\n${[...entries, `- ${line}`].join("\n")}\n`;
}

type LaunchRow = Extract<MessagesTimelineRow, { kind: "fork-thread-launch" }>;

/** A turn's launched threads drawn by the turn's last reply, as one group, between its text and
    its actions, so the reply that says it started them sits above them and the three hover as one.
    A turn with no reply shown keeps them as a row where the calls were. */
export function placeLaunchesUnderReplies(
  rows: ReadonlyArray<MessagesTimelineRow>,
): MessagesTimelineRow[] {
  const replyByRun = new Map<RunId, number>();
  rows.forEach((row, index) => {
    if (row.kind === "message" && row.message.role === "assistant" && row.message.runId != null)
      replyByRun.set(row.message.runId, index);
  });
  const groups = new Map<RunId, LaunchRow[]>();
  for (const row of rows) {
    if (row.kind !== "fork-thread-launch" || row.runId === null || !replyByRun.has(row.runId))
      continue;
    groups.set(row.runId, [...(groups.get(row.runId) ?? []), row]);
  }
  if (groups.size === 0) return [...rows];
  const runAtReply = new Map<number, RunId>();
  for (const [runId, index] of replyByRun) if (groups.has(runId)) runAtReply.set(index, runId);
  const out: MessagesTimelineRow[] = [];
  rows.forEach((row, index) => {
    if (row.kind === "fork-thread-launch" && row.runId !== null && groups.has(row.runId)) return;
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
