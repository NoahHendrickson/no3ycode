/**
 * Fork-owned — see `.fork/customizations.yaml#no3y-live-activity`. The one lock-screen card both
 * the Mac push service (which pushes it) and the app (which starts it) agree on. Pure: the service
 * imports it under plain Node, so no React Native imports here.
 */
import type { AgentAwarenessPhase, AgentAwarenessState } from "@t3tools/shared/agentAwareness";

/** ActivityKit content-state `name`; the app's factory stores its layout under it. */
export const NO3Y_LIVE_ACTIVITY_NAME = "No3yAgentActivity";
/** Three rows and the header fit the lock screen's 160pt limit. */
export const NO3Y_LIVE_ACTIVITY_MAX_ROWS = 3;
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

export interface No3yLiveActivityProps {
  /** Threads still starting, running or waiting; 0 means every one has finished. */
  readonly activeCount: number;
  /** Counts over every thread, not just the rows shown, so the header covers the overflow. */
  readonly waitingCount: number;
  readonly failedCount: number;
  readonly doneCount: number;
  readonly updatedAt: string;
  readonly rows: ReadonlyArray<No3yLiveActivityRow>;
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

function phaseRank(phase: AgentAwarenessPhase) {
  if (phase === "waiting_for_approval" || phase === "waiting_for_input") return 0;
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
  return {
    activeCount: count((phase) => !isTerminal(phase)),
    waitingCount: count(
      (phase) => phase === "waiting_for_approval" || phase === "waiting_for_input",
    ),
    failedCount: count((phase) => phase === "failed"),
    doneCount: count((phase) => phase === "completed"),
    updatedAt,
    rows: rows.slice(0, NO3Y_LIVE_ACTIVITY_MAX_ROWS),
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
  ]);
}
