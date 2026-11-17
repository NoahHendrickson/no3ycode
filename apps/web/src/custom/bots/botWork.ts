/**
 * A bot's work, read from the shells already in memory — see
 * `.fork/customizations.yaml#fork-bot-work-threads`: the threads it launched and its subagents,
 * grouped for its Threads panel, and what of it needs the owner, for its sidebar card.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";

import { THREAD_STATUS_TEXT } from "@t3tools/client-runtime/state/thread-activity-announcement";

import {
  resolveSidebarThreadStatus,
  resolveWindowTitleThreadStatus,
  type SidebarThreadStatus,
} from "~/components/Sidebar.logic";

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
import { isBotThread, isListedBot } from "./botThreads";
import { botWorkOwnerId, threadParentOf } from "./botWorkRoster";

/** Whose Threads panel a thread shows: a bot its own, a bot's work (a launched thread, or a
    subagent) its bot's, and nothing for any other thread. */
export function botThreadsPanelBotId(
  thread: Pick<EnvironmentThreadShell, "id" | "source" | "lineage">,
  parent: Pick<EnvironmentThreadShell, "id" | "source" | "archivedAt"> | null,
) {
  if (isBotThread(thread.source)) return thread.id;
  return parent !== null && parent.id === threadParentOf(thread)?.threadId && isListedBot(parent)
    ? parent.id
    : null;
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

/** Blocked on the owner now, which a settled thread can become again. */
function asksOwner(status: SidebarThreadStatus | SidebarV2CardStatus["kind"]): boolean {
  return status === "approval" || status === "input" || status === "request";
}

/** A failure the owner has opened since is read: it stops holding the bot's card. */
function failureUnread(thread: EnvironmentThreadShell): boolean {
  if (!thread.lastVisitedAt) return true;
  const failedAt = Date.parse(thread.latestRun?.completedAt ?? thread.updatedAt);
  const visitedAt = Date.parse(thread.lastVisitedAt);
  return Number.isNaN(failedAt) || Number.isNaN(visitedAt) || failedAt > visitedAt;
}

/** What a bot's work says on its card. `attention`: its unpinned launched threads that need
    the owner (a pinned one shows on its own card). `working`: the bot's own turn, or anything in
    its Threads panel, pinned or not, is running. */
export interface BotWork {
  readonly attention: BotWorkAttention | null;
  readonly working: boolean;
}

/** Running now, waiting on a thread included and a guest's message ignored: the window
    title's rule for "working". */
function isRunning(thread: EnvironmentThreadShell): boolean {
  return resolveWindowTitleThreadStatus(thread) === THREAD_STATUS_TEXT.working;
}

/** Per bot (`environmentId:threadId`), its work in one pass. Archived threads are put away, and
    so are settled ones unless they ask for the owner again; a failure counts until the owner has
    opened it. */
export function botWorkByBot(
  threads: ReadonlyArray<EnvironmentThreadShell>,
): ReadonlyMap<string, BotWork> {
  const byBot = new Map<string, { attention: BotWorkAttention | null; working: boolean }>();
  const entry = (key: string) => {
    const existing = byBot.get(key);
    if (existing !== undefined) return existing;
    const created = { attention: null, working: false };
    byBot.set(key, created);
    return created;
  };
  for (const thread of threads) {
    if (thread.archivedAt !== null) continue;
    if (isRunning(thread)) {
      const botId = isBotThread(thread.source) ? thread.id : threadParentOf(thread)?.threadId;
      if (botId !== undefined) entry(`${thread.environmentId}:${botId}`).working = true;
    }
    const owner = botWorkOwnerId(thread.source);
    if (owner === null || thread.pinnedAt !== null) continue;
    const status = attentionStatus(resolveSidebarThreadStatus(thread));
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

/** A bot card's status with its work's, over the bot's own idle or waiting state only: what
    needs the owner first, then working, unless an unread report or a wake is news to keep. */
export function withBotWorkAttention(
  card: SidebarV2CardStatus,
  work: BotWork | null | undefined,
): SidebarV2CardStatus & { readonly botWork: BotWorkAttention | null } {
  const attention = work?.attention ?? null;
  const status =
    attention?.status ??
    (work?.working === true && card.kind !== "done" && card.kind !== "woke" ? "working" : null);
  if (status === null || (card.status !== "ready" && card.status !== "waiting")) {
    return { ...card, botWork: null };
  }
  return {
    ...card,
    status,
    kind: status,
    topStatus: sidebarV2CardTopStatus(status, { goalActive: false }),
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

/** Every section the panel can show, in its order, for the filter menu. */
export const BOT_WORK_GROUPS: ReadonlyArray<{
  readonly key: BotWorkGroupKey;
  readonly label: string;
}> = BOT_WORK_GROUP_ORDER.map((key) => ({ key, label: SIDEBAR_V2_STATUS_SECTION_LABELS[key] }));

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

/** How the rows inside each section are ordered. */
export type BotWorkSort = "activity" | "newest" | "oldest" | "title";

export const BOT_WORK_SORTS: ReadonlyArray<BotWorkSort> = ["activity", "newest", "oldest", "title"];

export const BOT_WORK_SORT_LABELS: Record<BotWorkSort, string> = {
  activity: "Last activity",
  newest: "Newest",
  oldest: "Oldest",
  title: "Title",
};

const BOT_WORK_COMPARE: Record<BotWorkSort, (left: BotWorkRow, right: BotWorkRow) => number> = {
  activity: (left, right) => activityAt(right.thread).localeCompare(activityAt(left.thread)),
  newest: (left, right) => right.thread.createdAt.localeCompare(left.thread.createdAt),
  oldest: (left, right) => left.thread.createdAt.localeCompare(right.thread.createdAt),
  title: (left, right) =>
    left.thread.title.localeCompare(right.thread.title, undefined, { sensitivity: "base" }),
};

/** What the Threads panel is narrowed to; an empty set or query narrows nothing. */
export interface BotWorkFilter {
  readonly query: string;
  readonly groups: ReadonlySet<BotWorkGroupKey>;
  readonly projectIds: ReadonlySet<string>;
}

/** The sections and rows a filter keeps: a query matches a title or a branch. Sections left
    with no row are dropped, and an untouched section keeps its identity. */
export function filterBotWork(
  groups: ReadonlyArray<BotWorkGroup>,
  filter: BotWorkFilter,
): ReadonlyArray<BotWorkGroup> {
  const query = filter.query.trim().toLowerCase();
  if (query === "" && filter.groups.size === 0 && filter.projectIds.size === 0) return groups;
  return groups.flatMap((group) => {
    if (filter.groups.size > 0 && !filter.groups.has(group.key)) return [];
    const rows = group.rows.filter(
      ({ thread }) =>
        (filter.projectIds.size === 0 || filter.projectIds.has(thread.projectId)) &&
        (query === "" ||
          thread.title.toLowerCase().includes(query) ||
          (thread.branch?.toLowerCase().includes(query) ?? false)),
    );
    if (rows.length === 0) return [];
    return [rows.length === group.rows.length ? group : { ...group, rows }];
  });
}

/** A bot's work in the sidebar's status sections, what needs the owner first, ordered by `sort`
    in each; empty sections are left out. Read state is the sidebar's (`lastVisitedAt`). */
export function groupBotWork(
  threads: ReadonlyArray<EnvironmentThreadShell>,
  bot: { readonly environmentId: string; readonly threadId: string },
  lastVisitedAt: (thread: EnvironmentThreadShell) => string | undefined,
  sort: BotWorkSort = "activity",
): ReadonlyArray<BotWorkGroup> {
  const byGroup = new Map<BotWorkGroupKey, BotWorkRow[]>();
  for (const thread of threads) {
    if (
      thread.environmentId !== bot.environmentId ||
      thread.archivedAt !== null ||
      threadParentOf(thread)?.threadId !== bot.threadId
    ) {
      continue;
    }
    const card = resolveSidebarV2CardStatus(thread, {
      lastVisitedAt: lastVisitedAt(thread),
      wokeAt: null,
    });
    const bucket = sidebarV2StatusBucketForKind(card.kind);
    // Settled is put away, a settled failure too, unless the thread is working or asks again.
    const key: BotWorkGroupKey =
      thread.settledOverride === "settled" && bucket !== "working" && !asksOwner(card.kind)
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
        rows: rows.toSorted(BOT_WORK_COMPARE[sort]),
      },
    ];
  });
}
