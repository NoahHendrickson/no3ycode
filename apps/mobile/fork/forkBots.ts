/**
 * Bots on the no3y iOS Threads screen — mobile copies of the Mac fork's listing, mascot and mood
 * rules (apps/web/src/custom/bots/botThreads.ts, botMascotTags.ts), parity-guarded in
 * `no3yMobileRedesign.test.ts`; see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import {
  FORK_BOT_MASCOT_TAG_PREFIX,
  forkBotWorkOwner,
  isForkBotThread,
} from "@t3tools/shared/forkBotTags";

import {
  BOT_MASCOT_SHAPES,
  isBotMascotShape,
  type BotMascotMood,
  type BotMascotShape,
} from "./botMascotArt";
import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";

interface BotListFields {
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly source?: { readonly tags?: ReadonlyArray<string> | undefined } | undefined;
}

/** Live, unarchived bots, oldest first so a bot keeps its place (the Mac's listSidebarBots). */
export function listNo3yBots<T extends BotListFields>(threads: ReadonlyArray<T>): T[] {
  return threads
    .filter((thread) => thread.archivedAt === null && isForkBotThread(thread.source?.tags))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

/** The mascot a bot was given, or one picked from its id so an untagged bot still has a face. */
export function no3yBotMascotShape(shell: {
  readonly id: string;
  readonly tags?: ReadonlyArray<string> | undefined;
}): BotMascotShape {
  for (const tag of shell.tags ?? []) {
    const name = tag.startsWith(FORK_BOT_MASCOT_TAG_PREFIX)
      ? tag.slice(FORK_BOT_MASCOT_TAG_PREFIX.length)
      : "";
    if (isBotMascotShape(name)) return name;
  }
  let hash = 0;
  for (const char of shell.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return BOT_MASCOT_SHAPES[hash % BOT_MASCOT_SHAPES.length] ?? "Classic";
}

/** The Mac's mood rules read from a card status: thinking, happy with news, crossed out, asleep. */
export function no3yBotMascotMood(kind: SidebarV2CardStatusKind | null): BotMascotMood {
  switch (kind) {
    case "failed":
    case "limited":
      return "Error";
    case "working":
      return "Thinking";
    case "done":
      return "Happy";
    case null:
    case "monitoring":
      return "Sleeping";
    default:
      return "Idle";
  }
}

/** A thread's status in the Mac sidebar's words, which the bot rules read. */
export type No3yBotThreadStatus =
  | "working"
  | "preparing"
  | "approval"
  | "input"
  | "request"
  | "failed"
  | "limited"
  | "waiting"
  | "ready";

/** A Petal card's second line: what it is doing, did last, or does next (the Mac's botStatusLine). */
export type No3yBotStatusLine = { readonly text: string } | { readonly nextWakeAt: string };

/** The first line of a message as plain words: markdown marks and link targets dropped. */
function botMessageSummary(text: string): string {
  const line =
    text
      .split("\n")
      .map((candidate) => candidate.trim())
      .find((candidate) => candidate !== "" && !/^(```|---|\*\*\*)/.test(candidate)) ?? "";
  return line
    .replace(/^(#{1,6}|[-*+]|\d+\.|>)\s+/, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|`)/g, "")
    .trim();
}

/** An unread report is the news; once it is read, when the bot next checks. */
export function no3yBotStatusLine(input: {
  readonly shell: { readonly latestVisibleMessage?: { readonly text: string } | null };
  readonly status: No3yBotThreadStatus;
  readonly isUnread: boolean;
  readonly nextWakeAt: string | null;
}): No3yBotStatusLine {
  switch (input.status) {
    case "working":
    case "preparing":
      return { text: "Working on it…" };
    case "approval":
      return { text: "Needs your approval" };
    case "input":
    case "request":
      return { text: "Waiting for your reply" };
    case "failed":
      return { text: "Last run failed" };
    case "limited":
      return { text: "Hit a usage limit" };
    case "waiting":
    case "ready":
      break;
  }
  const report = input.shell.latestVisibleMessage;
  const summary = report == null ? "" : botMessageSummary(report.text);
  if (summary !== "" && (input.isUnread || input.nextWakeAt === null)) return { text: summary };
  if (input.nextWakeAt !== null) return { nextWakeAt: input.nextWakeAt };
  return { text: "Tell it what its job is" };
}

/** The part of a bot's launched work that needs its owner, the most pressing kind first. */
export interface No3yBotWorkAttention {
  readonly status: "approval" | "input" | "failed";
  readonly count: number;
}

export interface No3yBotWork {
  readonly attention: No3yBotWorkAttention | null;
  readonly working: boolean;
}

const ATTENTION_RANK: Record<No3yBotWorkAttention["status"], number> = {
  approval: 0,
  input: 1,
  failed: 2,
};

function attentionStatus(status: No3yBotThreadStatus): No3yBotWorkAttention["status"] | null {
  if (status === "approval") return "approval";
  if (status === "input" || status === "request") return "input";
  if (status === "failed") return "failed";
  return null;
}

interface BotWorkThread {
  readonly environmentId: string;
  readonly id: string;
  readonly archivedAt: string | null;
  readonly pinnedAt: string | null;
  readonly settledOverride?: string | null | undefined;
  readonly lastVisitedAt?: string | null | undefined;
  readonly updatedAt: string;
  readonly latestRun?: { readonly completedAt?: string | null | undefined } | null | undefined;
  readonly lineage: {
    readonly relationshipToParent?: string | null | undefined;
    readonly parentThreadId: string | null;
  };
  readonly source: { readonly tags?: ReadonlyArray<string> | undefined };
}

/** A failure the owner has opened since is read: it stops holding the bot's card. */
function failureUnread(thread: BotWorkThread): boolean {
  if (!thread.lastVisitedAt) return true;
  const failedAt = Date.parse(thread.latestRun?.completedAt ?? thread.updatedAt);
  const visitedAt = Date.parse(thread.lastVisitedAt);
  return Number.isNaN(failedAt) || Number.isNaN(visitedAt) || failedAt > visitedAt;
}

/**
 * Per bot (`environmentId:threadId`), its work in one pass (the Mac's botWorkByBot): its unpinned
 * launched threads that need the owner, and whether it or its work is running.
 */
export function no3yBotWorkByBot<T extends BotWorkThread>(
  threads: ReadonlyArray<T>,
  statusOf: (thread: T) => No3yBotThreadStatus,
  isRunning: (thread: T) => boolean,
): ReadonlyMap<string, No3yBotWork> {
  const byBot = new Map<string, { attention: No3yBotWorkAttention | null; working: boolean }>();
  const entry = (key: string) => {
    const existing = byBot.get(key);
    if (existing !== undefined) return existing;
    const created = { attention: null, working: false };
    byBot.set(key, created);
    return created;
  };
  for (const thread of threads) {
    if (thread.archivedAt !== null) continue;
    const owner = forkBotWorkOwner(thread.source.tags);
    if (isRunning(thread)) {
      const botId = isForkBotThread(thread.source.tags)
        ? thread.id
        : thread.lineage.relationshipToParent === "subagent" &&
            thread.lineage.parentThreadId !== null
          ? thread.lineage.parentThreadId
          : owner;
      if (botId !== null) entry(`${thread.environmentId}:${botId}`).working = true;
    }
    if (owner === null || thread.pinnedAt !== null) continue;
    const status = attentionStatus(statusOf(thread));
    if (status === null) continue;
    if (status === "failed" && (thread.settledOverride === "settled" || !failureUnread(thread))) {
      continue;
    }
    const work = entry(`${thread.environmentId}:${owner}`);
    const previous = work.attention;
    work.attention = {
      status:
        previous === null || ATTENTION_RANK[status] < ATTENTION_RANK[previous.status]
          ? status
          : previous.status,
      count: (previous?.count ?? 0) + 1,
    };
  }
  return byBot;
}

/** A Petal card's line for its work (the Mac's botWorkStatusText). */
export function no3yBotWorkStatusText(attention: No3yBotWorkAttention): string {
  if (attention.count > 1) return `${attention.count} threads need you`;
  switch (attention.status) {
    case "approval":
      return "A thread needs your approval";
    case "input":
      return "A thread is waiting for your reply";
    case "failed":
      return "A thread failed";
  }
}

/**
 * A Petal card's mark with its work's, over the bot's own idle or waiting state only: what needs
 * the owner first, then working, unless an unread report or a wake is news to keep.
 */
export function no3yPetalMark(
  ownKind: SidebarV2CardStatusKind | null,
  ownStatus: No3yBotThreadStatus,
  work: No3yBotWork | undefined,
): {
  readonly kind: SidebarV2CardStatusKind | null;
  readonly attention: No3yBotWorkAttention | null;
} {
  const attention = work?.attention ?? null;
  const status =
    attention?.status ??
    (work?.working === true && ownKind !== "done" && ownKind !== "woke" ? "working" : null);
  if (status === null || (ownStatus !== "ready" && ownStatus !== "waiting")) {
    return { kind: ownKind, attention: null };
  }
  return { kind: status, attention };
}
