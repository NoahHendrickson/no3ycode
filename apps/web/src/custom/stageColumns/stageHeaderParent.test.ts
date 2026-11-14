import { ThreadId } from "@t3tools/contracts";
import { FORK_BOT_WORK_TAG_PREFIX } from "@t3tools/shared/forkBotTags";
import { describe, expect, it } from "vite-plus/test";

import { makeThreadFixture } from "../../test-fixtures";
import type { Thread } from "../../types";
import { threadParentOf } from "../bots/botWorkRoster";

function thread(
  tags: ReadonlyArray<string>,
  parent: { readonly id: string; readonly relationship: "subagent" | "fork" } | null = null,
): Thread {
  const fixture = makeThreadFixture({
    id: "open" as Thread["id"],
    ...(parent === null
      ? {}
      : {
          lineage: {
            rootThreadId: ThreadId.make(parent.id),
            parentThreadId: ThreadId.make(parent.id),
            relationshipToParent: parent.relationship,
          },
        }),
  });
  return { ...fixture, source: { ...fixture.source, tags } };
}

describe("threadParentOf", () => {
  it.each([
    [
      "a bot's work leads to its bot",
      thread([`${FORK_BOT_WORK_TAG_PREFIX}ops-bot`]),
      "ops-bot",
      "bot",
    ],
    [
      "a subagent leads to the thread that spawned it",
      thread([], { id: "spawner", relationship: "subagent" }),
      "spawner",
      "subagent",
    ],
    [
      "a subagent of a bot's work leads to its own parent first",
      thread([`${FORK_BOT_WORK_TAG_PREFIX}ops-bot`], { id: "spawner", relationship: "subagent" }),
      "spawner",
      "subagent",
    ],
  ] as const)("%s", (_name, open, threadId, kind) => {
    expect(threadParentOf(open)).toEqual({ threadId, kind });
  });

  it("gives any other thread no parent to go back to", () => {
    expect(threadParentOf(thread([]))).toBeNull();
    // A fork is a thread of its own, not a child to go back from.
    expect(threadParentOf(thread([], { id: "original", relationship: "fork" }))).toBeNull();
  });
});
