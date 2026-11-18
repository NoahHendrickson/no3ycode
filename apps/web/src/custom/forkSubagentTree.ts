/**
 * Pure model for the transcript's subagent spawn tree — see
 * `.fork/customizations.yaml#fork-subagent-spawn-card`.
 *
 * Takes the projected subagent items of one spawn batch plus the thread's
 * live subagent roster (upstream's projection keeps status, progress, result,
 * model and timing current there) and returns what the tree paints: the lead
 * line, the status summary, the batch's elapsed span, and one row per member
 * with the sidebar's status vocabulary. Lead, summary and the
 * progress-or-result preference are upstream's shared helpers; what is the
 * fork's own here is the mark vocabulary, the one-line markdown strip and the
 * model spelling. Kept out of the component so the rules are testable without
 * rendering.
 */
import type {
  OrchestrationV2RemoteTaskChild,
  OrchestrationV2Subagent,
  OrchestrationV2TurnItem,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import {
  formatSubagentDisplayTitle,
  subagentGroupSummary,
  summarizeSubagentStatuses,
} from "@t3tools/client-runtime/state/subagent-display";
import { formatModelSlugName } from "@t3tools/shared/model";
import * as DateTime from "effect/DateTime";

export type ForkSubagentItem = Extract<OrchestrationV2TurnItem, { readonly type: "subagent" }>;
export type ForkSubagentStatus = OrchestrationV2TurnItem["status"];
export type ForkSubagentMark = "working" | "idle" | "done" | "failed" | "stopped";

export interface ForkSubagentTreeRow {
  readonly id: string;
  readonly title: string;
  readonly status: ForkSubagentStatus;
  readonly mark: ForkSubagentMark;
  readonly failed: boolean;
  readonly model: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly childThreadId: ThreadId | null;
  /** A thread in a linked environment that runs this task, when it runs there. */
  readonly remote: OrchestrationV2RemoteTaskChild | undefined;
  readonly driver: ProviderDriverKind;
  readonly providerInstanceId: ProviderInstanceId;
  /** Still working: the card's well starts open. */
  readonly active: boolean;
  /** The card's status line: "Running", "Completed", "Stopped". */
  readonly statusLabel: string;
  /** The task it was given, as one plain paragraph; null when the server withheld it. */
  readonly prompt: string | null;
  /** What it is doing now while it works, its result once settled; null when it has said nothing. */
  readonly activity: { readonly label: "Now" | "Result"; readonly text: string } | null;
}

/** The batch's one elapsed span, in the shape `AgentElapsed` ticks. */
export interface ForkSubagentTiming {
  readonly status: "running" | "completed";
  readonly startedAt: string;
  readonly completedAt: string | null;
}

export interface ForkSubagentTree {
  /** "Kicked off N subagents" while any member works, "Ran N subagents" after. */
  readonly lead: string;
  /** "2 working · 1 done", in the agents panel's words. */
  readonly summary: string;
  readonly active: boolean;
  /**
   * First launch to last settle, ticking while the batch is active — upstream's
   * group rule: null when no member reports a start time (provider-native
   * subagents often carry none), and the end withheld rather than cut short
   * while a settled member has no completion time.
   */
  readonly timing: ForkSubagentTiming | null;
  readonly rows: ReadonlyArray<ForkSubagentTreeRow>;
}

const STATUS_MARK: Record<ForkSubagentStatus, ForkSubagentMark> = {
  pending: "working",
  running: "working",
  waiting: "working",
  idle: "idle",
  completed: "done",
  failed: "failed",
  cancelled: "stopped",
  interrupted: "stopped",
};

const CARD_STATUS_WORD: Record<ForkSubagentStatus, string> = {
  pending: "Queued",
  running: "Running",
  waiting: "Waiting",
  idle: "Idle",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Stopped",
  interrupted: "Stopped",
};

/** The server's placeholder when a child ends without output; the mark already says it. */
const GENERIC_CHILD_END = /^Child task ended with status\b/iu;

/** One line of a markdown result: drop list bullets, code ticks, and link targets. */
function plainDetail(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/`/gu, "")
    .replace(/^[ \t]*[-*][ \t]+/gmu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * A model id the way the Figma tree spells it: upstream's shared spelling
 * (`formatModelSlugName`) with the vendor word dropped and a dated snapshot's
 * date left off, so `claude-opus-5-5` reads "Opus 5.5" and the
 * `claude-sonnet-4-5-20250929` a Claude subagent reports reads "Sonnet 4.5".
 * Null when nothing was reported.
 */
export function formatForkSubagentModel(model: string | null): string | null {
  const slug = model?.trim();
  if (!slug) return null;
  return (
    formatModelSlugName(slug)
      .replace(/^claude\s+/iu, "")
      .replace(/\s+\d{8}(?=\[|$)/u, "")
      .trim() || null
  );
}

/** The card's well: live progress while working, the result once settled, whole rather than
    one line, and nothing when neither says more than the status line. */
function resolveActivity(input: {
  readonly active: boolean;
  readonly progress: string | undefined;
  readonly result: string | null;
}): ForkSubagentTreeRow["activity"] {
  const raw = (
    input.active ? input.progress || input.result : input.result || input.progress
  )?.trim();
  if (!raw || GENERIC_CHILD_END.test(raw)) return null;
  const text = plainDetail(raw);
  if (!text) return null;
  return { label: input.active ? "Now" : "Result", text };
}

function isoOrNull(value: DateTime.Utc | null | undefined): string | null {
  return value ? DateTime.formatIso(value) : null;
}

export function resolveForkSubagentTree(
  members: ReadonlyArray<ForkSubagentItem>,
  liveAgents: ReadonlyArray<OrchestrationV2Subagent> | null | undefined,
): ForkSubagentTree {
  const rows: ForkSubagentTreeRow[] = [];
  let startMs: number | null = null;
  let endMs: number | null = null;
  let endUnknown = false;
  for (const item of members) {
    const live = liveAgents?.find((agent) => agent.id === item.subagentId);
    const status = live?.status ?? item.status;
    const startedAt = live?.startedAt ?? item.startedAt;
    const completedAt = live?.completedAt ?? item.completedAt;
    if (startedAt) {
      const ms = DateTime.toEpochMillis(startedAt);
      startMs = startMs === null ? ms : Math.min(startMs, ms);
    }
    if (completedAt) {
      const ms = DateTime.toEpochMillis(completedAt);
      endMs = endMs === null ? ms : Math.max(endMs, ms);
    } else {
      endUnknown = true;
    }
    const progress = live?.progress ?? item.progress;
    const result = live?.result ?? item.result;
    const active = STATUS_MARK[status] === "working";
    const prompt = plainDetail(live?.prompt ?? item.prompt);
    rows.push({
      id: item.id,
      title: formatSubagentDisplayTitle(live?.title ?? item.title ?? "Subagent"),
      status,
      mark: STATUS_MARK[status],
      failed: status === "failed",
      model: live?.model ?? null,
      startedAt: isoOrNull(startedAt),
      completedAt: isoOrNull(completedAt),
      childThreadId: live?.childThreadId ?? item.childThreadId,
      remote: item.remoteChild ?? live?.remoteChild,
      driver: item.driver,
      providerInstanceId: item.providerInstanceId,
      active,
      statusLabel: CARD_STATUS_WORD[status],
      prompt: prompt || null,
      activity: resolveActivity({ active, progress, result }),
    });
  }
  const group = subagentGroupSummary(rows);
  return {
    lead: group.label,
    summary: summarizeSubagentStatuses(rows.map((row) => row.status)),
    active: group.active,
    timing:
      startMs === null
        ? null
        : {
            status: group.active ? "running" : "completed",
            startedAt: new Date(startMs).toISOString(),
            completedAt:
              group.active || endUnknown || endMs === null ? null : new Date(endMs).toISOString(),
          },
    rows,
  };
}
