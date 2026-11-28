/**
 * What a sidebar list section (Sprints, Petals, Coordinators) shows of its threads.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";

/** All of them, or while the section is folded the open one alone. */
export function visibleSectionThreads<
  T extends { readonly environmentId: EnvironmentId; readonly id: ScopedThreadRef["threadId"] },
>(threads: ReadonlyArray<T>, collapsed: boolean, routeThreadKey: string | null): T[] {
  return threads.filter(
    (thread) =>
      !collapsed ||
      routeThreadKey === scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
  );
}
