/**
 * Writing a sprint's files on its owner's behalf — see `.fork/customizations.yaml#fork-sprints`.
 * A write the sprint should hear about also drops that file's owner-edit marker
 * (sprintOwnerEditMarker), which its turn hook reads on the next message.
 */
import type { AtomRegistry } from "effect/reactivity";

import { type HostFolder, readHostFolderFile, writeHostFolderFile } from "../hostFolderFiles";
import {
  SPRINT_ANSWERS_FILE,
  type SprintAnswer,
  sprintAnswerLine,
  sprintOwnerEditMarker,
  withSprintAnswer,
} from "./sprintThreads";

const ASKED = { reportDefect: true } as const;

/** Reads one of the sprint's files fresh, past the query's cache. */
export function readSprintFile(
  registry: AtomRegistry.AtomRegistry,
  folder: HostFolder,
  relativePath: string,
) {
  return readHostFolderFile(registry, folder, relativePath, ASKED);
}

/** Writes one of the sprint's files; with `announce`, the sprint is shown its new text on its next
    message. Resolves to whether the file itself was written. */
export async function writeSprintFile(
  registry: AtomRegistry.AtomRegistry,
  folder: HostFolder,
  relativePath: string,
  contents: string,
  options: { readonly announce: boolean },
): Promise<boolean> {
  const write = (path: string, text: string) =>
    writeHostFolderFile(registry, folder, path, text, ASKED);
  const written = await write(relativePath, contents);
  if (written._tag !== "Success") return false;
  if (options.announce)
    await write(sprintOwnerEditMarker(relativePath), `${new Date().toISOString()}\n`);
  return true;
}

/** ANSWERS.md is read, appended to and written back, so one sprint's notes go one at a time:
    two quick answers would otherwise both read the same log and the second drop the first. */
const answerLogQueues = new Map<string, Promise<void>>();

/** Notes an answer the owner gave one of the sprint's threads in its ANSWERS.md, keyed by the
    request, and reads the log again so the settled card shows it. */
export function noteSprintAnswer(
  registry: AtomRegistry.AtomRegistry,
  folder: HostFolder,
  entry: {
    readonly threadTitle: string;
    /** The work report's `threadId:requestId`. */
    readonly reportKey: string;
    readonly answers: ReadonlyArray<SprintAnswer>;
  },
): Promise<void> {
  const queueKey = `${folder.environmentId}\n${folder.cwd}`;
  const append = async () => {
    const read = await readSprintFile(registry, folder, SPRINT_ANSWERS_FILE);
    const log = read._tag === "Success" && read.value.exists !== false ? read.value.contents : "";
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const line = `${stamp}: ${entry.threadTitle} (${entry.reportKey}): ${sprintAnswerLine(entry.answers)}`;
    const written = await writeSprintFile(
      registry,
      folder,
      SPRINT_ANSWERS_FILE,
      withSprintAnswer(log, line),
      { announce: true },
    );
    if (written) await readSprintFile(registry, folder, SPRINT_ANSWERS_FILE);
  };
  // The queue holds only settled promises, so one failed note never stops the next.
  const next = (answerLogQueues.get(queueKey) ?? Promise.resolve()).then(append);
  const settled = next.catch(() => {});
  answerLogQueues.set(queueKey, settled);
  void settled.then(() => {
    if (answerLogQueues.get(queueKey) === settled) answerLogQueues.delete(queueKey);
  });
  return next;
}
