// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-inline-turn-diff`.
 *
 * A finished turn's diff stat rides its "Worked for" row, and the reply below drops its
 * changed-files card. A turn with no fold row keeps the card.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { deriveMessagesTimelineRows } from "../components/chat/MessagesTimeline.logic";

type Input = Parameters<typeof deriveMessagesTimelineRows>[0];
type Rows = ReturnType<typeof deriveMessagesTimelineRows>;

const at = (second: number) => `2026-01-01T00:00:${String(second).padStart(2, "0")}Z`;
const message = (id: string, role: "user" | "assistant", second: number) => ({
  id: `${id}-entry`,
  kind: "message" as const,
  createdAt: at(second),
  message: {
    id: id as never,
    role,
    text: id,
    runId: "turn-1" as never,
    createdAt: at(second),
    updatedAt: at(second),
    streaming: false,
  },
});
const work = {
  id: "work-entry",
  kind: "work" as const,
  createdAt: at(8),
  entry: {
    id: "work-1",
    createdAt: at(8),
    runId: "turn-1" as never,
    label: "work-1",
    tone: "tool" as const,
  },
};
const summary = {
  runId: "turn-1" as never,
  completedAt: at(30),
  assistantMessageId: "assistant-1" as never,
  checkpointTurnCount: 1,
  checkpointRef: "checkpoint-1" as never,
  status: "ready" as const,
  files: [{ path: "src/index.ts", kind: "modified", additions: 3, deletions: 1 }],
};

function derive(timelineEntries: Input["timelineEntries"]): Rows {
  return deriveMessagesTimelineRows({
    timelineEntries,
    isWorking: false,
    activeTurnStartedAt: null,
    turnDiffSummaries: [summary],
    supportsConversationRollback: false,
  });
}
const reply = (rows: Rows) =>
  rows.find(
    (row): row is Extract<Rows[number], { kind: "message" }> =>
      row.kind === "message" && row.message.role === "assistant",
  );

describe("fork-inline-turn-diff", () => {
  it("moves the turn's diff from the reply onto its Worked for row", () => {
    const rows = derive([
      message("user-1", "user", 0),
      work,
      message("assistant-1", "assistant", 20),
    ]);
    const fold = rows.find((row) => row.kind === "turn-fold");
    expect(fold).toMatchObject({ kind: "turn-fold", turnDiffSummary: summary });
    expect(reply(rows)?.assistantTurnDiffSummary).toBeUndefined();
  });

  it("keeps the card on a reply whose turn has no fold row", () => {
    const rows = derive([message("user-1", "user", 0), message("assistant-1", "assistant", 20)]);
    expect(rows.some((row) => row.kind === "turn-fold")).toBe(false);
    expect(reply(rows)?.assistantTurnDiffSummary).toBe(summary);
  });

  it("renders the stat on the fold row", () => {
    const timeline = NodeFS.readFileSync(
      NodeURL.fileURLToPath(new URL("../components/chat/MessagesTimeline.tsx", import.meta.url)),
      "utf8",
    );
    const foldRow = /function TurnFoldTimelineRow\([\s\S]*?\n\}/u.exec(timeline)?.[0];
    expect(foldRow).toMatch(/<ForkTurnDiffStat summary=\{row\.turnDiffSummary\}/u);
  });
});
