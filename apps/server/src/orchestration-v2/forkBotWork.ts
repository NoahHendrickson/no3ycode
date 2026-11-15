// @effect-diagnostics nodeBuiltinImport:off
/**
 * A bot's work — see `.fork/customizations.yaml#fork-bot-work-threads`. A top-level thread a bot
 * launches carries the tag `bot-work:<bot thread id>`, and a thread launched by one of those (or by
 * a bot's subagent) inherits it, so clients keep the bot's work off the sidebar and in its panel.
 */
import { CommandId, type OrchestrationV2ThreadShell, ThreadId } from "@t3tools/contracts";
import { FORK_BOT_WORK_TAG_PREFIX, isForkBotThread } from "@t3tools/shared/forkBotTags";
import * as Effect from "effect/Effect";
import type * as FileSystem from "effect/FileSystem";
import * as NodePath from "node:path";

import type { ThreadManagementService } from "./ThreadManagementService.ts";

/** The thread tag schema's limit (contracts threadTags). */
const THREAD_TAG_MAX_LENGTH = 64;

/** The thread `threadId` acts for: a subagent or side chat stands in for the thread it runs
    under, so a bot's subagent acts for the bot. */
export const forkBotActingShell = Effect.fn("ThreadLaunchService.forkBotActingShell")(function* (
  threads: ThreadManagementService["Service"],
  threadId: ThreadId,
) {
  const caller = yield* threads.getThreadShell(threadId);
  return caller === null ||
    (caller.lineage.relationshipToParent !== "subagent" && caller.lineage.sideChat !== true)
    ? caller
    : yield* threads.getThreadShell(caller.lineage.rootThreadId);
});

/** The tag a thread launched by `launcher` carries, or null when the launcher is no bot's. */
function forkBotWorkTag(launcher: Pick<OrchestrationV2ThreadShell, "id" | "tags">): string | null {
  const inherited = launcher.tags?.find((tag) => tag.startsWith(FORK_BOT_WORK_TAG_PREFIX));
  if (inherited !== undefined) return inherited;
  if (!isForkBotThread(launcher.tags)) return null;
  const tag = `${FORK_BOT_WORK_TAG_PREFIX}${launcher.id}`;
  // Bots are made with uuid ids (43 characters here); a longer id simply goes unlinked.
  return tag.length <= THREAD_TAG_MAX_LENGTH ? tag : null;
}

/** Tags a newly launched thread as its launcher's bot's work, and returns that bot's id. Best
    effort: an unlinked thread lists in the sidebar like any other, so a failure here never fails
    the launch. */
export const linkForkBotWork = Effect.fn("ThreadLaunchService.linkForkBotWork")(
  function* (
    threads: ThreadManagementService["Service"],
    input: {
      readonly commandId: CommandId;
      readonly threadId: ThreadId;
      readonly launchedBy: ThreadId;
    },
  ) {
    const launcher = yield* forkBotActingShell(threads, input.launchedBy);
    const tag = launcher === null ? null : forkBotWorkTag(launcher);
    if (tag === null) return null;
    yield* threads.dispatch({
      type: "thread.tag.set",
      commandId: CommandId.make(`${input.commandId}:bot-work`),
      threadId: input.threadId,
      tag,
      tagged: true,
    });
    return ThreadId.make(tag.slice(FORK_BOT_WORK_TAG_PREFIX.length));
  },
  Effect.catch((error) =>
    Effect.logWarning("fork-bot-work.link-failed", { error }).pipe(Effect.as(null)),
  ),
);

/** The rules file in a bot's folder that every thread it launches follows. */
const FORK_BOT_CREW_FILE = "CREW.md";
/** Rules past this are cut, so a runaway file cannot crowd out the task itself. */
const FORK_BOT_CREW_MAX_CHARS = 8_000;

/** `text` with the bot's CREW.md after it, for the first message of a thread the bot launched.
    No hook gives every provider a thread's standing rules, so they travel in that message. Best
    effort: no bot, no folder, no file or an empty one leaves `text` as it is. */
export const makeForkBotCrewRules = (
  threads: ThreadManagementService["Service"],
  fileSystem: FileSystem.FileSystem,
) =>
  Effect.fn("ThreadLaunchService.withForkBotCrewRules")(
    function* (botId: ThreadId | null, text: string) {
      if (botId === null) return text;
      const bot = yield* threads.getThreadShell(botId);
      if (bot === null || !isForkBotThread(bot.tags) || bot.worktreePath === null) return text;
      const path = NodePath.join(bot.worktreePath, FORK_BOT_CREW_FILE);
      if (!(yield* fileSystem.exists(path))) return text;
      const rules = (yield* fileSystem.readFileString(path)).trim();
      if (rules === "") return text;
      const kept =
        rules.length > FORK_BOT_CREW_MAX_CHARS
          ? `${rules.slice(0, FORK_BOT_CREW_MAX_CHARS)}\n\n(The rest was cut. Read the whole file.)`
          : rules;
      return `${text}

---

Standing rules from ${bot.title}, the Petal that started this thread. They are its CREW.md, at ${path}. Follow them on every turn. If ${bot.title} tells you they changed, read that file again.

${kept}`;
    },
    (effect, _botId, text) =>
      effect.pipe(
        Effect.catch((error) =>
          Effect.logWarning("fork-bot-work.crew-rules-failed", { error }).pipe(Effect.as(text)),
        ),
      ),
  );
