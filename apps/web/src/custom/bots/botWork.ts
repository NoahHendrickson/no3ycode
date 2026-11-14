/**
 * A bot's work, read from the shells already in memory — see
 * `.fork/customizations.yaml#fork-bot-work-threads`: the threads it launched and its subagents,
 * grouped for its Threads panel, and what of it needs the owner, for its sidebar card.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";

import { resolveSidebarThreadStatus, type SidebarThreadStatus } from "~/components/Sidebar.logic";

import {
  resolveSidebarV2CardStatus,
  sidebarV2CardTopStatus,
  type SidebarV2CardStatus,
} from "../sidebarV2CardStatus";
import {
  SIDEBAR_V2_STATUS_SECTION_LABELS,
  sidebarV2StatusBucketForKind,
  type SidebarV2StatusBucket,
} from "../sidebarV2StatusGrouping";
import { botWorkOwnerId } from "./botWorkRoster";

/** Whose work a thread is: a bot's launched thread, or its subagent. Null for anything else. */
function botWorkOf(thread: EnvironmentThreadShell): string | null {
  const owner = botWorkOwnerId(thread.source);
  if (owner !== null) return owner;
  return thread.lineage.relationshipToParent === "subagent" ? thread.lineage.parentThreadId : null;
}

/** The part of a bot's hidden work that needs its owner, the most pressing kind first. */
export interface BotWorkAttention {
  readonly status: "approval" | "input" | "failed";
  readonly count: number;
}

const ATTENTION_RANK: Record<BotWorkAttention["status"], number> = {
  approval: 0,
  input: 1,
  failed: 2,
};

function attentionStatus(status: SidebarThreadStatus): BotWorkAttention["status"] | null {
  switch (status) {
    case "approval":
      return "approval";
    case "input":
    case "request":
      return "input";
    case "failed":
      return "failed";
    default:
      return null;
  }
}

/** Per bot (`environmentId:threadId`), its unpinned launched threads that need the owner.
    Settled and archived threads are put away, so they never hold a bot's card. */
export function botWorkAttentionByBot(
  threads: ReadonlyArray<EnvironmentThreadShell>,
): ReadonlyMap<string, BotWorkAttention> {
  const byBot = new Map<string, BotWorkAttention>();
  for (const thread of threads) {
    const owner = botWorkOwnerId(thread.source);
    if (
      owner === null ||
      thread.archivedAt !== null ||
      thread.pinnedAt !== null ||
      thread.settledOverride === "settled"
    ) {
      continue;
    }
    const status = attentionStatus(resolveSidebarThreadStatus(thread));
    if (status === null) continue;
    const key = `${thread.environmentId}:${owner}`;
    const previous = byBot.get(key);
    byBot.set(key, {
      status:
        previous === undefined || ATTENTION_RANK[status] < ATTENTION_RANK[previous.status]
          ? status
          : previous.status,
      count: (previous?.count ?? 0) + 1,
    });
  }
  return byBot;
}

/** A bot card's status with its work's: what needs the owner outranks a bot that is idle or has
    only a report to read; a bot working or blocked itself keeps its own. */
export function withBotWorkAttention(
  card: SidebarV2CardStatus,
  attention: BotWorkAttention | null | undefined,
): SidebarV2CardStatus & { readonly botWork: BotWorkAttention | null } {
  if (attention == null || (card.status !== "ready" && card.status !== "waiting")) {
    return { ...card, botWork: null };
  }
  return {
    ...card,
    status: attention.status,
    kind: attention.status,
    topStatus: sidebarV2CardTopStatus(attention.status, { goalActive: false }),
    botWork: attention,
  };
}

/** A bot card's status line for its work. */
export function botWorkStatusText(attention: BotWorkAttention): string {
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

export type BotWorkGroupKey = Exclude<SidebarV2StatusBucket, "drafts"> | "settled";

const BOT_WORK_GROUP_ORDER: ReadonlyArray<BotWorkGroupKey> = [
  "input",
  "done",
  "working",
  "idle",
  "settled",
];

export interface BotWorkRow {
  readonly thread: EnvironmentThreadShell;
  readonly card: SidebarV2CardStatus;
}

export interface BotWorkGroup {
  readonly key: BotWorkGroupKey;
  readonly label: string;
  readonly rows: ReadonlyArray<BotWorkRow>;
}

function activityAt(thread: EnvironmentThreadShell): string {
  return thread.latestUserMessageAt ?? thread.updatedAt;
}

/** A bot's work in the sidebar's status sections, what needs the owner first, newest first in
    each; empty sections are left out. Read state is the sidebar's (`lastVisitedAt`). */
export function groupBotWork(
  threads: ReadonlyArray<EnvironmentThreadShell>,
  bot: { readonly environmentId: string; readonly threadId: string },
  lastVisitedAt: (thread: EnvironmentThreadShell) => string | undefined,
): ReadonlyArray<BotWorkGroup> {
  const byGroup = new Map<BotWorkGroupKey, BotWorkRow[]>();
  for (const thread of threads) {
    if (
      thread.environmentId !== bot.environmentId ||
      thread.archivedAt !== null ||
      botWorkOf(thread) !== bot.threadId
    ) {
      continue;
    }
    const card = resolveSidebarV2CardStatus(thread, {
      lastVisitedAt: lastVisitedAt(thread),
      wokeAt: null,
    });
    const bucket = sidebarV2StatusBucketForKind(card.kind);
    const key: BotWorkGroupKey =
      thread.settledOverride === "settled" && bucket !== "input" && bucket !== "working"
        ? "settled"
        : bucket === "drafts"
          ? "idle"
          : bucket;
    const rows = byGroup.get(key) ?? [];
    rows.push({ thread, card });
    byGroup.set(key, rows);
  }
  return BOT_WORK_GROUP_ORDER.flatMap((key) => {
    const rows = byGroup.get(key);
    if (rows === undefined) return [];
    return [
      {
        key,
        label: SIDEBAR_V2_STATUS_SECTION_LABELS[key],
        rows: rows.toSorted((left, right) =>
          activityAt(right.thread).localeCompare(activityAt(left.thread)),
        ),
      },
    ];
  });
}
