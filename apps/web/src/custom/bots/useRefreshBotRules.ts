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

/** Bots this session already looked at, refreshed or not, so a sidebar render never retries. */
const checked = new Set<string>();

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
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- writes the listed bots' rule files on their host, once per bot per session
  useEffect(() => {
    for (const bot of bots) {
      const key = `${bot.environmentId}:${bot.id}`;
      if (bot.worktreePath === null || checked.has(key)) continue;
      checked.add(key);
      // A client that cannot read or write the host's files leaves it to one that can.
      void refreshBotRules(folderFiles(registry, bot.environmentId, bot.worktreePath), {
        name: bot.title,
        threadId: bot.id,
      }).catch(() => {});
    }
  }, [bots, registry]);
}
