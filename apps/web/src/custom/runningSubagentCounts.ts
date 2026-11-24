/**
 * How many subagents are running under each listed thread — see
 * `.fork/customizations.yaml#sidebar-v2-card-rows`. A nested subagent counts
 * toward the listed thread at the top of its chain, the row that stands in for it.
 */
import { useAtomValue } from "@effect/atom-react";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import {
  threadRuntimeIsActive,
  type EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/models";
import { Atom } from "effect/reactivity";

import { environmentThreadShells } from "~/state/threads";

type CountedShell = Pick<
  EnvironmentThreadShell,
  "id" | "environmentId" | "lineage" | "archivedAt" | "runtime"
>;

export function countRunningSubagents(
  threads: ReadonlyArray<CountedShell>,
): ReadonlyMap<string, number> {
  const keyOf = (thread: CountedShell) =>
    scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
  const byKey = new Map(threads.map((thread) => [keyOf(thread), thread] as const));
  const counts = new Map<string, number>();
  for (const thread of threads) {
    if (thread.lineage.relationshipToParent !== "subagent") continue;
    if (thread.archivedAt !== null || !threadRuntimeIsActive(thread.runtime)) continue;
    let parentKey: string | null = null;
    let current: CountedShell | undefined = thread;
    const seen = new Set<string>();
    while (current?.lineage.relationshipToParent === "subagent") {
      const parentId = current.lineage.parentThreadId;
      if (parentId === null) break;
      parentKey = scopedThreadKey(scopeThreadRef(current.environmentId, parentId));
      if (seen.has(parentKey)) break;
      seen.add(parentKey);
      current = byKey.get(parentKey);
    }
    if (parentKey !== null) counts.set(parentKey, (counts.get(parentKey) ?? 0) + 1);
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

export function useRunningSubagentCount(ref: ScopedThreadRef): number {
  return useAtomValue(runningSubagentCountAtom(scopedThreadKey(ref)));
}
