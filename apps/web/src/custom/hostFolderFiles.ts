/**
 * Reading and writing files in a Petal's or a sprint's folder on its host — see
 * `.fork/customizations.yaml#fork-bot-rules-refresh`. Failures are never toasted.
 */
import { executeAtomQuery, runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import type { AtomRegistry } from "effect/reactivity";

import { projectEnvironment } from "~/state/projects";

/** A folder on its machine. */
export interface HostFolder {
  readonly environmentId: EnvironmentId;
  readonly cwd: string;
}

/** `reportDefect` is off for work nobody asked for. */
interface Reporting {
  readonly reportDefect: boolean;
}

/** Reads one file fresh, past the query's cache; a missing file is a success with `exists: false`. */
export function readHostFolderFile(
  registry: AtomRegistry.AtomRegistry,
  folder: HostFolder,
  relativePath: string,
  reporting: Reporting,
) {
  return executeAtomQuery(
    registry,
    projectEnvironment.readFile({
      environmentId: folder.environmentId,
      input: { cwd: folder.cwd, relativePath, allowMissing: true },
    }),
    { reportFailure: false, ...reporting, refresh: true },
  );
}

export function writeHostFolderFile(
  registry: AtomRegistry.AtomRegistry,
  folder: HostFolder,
  relativePath: string,
  contents: string,
  reporting: Reporting,
) {
  return runAtomCommand(
    registry,
    projectEnvironment.writeFile,
    {
      environmentId: folder.environmentId,
      input: { cwd: folder.cwd, relativePath, contents },
    },
    { label: projectEnvironment.writeFile.label, reportFailure: false, ...reporting },
  );
}

/** File access in one folder: `read` is null for a missing file and throws on failure; `write`
    throws on failure. */
export interface FolderFiles {
  readonly read: (relativePath: string) => Promise<string | null>;
  readonly write: (relativePath: string, contents: string) => Promise<void>;
}

const UNASKED: Reporting = { reportDefect: false };

/** FolderFiles on the host, reporting nothing, for work that runs unasked. */
export function quietFolderFiles(
  registry: AtomRegistry.AtomRegistry,
  folder: HostFolder,
): FolderFiles {
  return {
    read: async (relativePath) => {
      const result = await readHostFolderFile(registry, folder, relativePath, UNASKED);
      if (result._tag !== "Success") throw new Error(`Could not read ${relativePath}.`);
      return result.value.exists === false ? null : result.value.contents;
    },
    write: async (relativePath, contents) => {
      const result = await writeHostFolderFile(registry, folder, relativePath, contents, UNASKED);
      if (result._tag !== "Success") throw new Error(`Could not write ${relativePath}.`);
    },
  };
}
