/** Runs refreshBotRules once a session for each listed bot — see `#fork-bot-rules-refresh`. */
import { RegistryContext } from "@effect/atom-react";
import { executeAtomQuery, runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import type { AtomRegistry } from "effect/reactivity";
import { useContext, useEffect } from "react";

import { projectEnvironment } from "~/state/projects";

import { type BotFolderFiles, refreshBotRules } from "./refreshBotRules";

interface RefreshableBot {
  readonly environmentId: EnvironmentId;
  readonly id: string;
  readonly title: string;
  readonly worktreePath: string | null;
}

/** Bots this session refreshed, found current, or is refreshing now. */
const checked = new Set<string>();
/** When a bot's last attempt failed. A connection still coming up fails once and is retried;
    a client that cannot read or write the host's files keeps failing, once a minute at most. */
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 60_000;

const QUIET = { reportFailure: false, reportDefect: false } as const;

function folderFiles(
  registry: AtomRegistry.AtomRegistry,
  environmentId: EnvironmentId,
  cwd: string,
): BotFolderFiles {
  return {
    read: async (relativePath) => {
      const result = await executeAtomQuery(
        registry,
        projectEnvironment.readFile({
          environmentId,
          input: { cwd, relativePath, allowMissing: true },
        }),
        { ...QUIET, refresh: true },
      );
      if (result._tag !== "Success") throw new Error(`Could not read ${relativePath}.`);
      return result.value.exists === false ? null : result.value.contents;
    },
    write: async (relativePath, contents) => {
      const result = await runAtomCommand(
        registry,
        projectEnvironment.writeFile,
        { environmentId, input: { cwd, relativePath, contents } },
        { label: projectEnvironment.writeFile.label, ...QUIET },
      );
      if (result._tag !== "Success") throw new Error(`Could not write ${relativePath}.`);
    },
  };
}

export function useRefreshBotRules(bots: ReadonlyArray<RefreshableBot>): void {
  const registry = useContext(RegistryContext);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- writes the listed bots' rule files on their host, once per bot per session unless it failed
  useEffect(() => {
    for (const bot of bots) {
      const key = `${bot.environmentId}:${bot.id}`;
      if (bot.worktreePath === null || checked.has(key)) continue;
      if (Date.now() - (failedAt.get(key) ?? -Infinity) < RETRY_AFTER_MS) continue;
      checked.add(key);
      void refreshBotRules(folderFiles(registry, bot.environmentId, bot.worktreePath), {
        name: bot.title,
        threadId: bot.id,
      }).catch(() => {
        checked.delete(key);
        failedAt.set(key, Date.now());
      });
    }
  }, [bots, registry]);
}
