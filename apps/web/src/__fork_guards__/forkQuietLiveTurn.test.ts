// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-quiet-live-turn`.
 *
 * Outside Zen, a running turn's replies stay out of the transcript until it
 * ends, and the status line reads Zen's preview of them. A sync that takes
 * upstream's MessagesTimeline compiles clean and streams every reply again.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { deriveMessagesTimelineRows } from "../components/chat/MessagesTimeline.logic";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const at = (second: number) => `2026-01-01T00:00:${String(second).padStart(2, "0")}Z`;
type Entries = Parameters<typeof deriveMessagesTimelineRows>[0]["timelineEntries"];
const message = (
  id: string,
  role: "user" | "assistant",
  second: number,
  options: { runId?: string; steer?: boolean; finalAnswer?: boolean } = {},
) => ({
  id,
  kind: "message" as const,
  createdAt: at(second),
  message: {
    id: id as never,
    role,
    text: id,
    runId: (role === "user" ? null : (options.runId ?? "turn-1")) as never,
    createdAt: at(second),
    updatedAt: at(second),
    streaming: false,
    ...(options.steer ? { inputIntent: "steer" as const } : {}),
  },
  ...(options.finalAnswer
    ? { projectedItem: { item: { type: "assistant_message", phase: "final_answer" } } as never }
    : {}),
});

describe("fork guard: fork-quiet-live-turn", () => {
  it("holds exactly the replies Zen holds while a turn runs", () => {
    const entries = [
      message("ask-0", "user", 0),
      message("earlier", "assistant", 1, { runId: "turn-0" }),
      message("ask-1", "user", 2),
      message("step", "assistant", 3),
      message("steer", "user", 4, { steer: true }),
      message("steer-answer", "assistant", 5),
      message("final", "assistant", 6, { finalAnswer: true }),
      message("revealed", "assistant", 7),
      message("tail", "assistant", 8),
    ] as unknown as Entries;
    const visible = (zen: boolean) =>
      deriveMessagesTimelineRows({
        timelineEntries: entries,
        latestRun: {
          runId: "turn-1" as never,
          status: "running",
          startedAt: at(2),
          completedAt: null,
        },
        isWorking: true,
        activeTurnStartedAt: at(2),
        turnDiffSummaries: [],
        supportsConversationRollback: false,
        revealedMessageId: "revealed" as never,
        ...(zen ? { toolCallVisibility: "zen" as const } : { forkHoldLiveReplies: true }),
      }).flatMap((row) =>
        row.kind === "message" && row.message.role === "assistant" ? [row.message.id] : [],
      );
    expect(visible(false)).toEqual(visible(true));
    expect(visible(false)).toEqual(["earlier", "steer-answer", "final", "revealed"]);
  });

  it("asks from the transcript, except while Find is open", () => {
    expect(readSibling("../components/chat/MessagesTimeline.tsx")).toContain(
      "forkHoldLiveReplies: !findActive,",
    );
  });

  it("reads the live preview in every mode, not only Zen", () => {
    expect(readSibling("../components/chat/MessagesTimeline.tsx")).toContain(
      "liveAnswerPreview: isWorking ? liveAnswerPreview(timelineEntries) : null,",
    );
  });
});
