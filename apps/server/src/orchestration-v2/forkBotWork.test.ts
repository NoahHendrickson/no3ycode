/**
 * Fork-owned — see `.fork/customizations.yaml#fork-bot-crew-rules`.
 */
import { assert, it } from "@effect/vitest";
import { CommandId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

import type { ThreadManagementService } from "./ThreadManagementService.ts";
import { forkBotIdFor, linkForkBotWork, withForkBotCrewRules } from "./forkBotWork.ts";

const botId = ThreadId.make("bot");

type Shell = { readonly tags: ReadonlyArray<string>; readonly worktreePath?: string | null };

function threadsWith(shells: Record<string, Shell>) {
  const tagged: Array<string> = [];
  const threads = {
    getThreadShell: (id: string) =>
      Effect.succeed(
        id in shells
          ? {
              id,
              title: "Scout",
              worktreePath: null,
              lineage: { relationshipToParent: null, rootThreadId: id },
              ...shells[id],
            }
          : null,
      ),
    dispatch: (command: { readonly tag: string }) =>
      Effect.sync(() => void tagged.push(command.tag)),
  } as unknown as ThreadManagementService["Service"];
  return { threads, tagged };
}

function filesWith(files: Record<string, string>) {
  return FileSystem.makeNoop({
    exists: (path) => Effect.succeed(path in files),
    readFileString: (path) => Effect.succeed(files[path] ?? ""),
  });
}

it.effect("links a thread to the bot that launched it, or to its launcher's bot", () =>
  Effect.gen(function* () {
    const { threads, tagged } = threadsWith({
      bot: { tags: ["bot"] },
      work: { tags: ["bot-work:bot"] },
      plain: { tags: [] },
    });
    assert.equal(yield* forkBotIdFor(threads, ThreadId.make("bot")), botId);
    assert.equal(yield* forkBotIdFor(threads, ThreadId.make("work")), botId);
    assert.isNull(yield* forkBotIdFor(threads, ThreadId.make("plain")));
    yield* linkForkBotWork(threads, {
      commandId: CommandId.make("command:launch"),
      threadId: ThreadId.make("thread:new"),
      botId,
    });
    assert.deepEqual(tagged, ["bot-work:bot"]);
  }),
);

it.effect("adds the bot's CREW.md to the first message of a thread it launched", () =>
  Effect.gen(function* () {
    const { threads } = threadsWith({ bot: { tags: ["bot"], worktreePath: "/bots/scout" } });
    const files = filesWith({ "/bots/scout/CREW.md": "Open pull requests as drafts.\n" });

    const text = yield* withForkBotCrewRules(threads, files, botId, "Fix the flaky test.");
    assert.isTrue(text.startsWith("Fix the flaky test.\n\n---\n\n"));
    assert.include(text, "Standing rules from Scout");
    assert.include(text, "/bots/scout/CREW.md");
    assert.isTrue(text.endsWith("Open pull requests as drafts."));

    // A runaway file is cut, and says so.
    const long = yield* withForkBotCrewRules(
      threads,
      filesWith({ "/bots/scout/CREW.md": "x".repeat(20_000) }),
      botId,
      "Go.",
    );
    assert.isBelow(long.length, 9_000);
    assert.include(long, "The rest was cut.");
  }),
);

it.effect("sends the message as written without a bot, a folder, a file or any rules", () =>
  Effect.gen(function* () {
    const files = filesWith({ "/bots/empty/CREW.md": "  \n" });
    const cases: ReadonlyArray<Record<string, Shell>> = [
      {},
      { bot: { tags: [], worktreePath: "/bots/empty" } },
      { bot: { tags: ["bot"], worktreePath: null } },
      { bot: { tags: ["bot"], worktreePath: "/bots/missing" } },
      { bot: { tags: ["bot"], worktreePath: "/bots/empty" } },
    ];
    for (const shells of cases) {
      const { threads } = threadsWith(shells);
      assert.equal(yield* withForkBotCrewRules(threads, files, botId, "Go."), "Go.");
    }
    // An unreadable file never fails the launch.
    const { threads } = threadsWith({ bot: { tags: ["bot"], worktreePath: "/bots/x" } });
    const broken = FileSystem.makeNoop({
      exists: () => Effect.succeed(true),
      readFileString: () => Effect.fail("unreadable" as never),
    });
    assert.equal(yield* withForkBotCrewRules(threads, broken, botId, "Go."), "Go.");
  }),
);
