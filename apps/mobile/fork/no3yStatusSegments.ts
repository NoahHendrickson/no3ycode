/**
 * What the no3y thread status pill shows — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * One segment per active kind (icon + count), with a needs-you flag the pill draws as an amber dot.
 */
import type { FloatingWorkingStatus } from "../src/features/threads/floating-working-status";
import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";

export type No3yStatusSegmentKind =
  | "status"
  | "processes"
  | "monitors"
  | "subagents"
  | "extension"
  | "queue"
  | "devices"
  | "browser";

export interface No3yStatusSegment {
  readonly kind: No3yStatusSegmentKind;
  readonly count: number | null;
  readonly needsYou: boolean;
  /** Drawn dimmer: finished subagents that stay reachable. */
  readonly quiet: boolean;
}

export interface No3yStatusPillInput {
  readonly status: FloatingWorkingStatus | null;
  /** The thread's pending background task kinds. */
  readonly backgroundKinds: ReadonlyArray<string>;
  readonly subagents: { readonly live: number; readonly total: number } | null;
  readonly childInputCount: number;
  readonly extension: boolean;
  readonly queuedCount: number;
  readonly deviceCount: number;
  readonly browserCount: number;
}

/** Statuses the item segments already carry, so they never get a status segment of their own. */
const FOLDED_STATUS_KINDS: ReadonlySet<FloatingWorkingStatus["kind"]> = new Set([
  "background",
  "child-input",
  "extension",
]);

export function statusNeedsYou(status: FloatingWorkingStatus): boolean {
  return (
    (status.kind === "connection" && status.tone === "unavailable") ||
    (status.kind === "stop" && status.unresponsive)
  );
}

export function no3yStatusSegments(input: No3yStatusPillInput): ReadonlyArray<No3yStatusSegment> {
  const segments: No3yStatusSegment[] = [];
  const push = (
    kind: No3yStatusSegmentKind,
    count: number | null,
    needsYou = false,
    quiet = false,
  ) => segments.push({ kind, count, needsYou, quiet });
  const { status } = input;
  if (status !== null && !FOLDED_STATUS_KINDS.has(status.kind)) {
    push("status", null, statusNeedsYou(status));
  }
  const count = (kinds: ReadonlyArray<string>) =>
    input.backgroundKinds.filter((kind) => kinds.includes(kind)).length;
  const processes = count(["command", "background_task"]);
  const monitors = count(["monitor"]);
  const backgroundSubagents = count(["subagent"]);
  if (processes > 0) push("processes", processes);
  if (monitors > 0) push("monitors", monitors);
  const needsInput = input.childInputCount > 0;
  if (input.subagents !== null && input.subagents.total > 0) {
    const { live, total } = input.subagents;
    push("subagents", live > 0 ? live : total, needsInput, live === 0 && !needsInput);
  } else if (backgroundSubagents > 0 || needsInput) {
    push("subagents", Math.max(backgroundSubagents, input.childInputCount), needsInput);
  }
  if (input.extension || status?.kind === "extension") push("extension", null);
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
