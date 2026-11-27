import type { BotDigestItem } from "@t3tools/client-runtime/fork-bot-digest";
import { describe, expect, it } from "vite-plus/test";

import { botDigestPageAt, deriveBotDigestStack, waitingBotChildren } from "./botDigestStack";

type Shell = Parameters<typeof waitingBotChildren>[0][number];

const bot = { environmentId: "env-1", id: "bot-1" } as never;

function thread(id: string, fields: Readonly<Record<string, unknown>>): Shell {
  return {
    environmentId: "env-1",
    id,
    archivedAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    pendingUserInputAt: null,
    createdAt: "2026-11-26T09:00:00.000Z",
    updatedAt: "2026-11-26T10:00:00.000Z",
    source: { tags: ["bot-work:bot-1"] },
    ...fields,
  } as unknown as Shell;
}

function ask(source: string): BotDigestItem {
  return { text: source, source, threads: [], pullRequests: [], answers: [] };
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
    // Approvals keep the thread's age, not updatedAt, which moves on any shell change.
    const newApproval = thread("new-approval", {
      hasPendingApprovals: true,
      createdAt: "2026-11-26T09:30:00.000Z",
      updatedAt: "2026-11-26T09:31:00.000Z",
    });
    const oldApproval = thread("old-approval", {
      hasPendingApprovals: true,
      createdAt: "2026-11-26T09:10:00.000Z",
      updatedAt: "2026-11-26T11:00:00.000Z",
    });
    const threads = [
      later,
      earlier,
      newApproval,
      oldApproval,
      thread("idle", {}),
      thread("archived", { hasPendingUserInput: true, archivedAt: "2026-11-26T11:00:00.000Z" }),
      thread("other-bot", { hasPendingUserInput: true, source: { tags: ["bot-work:bot-2"] } }),
      thread("subagent", { hasPendingUserInput: true, source: { tags: [] } }),
      thread("elsewhere", { hasPendingUserInput: true, environmentId: "env-2" }),
    ];
    const waiting = waitingBotChildren(threads, bot);
    expect(waiting.asking.map((entry) => entry.id)).toEqual(["earlier", "later"]);
    expect(waiting.approving.map((entry) => entry.id)).toEqual(["old-approval", "new-approval"]);
  });
});

describe("deriveBotDigestStack", () => {
  it("pages approvals, questions, then open asks, dropping an ask its question card replaces", () => {
    const asking = thread("asking", { hasPendingUserInput: true });
    const approving = thread("approving", { hasPendingApprovals: true });
    const elsewhere = thread("other-bot", {
      hasPendingUserInput: true,
      source: { tags: ["bot-work:bot-2"] },
    });
    const pointsAtAsking = ask("Answer the copy question there?");
    const pointsElsewhere = ask("Answer the other bot's question?");
    const { entries, hiddenCount } = deriveBotDigestStack({
      threads: [asking, approving, elsewhere],
      bot,
      asks: [
        pointsAtAsking,
        pointsElsewhere,
        ask("Merge #137?"),
        ask("Archive the spike?"),
        ask("Done"),
      ],
      answered: new Set(["Done"]),
      dismissed: ["Archive the spike?"],
      questionOf: (item) =>
        item === pointsAtAsking ? asking : item === pointsElsewhere ? elsewhere : undefined,
    });
    expect(entries.map((entry) => entry.key)).toEqual([
      "approval:env-1:approving",
      "question:env-1:asking",
      "ask:Answer the other bot's question?",
      "ask:Merge #137?",
    ]);
    expect(hiddenCount).toBe(1);
  });
});

describe("botDigestPageAt", () => {
  it("keeps the chosen card when one arrives ahead of it, and holds its place once it goes", () => {
    const before = [{ key: "ask:a" }, { key: "ask:b" }, { key: "ask:c" }];
    const page = { key: "ask:b", index: 1 };
    expect(botDigestPageAt(before, page)).toBe(1);
    expect(botDigestPageAt([{ key: "approval:x" }, ...before], page)).toBe(2);
    expect(botDigestPageAt([{ key: "ask:a" }, { key: "ask:c" }], page)).toBe(1);
    expect(botDigestPageAt([{ key: "ask:a" }], page)).toBe(0);
    expect(botDigestPageAt([], { key: null, index: 0 })).toBe(0);
  });
});
