/** Fork-owned — see `.fork/customizations.yaml#fork-bots`. */
import type { MessageId, RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { deriveMessagesTimelineRows } from "~/components/chat/MessagesTimeline.logic";
import type { TimelineAttempt, TimelineEntry } from "~/session-logic";
import type { ChatMessage, TurnDiffSummary } from "~/types";

const at = (minute: number) => `2026-11-16T14:${String(minute).padStart(2, "0")}:00.000Z`;

function message(
  runId: string,
  minute: number,
  fields: Pick<ChatMessage, "role" | "text"> & Partial<ChatMessage>,
  attempt?: TimelineAttempt["status"],
): TimelineEntry {
  const id = `${runId}:${fields.role}:${minute}`;
  return {
    id,
    kind: "message",
    createdAt: at(minute),
    message: {
      id: id as MessageId,
      runId: runId as RunId,
      createdAt: at(minute),
      updatedAt: at(minute),
      streaming: false,
      ...(fields.role === "user" ? { inputIntent: "turn_start" as const } : {}),
      ...fields,
    },
    ...(attempt === undefined
      ? {}
      : {
          attempt: {
            id: `${runId}:attempt` as TimelineAttempt["id"],
            runId: runId as RunId,
            attemptOrdinal: 1,
            rootNodeId: `${runId}:node` as TimelineAttempt["rootNodeId"],
            status: attempt,
            completedAt: null,
          },
        }),
  };
}

const owner = (runId: string, minute: number, text: string) =>
  message(runId, minute, { role: "user", text, createdBy: "user" });
const wake = (runId: string, minute: number) =>
  message(runId, minute, { role: "user", text: "Scheduled wake: check", createdBy: "agent" });
const reply = (
  runId: string,
  minute: number,
  text: string,
  attempt: TimelineAttempt["status"] = "completed",
) => message(runId, minute, { role: "assistant", text }, attempt);

const checkpoint = (runId: string, turnCount: number): TurnDiffSummary => ({
  runId: runId as RunId,
  completedAt: at(turnCount),
  assistantMessageId: null,
  checkpointTurnCount: turnCount,
  checkpointRef: `checkpoint-${turnCount}` as TurnDiffSummary["checkpointRef"],
  status: "missing",
  files: [],
});

function rowsFor(timelineEntries: ReadonlyArray<TimelineEntry>, extra = {}) {
  return deriveMessagesTimelineRows({
    timelineEntries,
    isWorking: false,
    activeTurnStartedAt: null,
    turnDiffSummaries: [checkpoint("a", 1), checkpoint("wake-1", 2), checkpoint("b", 3)],
    supportsConversationRollback: true,
    threadStartCheckpointAvailable: true,
    hideQuietBotWakes: true,
    ...extra,
  });
}

const messageTexts = (rows: ReturnType<typeof rowsFor>) =>
  rows.flatMap((row) => (row.kind === "message" ? [row.message.text] : []));

describe("quiet bot wakes", () => {
  it("hides a wake that found nothing, and rewinding past it still lands right after it", () => {
    const entries = [
      owner("a", 1, "Watch the repo"),
      reply("a", 2, "On it."),
      wake("wake-1", 3),
      reply("wake-1", 4, "Nothing to report."),
      owner("b", 5, "Anything new?"),
      reply("b", 6, "No."),
    ];
    const rows = rowsFor(entries);
    expect(messageTexts(rows)).toEqual(["Watch the repo", "On it.", "Anything new?", "No."]);
    const rewindB = rows.find(
      (row) => row.kind === "message" && row.message.text === "Anything new?",
    );
    expect(rewindB?.kind === "message" ? rewindB.revertTurnCount : null).toBe(2);
    // Off (not a bot, or find open): every run shows.
    expect(messageTexts(rowsFor(entries, { hideQuietBotWakes: false }))).toHaveLength(6);
  });

  it("keeps a wake that is still running, failed, or that the owner typed into", () => {
    const running = [wake("wake-1", 3), reply("wake-1", 4, "Nothing to report.")];
    expect(messageTexts(rowsFor(running, { runningRunId: "wake-1" }))).toHaveLength(2);

    const failed = [wake("wake-1", 3), reply("wake-1", 4, "Nothing to report.", "failed")];
    expect(messageTexts(rowsFor(failed))).toHaveLength(2);

    const steered = [
      wake("wake-1", 3),
      owner("wake-1", 4, "Also check the issues"),
      reply("wake-1", 5, "nothing to report"),
    ];
    expect(messageTexts(rowsFor(steered))).toHaveLength(3);

    const asked = [owner("b", 5, "Anything new?"), reply("b", 6, "Nothing to report.")];
    expect(messageTexts(rowsFor(asked))).toHaveLength(2);
  });
});
