/**
 * Fork-owned — see `.fork/customizations.yaml#fork-bot-crew-rules`.
 */
import { assert, it } from "@effect/vitest";
import { ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

import type { ThreadManagementService } from "./ThreadManagementService.ts";
import { makeForkBotCrewRules } from "./forkBotWork.ts";

const botId = ThreadId.make("thread:bot");

function threadsWith(shell: { tags: ReadonlyArray<string>; worktreePath: string | null } | null) {
  return {
    getThreadShell: () =>
      Effect.succeed(shell === null ? null : { title: "Scout", id: botId, ...shell }),
  } as unknown as ThreadManagementService["Service"];
}

function filesWith(files: Record<string, string>) {
  return FileSystem.makeNoop({
    exists: (path) => Effect.succeed(path in files),
    readFileString: (path) => Effect.succeed(files[path] ?? ""),
  });
}

it.effect("adds the bot's CREW.md to the first message of a thread it launched", () =>
  Effect.gen(function* () {
    const bot = threadsWith({ tags: ["bot"], worktreePath: "/bots/scout" });
    const files = filesWith({ "/bots/scout/CREW.md": "Open pull requests as drafts.\n" });

    const text = yield* makeForkBotCrewRules(bot, files)(botId, "Fix the flaky test.");
    assert.isTrue(text.startsWith("Fix the flaky test.\n\n---\n\n"));
    assert.include(text, "Standing rules from Scout");
    assert.include(text, "/bots/scout/CREW.md");
    assert.isTrue(text.endsWith("Open pull requests as drafts."));

    // A runaway file is cut, and says so.
    const long = yield* makeForkBotCrewRules(
      bot,
      filesWith({ "/bots/scout/CREW.md": "x".repeat(20_000) }),
    )(botId, "Go.");
    assert.isBelow(long.length, 9_000);
    assert.include(long, "The rest was cut.");
  }),
);

it.effect("leaves the message alone without a bot, a folder, a file or any rules in it", () =>
  Effect.gen(function* () {
    const files = filesWith({ "/bots/scout/CREW.md": "Rules.", "/bots/empty/CREW.md": "  \n" });
    const cases = [
      [threadsWith({ tags: ["bot"], worktreePath: "/bots/scout" }), null],
      [threadsWith(null), botId],
      [threadsWith({ tags: [], worktreePath: "/bots/scout" }), botId],
      [threadsWith({ tags: ["bot"], worktreePath: null }), botId],
      [threadsWith({ tags: ["bot"], worktreePath: "/bots/missing" }), botId],
      [threadsWith({ tags: ["bot"], worktreePath: "/bots/empty" }), botId],
    ] as const;
    for (const [threads, id] of cases) {
      assert.equal(yield* makeForkBotCrewRules(threads, files)(id, "Go."), "Go.");
    }
    // An unreadable file never fails the launch.
    const broken = FileSystem.makeNoop({
      exists: () => Effect.succeed(true),
      readFileString: () => Effect.fail("unreadable" as never),
    });
    assert.equal(
      yield* makeForkBotCrewRules(
        threadsWith({ tags: ["bot"], worktreePath: "/bots/scout" }),
        broken,
      )(botId, "Go."),
      "Go.",
    );
  }),
);
