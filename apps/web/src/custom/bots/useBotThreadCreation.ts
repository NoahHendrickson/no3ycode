/**
 * The steps a Petal (useCreateBot) and a sprint (sprints/useCreateSprint) are made with — see
 * `.fork/customizations.yaml#fork-bots`. Existing commands only: write its folder's seed files,
 * create the thread, tag it in order. Each step reports its own failure under the flow's title.
 */
import { RegistryContext } from "@effect/atom-react";
import {
  type AtomCommandResult,
  isAtomCommandInterrupted,
  runAtomCommand,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useContext } from "react";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { projectEnvironment } from "~/state/projects";
import { threadEnvironment } from "~/state/threads";

type CreateThreadInput = Parameters<typeof threadEnvironment.create.run>[1]["input"];

export function useBotThreadCreation(failureTitle: string) {
  const registry = useContext(RegistryContext);

  const reportFailure = (description: string) => {
    toastManager.add(stackedThreadToast({ type: "error", title: failureTitle, description }));
  };
  /** True, and reported unless interrupted, when the command failed. */
  const failed = (result: AtomCommandResult<unknown, unknown>) => {
    if (result._tag === "Success") return false;
    if (!isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      reportFailure(error instanceof Error ? error.message : "An error occurred.");
    }
    return true;
  };
  const run = <W, A, E>(command: Parameters<typeof runAtomCommand<W, A, E>>[1], value: W) =>
    runAtomCommand(registry, command, value, {
      label: command.label,
      reportFailure: false,
      reportDefect: true,
    });
  const setTag = async (environmentId: EnvironmentId, threadId: ThreadId, tag: string) =>
    !failed(
      await run(threadEnvironment.setTag, {
        environmentId,
        input: { threadId, tag, tagged: true },
      }),
    );
  const remove = (environmentId: EnvironmentId, threadId: ThreadId) =>
    run(threadEnvironment.delete, { environmentId, input: { threadId } });

  return {
    registry,
    reportFailure,
    /** Writes each file under `folder` in `cwd`; false when one failed. */
    seed: async (
      environmentId: EnvironmentId,
      cwd: string,
      folder: string,
      files: ReadonlyArray<{ readonly relativePath: string; readonly contents: string }>,
    ): Promise<boolean> => {
      const written = await Promise.all(
        files.map((file) =>
          run(projectEnvironment.writeFile, {
            environmentId,
            input: { cwd, relativePath: `${folder}/${file.relativePath}`, contents: file.contents },
          }),
        ),
      );
      return !written.some(failed);
    },
    /** Creates the thread and sets `tags` in order. Without them it would be a stray thread, so a
        failed tag deletes it again. False when it was not made. */
    createTagged: async (
      environmentId: EnvironmentId,
      input: CreateThreadInput,
      tags: ReadonlyArray<string>,
    ): Promise<boolean> => {
      if (failed(await run(threadEnvironment.create, { environmentId, input }))) return false;
      for (const tag of tags) {
        if (!(await setTag(environmentId, input.threadId, tag))) {
          await remove(environmentId, input.threadId);
          return false;
        }
      }
      return true;
    },
    /** A tag the thread can stand without; false (reported) when it failed. */
    setTag,
    remove,
  };
}
