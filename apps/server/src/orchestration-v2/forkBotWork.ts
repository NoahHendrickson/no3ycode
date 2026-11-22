// @effect-diagnostics nodeBuiltinImport:off
/**
 * A bot's work — see `.fork/customizations.yaml#fork-bot-work-threads`. A top-level thread a bot
 * launches carries the tag `bot-work:<bot thread id>`, and a thread launched by one of those (or by
 * a bot's subagent) inherits it, so clients keep the bot's work off the sidebar and in its panel.
 */
import { CommandId, type OrchestrationV2ThreadShell, ThreadId } from "@t3tools/contracts";
import {
  FORK_BOT_CREW_FILE,
  forkBotWorkOwner,
  forkBotWorkTag,
  isForkBotThread,
} from "@t3tools/shared/forkBotTags";
import * as Effect from "effect/Effect";
import type * as FileSystem from "effect/FileSystem";
import * as NodePath from "node:path";

import type { ThreadManagementService } from "./ThreadManagementService.ts";

/** The thread tag schema's limit (contracts threadTags). */
const THREAD_TAG_MAX_LENGTH = 64;
/** Rules past this are cut, so a runaway file cannot crowd out the task itself. */
const FORK_BOT_CREW_MAX_CHARS = 8_000;

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

/** The bot a thread launched by `launcher` works for: the launcher's own bot, or the launcher
    when it is a bot. Null when it is no bot's, or its id is too long for a tag. */
function launcherBotId(launcher: Pick<OrchestrationV2ThreadShell, "id" | "tags">): string | null {
  const inherited = forkBotWorkOwner(launcher.tags);
  if (inherited !== null) return inherited;
  if (!isForkBotThread(launcher.tags)) return null;
  // Bots are made with uuid ids (43 characters here); a longer id simply goes unlinked.
  return forkBotWorkTag(launcher.id).length <= THREAD_TAG_MAX_LENGTH ? launcher.id : null;
}

/** The bot a thread launched by `launchedBy` will work for, before that thread exists. */
export const forkBotIdFor = Effect.fn("ThreadLaunchService.forkBotIdFor")(
  function* (threads: ThreadManagementService["Service"], launchedBy: ThreadId) {
    const launcher = yield* forkBotActingShell(threads, launchedBy);
    const botId = launcher === null ? null : launcherBotId(launcher);
    return botId === null ? null : ThreadId.make(botId);
  },
  Effect.catch((error) =>
    Effect.logWarning("fork-bot-work.resolve-failed", { error }).pipe(Effect.as(null)),
  ),
);

/** Tags a newly launched thread as the work of `botId` (from forkBotIdFor). Best effort: an
    unlinked thread lists in the sidebar like any other, so a failure here never fails the launch. */
export const linkForkBotWork = Effect.fn("ThreadLaunchService.linkForkBotWork")(
  function* (
    threads: ThreadManagementService["Service"],
    input: {
      readonly commandId: CommandId;
      readonly threadId: ThreadId;
      readonly botId: ThreadId;
    },
  ) {
    yield* threads.dispatch({
      type: "thread.tag.set",
      commandId: CommandId.make(`${input.commandId}:bot-work`),
      threadId: input.threadId,
      tag: forkBotWorkTag(input.botId),
      tagged: true,
    });
  },
  Effect.catch((error) => Effect.logWarning("fork-bot-work.link-failed", { error })),
);

/** `text` with the CREW.md of the bot `botId` after it, for the first message of a thread
    linkForkBotWork linked (`fork-bot-crew-rules`). No hook gives every provider a thread's
    standing rules, so they travel in that message. Best effort: no bot, folder, file or rules,
    or a failed read, leaves `text` as it is. */
export const withForkBotCrewRules = Effect.fn("ThreadLaunchService.withForkBotCrewRules")(
  function* (
    threads: ThreadManagementService["Service"],
    fileSystem: FileSystem.FileSystem,
    botId: ThreadId,
    text: string,
  ) {
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
  (effect, _threads, _fileSystem, _botId, text) =>
    effect.pipe(
      Effect.catch((error) =>
        Effect.logWarning("fork-bot-work.crew-rules-failed", { error }).pipe(Effect.as(text)),
      ),
    ),
);
