/**
 * Copies files into a sprint's library, its `context/` folder — see
 * `.fork/customizations.yaml#fork-sprints`. Used by the New sprint dialog and the Library tab.
 */
import { RegistryContext } from "@effect/atom-react";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import { useContext } from "react";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { projectEnvironment } from "~/state/projects";

import {
  readContextFile,
  SPRINT_CONTEXT_DIRECTORY,
  skippedContextSummary,
} from "./sprintContextFiles";

export interface SprintContextTarget {
  readonly environmentId: EnvironmentId;
  /** A folder the server can write in, and the sprint folder's path relative to it. */
  readonly cwd: string;
  readonly folder: string;
}

/** Resolves to the number of files copied. A file of the same name is replaced. */
export function useAddSprintContext(): (
  target: SprintContextTarget,
  files: ReadonlyArray<File>,
) => Promise<number> {
  const registry = useContext(RegistryContext);
  return async (target, files) => {
    const read = await Promise.all(files.map(readContextFile));
    const prefix = target.folder === "" ? "" : `${target.folder}/`;
    let failed = 0;
    let copied = 0;
    for (const file of read) {
      if (file.kind !== "file") continue;
      const result = await runAtomCommand(
        registry,
        projectEnvironment.writeFile,
        {
          environmentId: target.environmentId,
          input: {
            cwd: target.cwd,
            relativePath: `${prefix}${SPRINT_CONTEXT_DIRECTORY}/${file.name}`,
            contents: file.contents,
            encoding: file.encoding,
          },
        },
        { label: projectEnvironment.writeFile.label, reportFailure: false, reportDefect: true },
      );
      if (result._tag === "Success") copied += 1;
      else failed += 1;
    }
    const skipped = skippedContextSummary(read);
    if (skipped !== null || failed > 0) {
      toastManager.add(
        stackedThreadToast({
          type: "warning",
          title:
            copied === 0
              ? "No files were added to the library"
              : "Some files were not added to the library",
          description: [skipped, failed > 0 ? `${failed} could not be written.` : null]
            .filter((part) => part !== null)
            .join(" "),
        }),
      );
    }
    return copied;
  };
}
