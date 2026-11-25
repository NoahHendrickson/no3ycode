/**
 * Fork-owned — see `.fork/customizations.yaml#no3y-live-activity`. The one lock-screen card both
 * the Mac push service (which pushes it) and the app (which starts it) agree on. Pure: the service
 * imports it under plain Node, so no React Native imports here.
 */
import type { AgentAwarenessPhase, AgentAwarenessState } from "@t3tools/shared/agentAwareness";

/** ActivityKit content-state `name`; the app's factory stores its layout under it. */
export const NO3Y_LIVE_ACTIVITY_NAME = "No3yAgentActivity";
/** Three rows and the header fit the lock screen's 160pt limit; past that, two rows and tiles. */
export const NO3Y_LIVE_ACTIVITY_MAX_ROWS = 3;
const OVERFLOW_ROWS = 2;
/** Finished rows stay on the card this long, as the relay keeps them. */
export const NO3Y_LIVE_ACTIVITY_TERMINAL_TTL_MS = 15 * 60 * 1_000;
/** The card greys out in-flight rows past this unless the Mac re-pushes (it does every 4 min). */
export const NO3Y_LIVE_ACTIVITY_STALE_MS = 10 * 60 * 1_000;

export interface No3yLiveActivityRow {
  readonly environmentId: string;
  readonly threadId: string;
  readonly threadTitle: string;
  readonly projectTitle: string;
  /** The thread's provider instance id (`claudeAgent`, `codex`, …), for its mark. */
  readonly provider: string;
  readonly phase: AgentAwarenessPhase;
  readonly updatedAt: string;
  readonly deepLink: string;
}

/** Threads not shown as rows, by status; the widget draws one tile per entry. */
export interface No3yLiveActivityTile {
  /** `waiting_for_approval` stands for both waits, `running` for starting and running. */
  readonly phase: "waiting_for_approval" | "running" | "failed" | "completed";
  readonly count: number;
}

export interface No3yLiveActivityProps {
  /** Threads still starting, running or waiting; 0 means every one has finished. */
  readonly activeCount: number;
  /** Counts over every thread, not just the rows shown, so the header covers the overflow. */
  readonly waitingCount: number;
  readonly failedCount: number;
  readonly doneCount: number;
  readonly updatedAt: string;
  readonly rows: ReadonlyArray<No3yLiveActivityRow>;
  readonly tiles: ReadonlyArray<No3yLiveActivityTile>;
}

export interface No3yLiveActivityInput {
  readonly state: AgentAwarenessState;
  readonly provider: string;
}

/** Keeps three rows well inside ActivityKit's 4 KB push payload, whatever the titles are. */
const MAX_TITLE_CHARS = 80;

function clip(text: string) {
  // Control characters and lone surrogates escape to six bytes, twice over in the pushed payload.
  const chars = [...text.replace(/[\p{Cc}\p{Cs}]/gu, " ")];
  return chars.length > MAX_TITLE_CHARS
    ? `${chars.slice(0, MAX_TITLE_CHARS - 1).join("")}…`
    : chars.join("");
}

function isTerminal(phase: AgentAwarenessPhase) {
  return phase === "completed" || phase === "failed";
}

export function isNo3yWaitingPhase(phase: AgentAwarenessPhase) {
  return phase === "waiting_for_approval" || phase === "waiting_for_input";
}

function tilePhase(phase: AgentAwarenessPhase): No3yLiveActivityTile["phase"] {
  if (isNo3yWaitingPhase(phase)) return "waiting_for_approval";
  if (phase === "failed" || phase === "completed") return phase;
  return "running";
}

const TILE_ORDER: ReadonlyArray<No3yLiveActivityTile["phase"]> = [
  "waiting_for_approval",
  "running",
  "failed",
  "completed",
];

function phaseRank(phase: AgentAwarenessPhase) {
  if (isNo3yWaitingPhase(phase)) return 0;
  if (phase === "failed") return 1;
  if (phase === "starting" || phase === "running") return 2;
  return 3;
}

/** Waiting rows first, then failures, then running work, then what finished most recently. */
export function aggregateNo3yLiveActivity(
  inputs: Iterable<No3yLiveActivityInput>,
  nowMs: number,
): No3yLiveActivityProps | null {
  const rows: No3yLiveActivityRow[] = [];
  for (const { state, provider } of inputs) {
    if (state.phase === "stale") continue;
    if (
      isTerminal(state.phase) &&
      nowMs - Date.parse(state.updatedAt) > NO3Y_LIVE_ACTIVITY_TERMINAL_TTL_MS
    ) {
      continue;
    }
    rows.push({
      environmentId: state.environmentId,
      threadId: state.threadId,
      threadTitle: clip(state.threadTitle),
      projectTitle: clip(state.projectTitle),
      provider,
      phase: state.phase,
      updatedAt: state.updatedAt,
      deepLink: state.deepLink,
    });
  }
  if (rows.length === 0) return null;
  rows.sort(
    (a, b) => phaseRank(a.phase) - phaseRank(b.phase) || b.updatedAt.localeCompare(a.updatedAt),
  );
  const count = (test: (phase: AgentAwarenessPhase) => boolean) =>
    rows.filter((row) => test(row.phase)).length;
  const updatedAt = rows.reduce(
    (latest, row) => (row.updatedAt > latest ? row.updatedAt : latest),
    rows[0]!.updatedAt,
  );
  const shown = rows.length > NO3Y_LIVE_ACTIVITY_MAX_ROWS ? OVERFLOW_ROWS : rows.length;
  const rest = rows.slice(shown);
  return {
    activeCount: count((phase) => !isTerminal(phase)),
    waitingCount: count(isNo3yWaitingPhase),
    failedCount: count((phase) => phase === "failed"),
    doneCount: count((phase) => phase === "completed"),
    updatedAt,
    rows: rows.slice(0, shown),
    tiles: TILE_ORDER.map((phase) => ({
      phase,
      count: rest.filter((row) => tilePhase(row.phase) === phase).length,
    })).filter((tile) => tile.count > 0),
  };
}

/** The card a send starts before the Mac has seen the run: one starting row, no thread yet. */
export function startingNo3yLiveActivity(
  input: { readonly threadTitle: string; readonly projectTitle: string },
  nowIso: string,
): No3yLiveActivityProps {
  return {
    activeCount: 1,
    waitingCount: 0,
    failedCount: 0,
    doneCount: 0,
    updatedAt: nowIso,
    rows: [
      {
        environmentId: "",
        threadId: "",
        threadTitle: clip(input.threadTitle),
        projectTitle: clip(input.projectTitle),
        // No thread yet, so no provider mark.
        provider: "",
        phase: "starting",
        updatedAt: nowIso,
        deepLink: "/",
      },
    ],
    tiles: [],
  };
}

/** What the card shows, without timestamps: shell updates bump `updatedAt` on every event. */
export function no3yLiveActivitySignature(props: No3yLiveActivityProps | null): string {
  if (props === null) return "";
  return JSON.stringify([
    props.activeCount,
    props.waitingCount,
    props.failedCount,
    props.doneCount,
    props.rows.map((row) => [
      row.threadId,
      row.threadTitle,
      row.projectTitle,
      row.provider,
      row.phase,
    ]),
    props.tiles.map((tile) => [tile.phase, tile.count]),
  ]);
}
