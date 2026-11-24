/**
 * How many subagents are running under each listed thread — see
 * `.fork/customizations.yaml#sidebar-v2-card-rows`. Each counts toward the row
 * that stands in for it, the same row route highlighting resolves to.
 */
import { useAtomValue } from "@effect/atom-react";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import {
  threadRuntimeIsActive,
  type EnvironmentThreadShell,
  type ThreadStructureRuntime,
} from "@t3tools/client-runtime/state/models";
import { resolveListedAncestorThreadRef } from "@t3tools/client-runtime/state/threads";
import { Atom } from "effect/reactivity";
import { useGT } from "gt-react";

import { environmentThreadShells } from "~/state/threads";
import { isForkSubagentLinkThread } from "./forkSubagentLinkLogic";

type CountedShell = Pick<
  EnvironmentThreadShell,
  "id" | "environmentId" | "lineage" | "delegatedFrom" | "archivedAt"
> & { readonly runtime: ThreadStructureRuntime | null };

export function countRunningSubagents(
  threads: ReadonlyArray<CountedShell>,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const thread of threads) {
    if (!isForkSubagentLinkThread(thread) || thread.archivedAt !== null) continue;
    if (!threadRuntimeIsActive(thread.runtime)) continue;
    const ref = scopeThreadRef(thread.environmentId, thread.id);
    const rowKey = scopedThreadKey(resolveListedAncestorThreadRef(ref, threads));
    // Resolving to itself: a broken chain, or a delegated task that keeps its own row.
    if (rowKey === scopedThreadKey(ref)) continue;
    counts.set(rowKey, (counts.get(rowKey) ?? 0) + 1);
  }
  return counts;
}

const runningSubagentCountsAtom = Atom.make((get) =>
  countRunningSubagents(get(environmentThreadShells.quietThreadShellsAtom)),
).pipe(Atom.withLabel("fork-running-subagent-counts"));

// A number per row, so a row re-renders only when its own count moves.
const runningSubagentCountAtom = Atom.family((key: string) =>
  Atom.make((get) => get(runningSubagentCountsAtom).get(key) ?? 0).pipe(
    Atom.withLabel(`fork-running-subagent-count:${key}`),
  ),
);

/** The count, and the phrase the row's accessible name carries for it (null at zero). */
export function useRunningSubagents(ref: ScopedThreadRef): {
  readonly count: number;
  readonly label: string | null;
} {
  const count = useAtomValue(runningSubagentCountAtom(scopedThreadKey(ref)));
  const gt = useGT();
  return {
    count,
    label:
      count > 0
        ? gt("{count, plural, one {{count} subagent running} other {{count} subagents running}}", {
            count,
          })
        : null,
  };
}
