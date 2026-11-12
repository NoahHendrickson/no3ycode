/**
 * Which threads have a server shell — see `.fork/customizations.yaml#sidebar-v2-draft-rows`.
 * The set keeps its identity while no thread joins or leaves the quiet shell list, so a draft
 * row that asks whether its thread has reached the server rebuilds only when that can change.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { Atom } from "effect/reactivity";

import { environmentThreadShells } from "~/state/threads";

let previousKeys: ReadonlySet<string> = new Set();
const quietThreadShellKeysAtom = Atom.make((get) => {
  const keys = get(environmentThreadShells.quietThreadShellsAtom).map((thread) =>
    scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
  );
  if (keys.length === previousKeys.size && keys.every((key) => previousKeys.has(key))) {
    return previousKeys;
  }
  previousKeys = new Set(keys);
  return previousKeys;
}).pipe(Atom.withLabel("fork-quiet-thread-shell-keys"));

export function useQuietThreadShellKeys(): ReadonlySet<string> {
  return useAtomValue(quietThreadShellKeysAtom);
}
