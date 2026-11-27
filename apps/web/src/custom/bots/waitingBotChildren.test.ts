import { describe, expect, it } from "vite-plus/test";

import { waitingBotChildren } from "./waitingBotChildren";

const bot = { environmentId: "env-1", id: "bot-1" } as const;

function thread(id: string, fields: Readonly<Record<string, unknown>>) {
  return {
    environmentId: "env-1",
    id,
    archivedAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    pendingUserInputAt: null,
    updatedAt: "2026-11-26T10:00:00.000Z",
    source: { tags: ["bot-work:bot-1"] },
    ...fields,
  } as unknown as Parameters<typeof waitingBotChildren>[0][number];
}

describe("waitingBotChildren", () => {
  it("lists only the bot's own live work that waits on the owner, longest-waiting first", () => {
    const later = thread("later", {
      hasPendingUserInput: true,
      pendingUserInputAt: "2026-11-26T10:05:00.000Z",
    });
    const earlier = thread("earlier", {
      hasPendingUserInput: true,
      pendingUserInputAt: "2026-11-26T10:01:00.000Z",
    });
    const approving = thread("approving", { hasPendingApprovals: true });
    const threads = [
      later,
      earlier,
      approving,
      thread("idle", {}),
      thread("archived", { hasPendingUserInput: true, archivedAt: "2026-11-26T11:00:00.000Z" }),
      thread("other-bot", { hasPendingUserInput: true, source: { tags: ["bot-work:bot-2"] } }),
      thread("subagent", { hasPendingUserInput: true, source: { tags: [] } }),
      thread("elsewhere", { hasPendingUserInput: true, environmentId: "env-2" }),
    ];
    const waiting = waitingBotChildren(threads, bot as never);
    expect(waiting.asking.map((entry) => entry.id)).toEqual(["earlier", "later"]);
    expect(waiting.approving.map((entry) => entry.id)).toEqual(["approving"]);
  });
});
