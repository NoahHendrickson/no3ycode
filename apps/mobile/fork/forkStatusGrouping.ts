/** Mobile copy of web's status-grouping primitives — guarded for parity in `no3yMobileRedesign.test.ts`. */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import {
  sortInboxThreadsByReturn,
  sortWorkingThreadsBySend,
} from "@t3tools/client-runtime/state/thread-inbox";
import { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";
import type { EnvironmentId } from "@t3tools/contracts";

/** Every status a sidebar thread can report before folding into card marks. */
export type SidebarThreadBaseStatus =
  | "approval"
  | "input"
  | "request"
  | "preparing"
  | "working"
  | "waiting"
  | "failed"
  | "limited"
  | "ready";

/** Every mark a card can draw, before labels. */
export type SidebarV2CardStatusKind =
  | "working"
  | "waiting"
  | "approval"
  | "input"
  | "request"
  | "limited"
  | "failed"
  | "woke"
  | "done"
  | "monitoring";

export type SidebarV2StatusBucket = "drafts" | "input" | "done" | "working" | "idle";

/** Paint order: unsent drafts on top, then blocked agents, then results to read, then live work. */
export const SIDEBAR_V2_STATUS_BUCKET_ORDER: readonly SidebarV2StatusBucket[] = [
  "drafts",
  "input",
  "done",
  "working",
  "idle",
];

/** The sections the collapse store holds: the status sections plus the pinned block. */
export type SidebarV2StatusSectionKey = SidebarV2StatusBucket | "pinned";

/** Every header status grouping draws (including Snoozed and Settled shelves). */
export type SidebarV2StatusHeaderKey = SidebarV2StatusSectionKey | "snoozed" | "settled";

export const SIDEBAR_V2_STATUS_SECTION_LABELS: Record<SidebarV2StatusHeaderKey, string> = {
  drafts: "Drafts",
  pinned: "Pinned",
  input: "Needs input",
  done: "Completed",
  working: "Working",
  idle: "Idle",
  snoozed: "Snoozed",
  settled: "Settled",
};

/** How long a thread that came to rest stays in Completed after you leave it. */
export const SIDEBAR_V2_COMPLETED_HOLD_MS = 5 * 60_000;

/** The fields grouping and the inbox sorts read. */
export type SidebarV2StatusSectionThread = Pick<
  EnvironmentThreadShell,
  "id" | "environmentId" | "createdAt" | "unsettledAt" | "latestRun" | "latestUserAuthoredMessageAt"
>;

/** One status section carrying the full count so a collapsed header still reports its size. */
export interface SidebarV2StatusSection<TThread> {
  readonly kind: "status";
  readonly header: null;
  readonly status: SidebarV2StatusBucket;
  readonly threads: readonly TThread[];
  readonly threadCount: number;
}

/**
 * The mark ladder, top wins: live and blocked states first, then woke, then an
 * unread Done, then Monitoring.
 */
export function resolveSidebarV2CardStatusKind(input: {
  readonly status: SidebarThreadBaseStatus;
  readonly isUnread: boolean;
  readonly isWoke: boolean;
  readonly hasPendingBackgroundTasks: boolean;
}): SidebarV2CardStatusKind | null {
  if (input.status === "preparing") return "working";
  if (input.status !== "ready") return input.status;
  if (input.isWoke) return "woke";
  if (input.isUnread) return "done";
  if (input.hasPendingBackgroundTasks) return "monitoring";
  return null;
}

/** Splits the Drafts section off the painted sections so it paints above Pinned. */
export function splitSidebarV2DraftsSection<
  TSection extends { readonly kind: string; readonly status?: SidebarV2StatusBucket },
>(sections: readonly TSection[]) {
  const isDrafts = (section: TSection): section is Extract<TSection, { kind: "status" }> =>
    section.kind === "status" && section.status === "drafts";
  const draftsSection = sections.find(isDrafts) ?? null;
  return {
    draftsSection,
    listSections: draftsSection === null ? sections : sections.filter((s) => !isDrafts(s)),
  };
}

/** Folds a card's status kind into a section. Woke joins Completed; commands-only monitoring stays Idle. */
export function sidebarV2StatusBucketForKind(
  kind: SidebarV2CardStatusKind | null,
): SidebarV2StatusBucket {
  switch (kind) {
    case "approval":
    case "input":
    case "request":
    case "failed":
    case "limited":
      return "input";
    case "working":
    case "waiting":
      return "working";
    case "done":
    case "woke":
      return "done";
    case "monitoring":
    case null:
      return "idle";
  }
}

/**
 * Remembers which threads just came to rest so they linger in Completed for
 * `holdMs` after leaving them rather than jumping to Idle immediately.
 */
export function createSidebarV2CompletedHoldTracker(holdMs = SIDEBAR_V2_COMPLETED_HOLD_MS) {
  let previous: ReadonlyMap<string, SidebarV2StatusBucket> | null = null;
  let previousOpenThreadKey: string | null = null;
  const heldSince = new Map<string, number>();
  return {
    apply(input: {
      readonly buckets: ReadonlyMap<string, SidebarV2StatusBucket>;
      readonly openThreadKey: string | null;
      readonly nowMs: number;
    }): ReadonlyMap<string, SidebarV2StatusBucket> {
      for (const [key, bucket] of input.buckets) {
        if (bucket !== "idle") {
          heldSince.delete(key);
          continue;
        }
        const before = previous?.get(key);
        if (before !== undefined && before !== "idle") heldSince.set(key, input.nowMs);
      }
      for (const key of [input.openThreadKey, previousOpenThreadKey]) {
        if (key !== null && heldSince.has(key)) heldSince.set(key, input.nowMs);
      }
      for (const [key, since] of heldSince) {
        if (input.nowMs - since >= holdMs) heldSince.delete(key);
      }
      previous = input.buckets;
      previousOpenThreadKey = input.openThreadKey;
      const effective = new Map(input.buckets);
      for (const key of heldSince.keys()) {
        if (effective.get(key) === "idle") effective.set(key, "done");
      }
      return effective;
    },
    reset(): void {
      previous = null;
      previousOpenThreadKey = null;
      heldSince.clear();
    },
  };
}

export type SidebarV2CompletedHoldTracker = ReturnType<typeof createSidebarV2CompletedHoldTracker>;

/**
 * Splits threads into the status sections in `SIDEBAR_V2_STATUS_BUCKET_ORDER`,
 * dropping empty sections. Working sorts by send time; others sort by return time.
 */
export function groupSidebarV2StatusSections<TThread extends SidebarV2StatusSectionThread>(input: {
  readonly threads: readonly TThread[];
  readonly bucketOf: (thread: TThread) => SidebarV2StatusBucket;
  readonly returnedAt?: ((thread: TThread) => number | undefined) | undefined;
}): SidebarV2StatusSection<TThread>[] {
  const byBucket = new Map<SidebarV2StatusBucket, TThread[]>();
  for (const thread of input.threads) {
    const bucket = input.bucketOf(thread);
    const existing = byBucket.get(bucket);
    if (existing) existing.push(thread);
    else byBucket.set(bucket, [thread]);
  }
  return SIDEBAR_V2_STATUS_BUCKET_ORDER.flatMap((status) => {
    const threads = byBucket.get(status);
    if (threads === undefined) return [];
    return [
      {
        kind: "status" as const,
        header: null,
        status,
        threads:
          status === "working"
            ? sortWorkingThreadsBySend(threads)
            : sortInboxThreadsByReturn(threads, input.returnedAt),
        threadCount: threads.length,
      },
    ];
  });
}

/**
 * Whether a card's title steps back to quiet ink. Under status grouping, only
 * Needs input and Completed titles stay forward; active/selected never recede.
 */
export function threadCardTitleRecedes(input: {
  readonly isDone: boolean;
  readonly isIdle: boolean;
  readonly isActive: boolean;
  readonly isSelected: boolean;
  readonly statusSection?: SidebarV2StatusBucket | undefined;
}): boolean {
  if (input.isActive || input.isSelected) return false;
  if (input.statusSection !== undefined) {
    return input.statusSection !== "input" && input.statusSection !== "done";
  }
  return input.isDone || input.isIdle;
}

/** Partitions roster threads into snoozed, settled, pinned, and active (matching web precedence). */
export function partitionForkStatusShelves<
  TThread extends Pick<
    EnvironmentThreadShell,
    | "environmentId"
    | "id"
    | "pinnedAt"
    | "settledOverride"
    | "snoozedUntil"
    | "hasPendingApprovals"
    | "hasPendingUserInput"
  >,
>(input: {
  readonly threads: readonly TThread[];
  readonly now: string;
  readonly settlementEnvironmentIds?: ReadonlySet<EnvironmentId> | undefined;
  readonly snoozeEnvironmentIds?: ReadonlySet<EnvironmentId> | undefined;
  readonly queuedThreadKeys?: ReadonlySet<string> | undefined;
}): {
  readonly pinned: TThread[];
  readonly active: TThread[];
  readonly snoozed: TThread[];
  readonly settled: TThread[];
} {
  const pinned: TThread[] = [];
  const active: TThread[] = [];
  const snoozed: TThread[] = [];
  const settled: TThread[] = [];
  for (const thread of input.threads) {
    const supportsSettlement = input.settlementEnvironmentIds?.has(thread.environmentId) ?? true;
    const supportsSnooze = input.snoozeEnvironmentIds?.has(thread.environmentId) ?? true;
    if (supportsSnooze && effectiveSnoozed(thread, { now: input.now })) {
      snoozed.push(thread);
      continue;
    }
    const hasQueued = input.queuedThreadKeys?.has(`${thread.environmentId}:${thread.id}`) === true;
    if (supportsSettlement && thread.settledOverride === "settled" && !hasQueued) {
      settled.push(thread);
    } else if (thread.pinnedAt != null) {
      pinned.push(thread);
    } else {
      active.push(thread);
    }
  }
  return { pinned, active, snoozed, settled };
}
