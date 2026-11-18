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
  ModelSelection,
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
  /** Its own title, else the task it was given, else "Subagent". */
  readonly title: string;
  /** Whether the record named it; an untitled card may borrow its child thread's title. */
  readonly titled: boolean;
  readonly status: ForkSubagentStatus;
  /** The sidebar mark: working, idle, done, failed or stopped. */
  readonly mark: ForkSubagentMark;
  readonly model: string | null;
  /** The selection it was launched with, for its reasoning effort. */
  readonly modelSelection: ModelSelection | undefined;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly childThreadId: ThreadId | null;
  /** A thread in a linked environment that runs this task, when it runs there. */
  readonly remote: OrchestrationV2RemoteTaskChild | undefined;
  readonly driver: ProviderDriverKind;
  readonly providerInstanceId: ProviderInstanceId;
  /** The card's status line: "Running", "Completed", "Stopped". */
  readonly statusLabel: string;
  /** The task it was given, as one plain paragraph; null when the server withheld it. */
  readonly prompt: string | null;
  /** What it is doing now while it works, its result once settled; null when it has said nothing. */
  readonly activity: {
    readonly label: "Now" | "Result";
    readonly text: string;
    /** A bare path (no spaces) truncates in the middle, so it keeps its filename. */
    readonly shape: "path" | "prose";
  } | null;
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

/** Each status as the card shows it: the sidebar mark and the word under the title. */
const STATUS_PRESENTATION: Record<
  ForkSubagentStatus,
  { readonly mark: ForkSubagentMark; readonly word: string }
> = {
  pending: { mark: "working", word: "Queued" },
  running: { mark: "working", word: "Running" },
  waiting: { mark: "working", word: "Waiting" },
  idle: { mark: "idle", word: "Idle · resumable" },
  completed: { mark: "done", word: "Completed" },
  failed: { mark: "failed", word: "Failed" },
  cancelled: { mark: "stopped", word: "Stopped" },
  interrupted: { mark: "stopped", word: "Stopped" },
};

/** The server's placeholder when a child ends without output; the mark already says it. */
const GENERIC_CHILD_END = /^Child task ended with status\b/iu;

/** One line of a markdown result: drop heading marks, list bullets, emphasis, code ticks, and
    link targets. Emphasis is only `*` at word edges outside code, so dunders and globs survive. */
function plainDetail(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/^[ \t]*#{1,6}[ \t]+/gmu, "")
    .replace(/^[ \t]*[-*][ \t]+/gmu, "")
    .split(/(`[^`]*`)/u)
    .map((part, index) =>
      index % 2 === 1 ? part : part.replace(EMPHASIS_STRONG, "$1$2").replace(EMPHASIS, "$1$2"),
    )
    .join("")
    .replace(/`/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

const EMPHASIS_STRONG = /(^|[\s(])\*\*(?=\S)(.+?)(?<=\S)\*\*(?=$|[\s).,;:!?])/gu;
const EMPHASIS = /(^|[\s(])\*(?=[^\s*])([^*]+?)(?<=[^\s*])\*(?=$|[\s).,;:!?])/gu;

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

/** The card's well: live progress while it works, its result once settled, whole rather than one
    line. Never one standing in for the other, and nothing when the one that applies says nothing. */
function resolveActivity(input: {
  readonly active: boolean;
  readonly progress: string | undefined;
  readonly result: string | null;
}): ForkSubagentTreeRow["activity"] {
  const raw = (input.active ? input.progress : input.result)?.trim();
  if (!raw || GENERIC_CHILD_END.test(raw)) return null;
  const text = plainDetail(raw);
  if (!text) return null;
  return {
    label: input.active ? "Now" : "Result",
    text,
    shape: text.includes("/") && !text.includes(" ") ? "path" : "prose",
  };
}

function isoOrNull(value: DateTime.Utc | null | undefined): string | null {
  return value ? DateTime.formatIso(value) : null;
}

/** A timeline row's subagent items: its batch, or the row's own item when the batch is empty. */
export function forkSubagentMembers(row: {
  readonly subagents?: ReadonlyArray<{ readonly item: OrchestrationV2TurnItem }> | undefined;
  readonly projectedItem: { readonly item: OrchestrationV2TurnItem };
}): ReadonlyArray<ForkSubagentItem> {
  return (row.subagents?.length ? row.subagents : [row.projectedItem]).flatMap(({ item }) =>
    item.type === "subagent" ? [item] : [],
  );
}

/** What a row is resolved from: a transcript subagent item, or the live record alone (a completion
    notice carries only the agent). */
type ForkSubagentRowSource = { readonly id: string } & Pick<
  ForkSubagentItem,
  | "status"
  | "startedAt"
  | "completedAt"
  | "progress"
  | "result"
  | "prompt"
  | "title"
  | "childThreadId"
  | "remoteChild"
  | "driver"
  | "providerInstanceId"
>;

function resolveRow(
  item: ForkSubagentRowSource,
  live: OrchestrationV2Subagent | undefined,
): ForkSubagentTreeRow {
  const status = live?.status ?? item.status;
  const startedAt = live?.startedAt ?? item.startedAt;
  const completedAt = live?.completedAt ?? item.completedAt;
  const progress = live?.progress ?? item.progress;
  const result = live?.result ?? item.result;
  const { mark, word } = STATUS_PRESENTATION[status];
  // A deduped live record carries prompt: "" (promptOmitted), so an empty one defers to the item.
  const prompt = plainDetail(live?.prompt || item.prompt);
  return {
    id: item.id,
    title: formatSubagentDisplayTitle(live?.title ?? item.title ?? (prompt || "Subagent")),
    titled: (live?.title ?? item.title) != null,
    status,
    mark,
    // Claude can report the model only through its selection.
    model: live?.model ?? live?.modelSelection?.model ?? null,
    modelSelection: live?.modelSelection,
    startedAt: isoOrNull(startedAt),
    completedAt: isoOrNull(completedAt),
    childThreadId: live?.childThreadId ?? item.childThreadId,
    remote: item.remoteChild ?? live?.remoteChild,
    driver: item.driver,
    providerInstanceId: item.providerInstanceId,
    statusLabel: word,
    prompt: prompt || null,
    activity: resolveActivity({ active: mark === "working", progress, result }),
  };
}

/** A subagent's card row from its live record alone, for the completion notice it posts. */
export function forkSubagentRowFromAgent(agent: OrchestrationV2Subagent): ForkSubagentTreeRow {
  // The record is the live side too: the model is read from the live record alone.
  return resolveRow(agent, agent);
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
    rows.push(resolveRow(item, live));
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
