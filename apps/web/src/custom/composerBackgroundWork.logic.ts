import type {
  PendingBackgroundWorkItem,
  PendingBackgroundWorkPresentation,
} from "@t3tools/client-runtime/state/thread-execution";
import type { OrchestrationV2Subagent } from "@t3tools/contracts";
import { forkShellCommandParsing as shell } from "@t3tools/client-runtime/work-log/command-label";

import { forkSubagentRowFromAgent, type ForkSubagentTreeRow } from "./forkSubagentTree";

/** A background task, with its transcript card row when the task is a subagent's. */
export interface ComposerBackgroundWorkItem extends PendingBackgroundWorkItem {
  readonly subagent?: ForkSubagentTreeRow | undefined;
}

export interface ComposerBackgroundWorkPresentation extends Omit<
  PendingBackgroundWorkPresentation,
  "items"
> {
  readonly items: ReadonlyArray<ComposerBackgroundWorkItem>;
}

/** Pairs each subagent task with its live record's card row, once, so a task row reads one item. */
export function resolveComposerBackgroundWork(
  presentation: PendingBackgroundWorkPresentation | null,
  subagents: ReadonlyArray<OrchestrationV2Subagent> | null | undefined,
): ComposerBackgroundWorkPresentation | null {
  if (presentation === null) return null;
  return {
    ...presentation,
    items: presentation.items.map((task) => {
      const agent =
        task.childThreadId === undefined
          ? undefined
          : subagents?.find((candidate) => candidate.childThreadId === task.childThreadId);
      return agent === undefined ? task : { ...task, subagent: forkSubagentRowFromAgent(agent) };
    }),
  };
}

/** The first index from which every token is a redirection, or null when the command has none. */
function redirectionTailStart(tokens: ReadonlyArray<string>): number | null {
  for (let start = 1; start < tokens.length; start++) {
    let index = start;
    while (index < tokens.length) {
      const next = shell.indexAfterShellRedirection(tokens, index);
      if (next === null || next > tokens.length) break;
      index = next;
    }
    if (index === tokens.length) return start;
  }
  return null;
}

/** A background command as its gist for the work list: no `cd <dir> &&` lead-in, and a single
 * command loses its trailing redirects and `&`. `vp run dev --no-seed 2>&1` reads
 * `vp run dev --no-seed`. Anything the shell reader cannot settle stays as written. */
export function glanceCommandLabel(command: string): string {
  let label = command.trim();
  for (;;) {
    const split = shell.splitFirstShellCommand(label);
    if (split.remainingCommand === null) {
      if (split.separator === "&") label = split.firstCommand.trim();
      break;
    }
    const tokens = shell.tokenizeShellCommand(split.firstCommand);
    const leadingCd =
      (split.separator === "&&" || split.separator === ";") &&
      tokens?.length === 2 &&
      tokens[0] === "cd";
    if (!leadingCd) return label;
    label = split.remainingCommand;
  }

  // The tokenizer reads a quote inside `$(...)` as closing the outer one, so a redirect-looking
  // word there could be quoted text.
  if (label.includes("$(") || label.includes("`")) return label;
  const tokens = shell.tokenizeShellCommand(label);
  const start = tokens === null ? null : redirectionTailStart(tokens);
  if (tokens === null || start === null) return label;
  const kept = JSON.stringify(tokens.slice(0, start));
  // Drop whole words from the end until what is left reads as exactly the kept tokens.
  for (let cut = label; /\s/u.test(cut);) {
    cut = cut.replace(/\s+\S*$/u, "");
    const cutTokens = shell.tokenizeShellCommand(cut);
    if (cutTokens === null || cutTokens.length < start) break;
    if (JSON.stringify(cutTokens) === kept) return cut;
  }
  return label;
}
