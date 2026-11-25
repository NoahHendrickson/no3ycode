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

const at = (second: number) => `2026-01-01T00:00:0${second}Z`;
const reply = {
  id: "reply-entry",
  kind: "message" as const,
  createdAt: at(2),
  message: {
    id: "reply" as never,
    role: "assistant" as const,
    text: "checking",
    runId: "turn-1" as never,
    createdAt: at(2),
    updatedAt: at(2),
    streaming: false,
  },
};

describe("fork guard: fork-quiet-live-turn", () => {
  it("holds a running turn's replies when the timeline asks", () => {
    const rows = deriveMessagesTimelineRows({
      timelineEntries: [reply],
      latestRun: {
        runId: "turn-1" as never,
        status: "running",
        startedAt: at(0),
        completedAt: null,
      },
      isWorking: true,
      activeTurnStartedAt: at(0),
      turnDiffSummaries: [],
      supportsConversationRollback: false,
      toolCallVisibility: "showAll",
      forkHoldLiveReplies: true,
    });
    expect(rows.some((row) => row.kind === "message")).toBe(false);
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
