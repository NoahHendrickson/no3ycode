/**
 * What the no3y pills above the composer show — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * One segment per active kind (icon + count), with a needs-you flag the pill draws as an amber dot.
 */
import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";
import type { No3yPillStatus } from "./no3yPillStatus";

type No3yCountedSegmentKind =
  | "processes"
  | "monitors"
  | "subagents"
  /** Two or more kinds of live background work, as one pill. */
  | "backgroundGroup"
  | "queue"
  | "devices"
  | "browser";

export type No3yStatusSegment =
  | { readonly kind: "status"; readonly status: No3yPillStatus; readonly needsYou: boolean }
  | { readonly kind: "pullRequest" }
  | { readonly kind: "extension" }
  | {
      readonly kind: No3yCountedSegmentKind;
      readonly count: number;
      readonly needsYou: boolean;
      /** Drawn dimmer: finished subagents that stay reachable. */
      readonly quiet: boolean;
    };

export interface No3yStatusPillInput {
  readonly status: No3yPillStatus | null;
  /** The thread's pull request draws a pill. */
  readonly pullRequest: boolean;
  /** The thread's pending background task kinds. */
  readonly backgroundKinds: ReadonlyArray<string>;
  readonly subagents: { readonly live: number; readonly total: number } | null;
  readonly childInputCount: number;
  readonly extension: boolean;
  readonly queuedCount: number;
  readonly deviceCount: number;
  readonly browserCount: number;
}

/**
 * Statuses the pill never shows as a status segment: the item segments carry background work,
 * child input and extensions, and the transcript's live status line already says the turn is
 * working and for how long (stop is the composer's button).
 */
const FOLDED_STATUS_KINDS: ReadonlySet<No3yPillStatus["kind"]> = new Set([
  "background",
  "child-input",
  "extension",
  "working",
]);

export function statusNeedsYou(status: No3yPillStatus): boolean {
  return (
    (status.kind === "connection" && status.tone === "unavailable") ||
    (status.kind === "stop" && status.unresponsive)
  );
}

/**
 * The pills in order: status, pull request, background work, Pi status, queue, previews. Two or
 * more kinds of live background work share one group pill; finished subagents and child requests
 * stay on their own subagents pill, since nothing of theirs is running.
 */
export function no3yStatusSegments(input: No3yStatusPillInput): ReadonlyArray<No3yStatusSegment> {
  const segments: No3yStatusSegment[] = [];
  const push = (kind: No3yCountedSegmentKind, count: number, needsYou = false, quiet = false) =>
    segments.push({ kind, count, needsYou, quiet });
  const { status } = input;
  if (status !== null && !FOLDED_STATUS_KINDS.has(status.kind)) {
    segments.push({ kind: "status", status, needsYou: statusNeedsYou(status) });
  }
  if (input.pullRequest) segments.push({ kind: "pullRequest" });
  const count = (kinds: ReadonlyArray<string>) =>
    input.backgroundKinds.filter((kind) => kinds.includes(kind)).length;
  const processes = count(["command", "background_task"]);
  const monitors = count(["monitor"]);
  const backgroundSubagents = count(["subagent"]);
  const roster = input.subagents !== null && input.subagents.total > 0 ? input.subagents : null;
  const liveSubagents = roster === null ? backgroundSubagents : roster.live;
  const needsInput = input.childInputCount > 0;
  const grouped = [processes, monitors, liveSubagents].filter((live) => live > 0).length >= 2;
  if (grouped) {
    push("backgroundGroup", processes + monitors + liveSubagents, liveSubagents > 0 && needsInput);
  } else {
    if (processes > 0) push("processes", processes);
    if (monitors > 0) push("monitors", monitors);
  }
  if (!(grouped && liveSubagents > 0)) {
    if (roster !== null) {
      const { live, total } = roster;
      push("subagents", live > 0 ? live : total, needsInput, live === 0 && !needsInput);
    } else if (backgroundSubagents > 0 || needsInput) {
      push("subagents", Math.max(backgroundSubagents, input.childInputCount), needsInput);
    }
  }
  if (input.extension || status?.kind === "extension") segments.push({ kind: "extension" });
  if (input.queuedCount > 0) push("queue", input.queuedCount);
  if (input.deviceCount > 0) push("devices", input.deviceCount);
  if (input.browserCount > 0) push("browser", input.browserCount);
  return segments;
}

/** A subagent's status as the Threads list's status mark, so both read the same way. */
export function no3ySubagentMarkKind(
  status: string,
  needs: "approval" | "input" | null = null,
): SidebarV2CardStatusKind | null {
  if (needs !== null) return needs;
  switch (status) {
    case "pending":
    case "running":
      return "working";
    case "waiting":
      return "waiting";
    case "completed":
      return "done";
    case "failed":
      return "failed";
    default:
      return null;
  }
}

/** Time since `startedAt`, short enough for the pill: "42s", "7m", "1h 5m". */
export function no3yElapsedLabel(startedAt: string, nowMs: number): string {
  const startedAtMs = Date.parse(startedAt);
  const seconds =
    Number.isFinite(startedAtMs) && nowMs > startedAtMs
      ? Math.floor((nowMs - startedAtMs) / 1_000)
      : 0;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
