/**
 * The Petals the Automations page groups by — see `.fork/customizations.yaml#fork-scheduled-page`.
 * Read from the complete shell list, so the tag filter never reassigns an automation, and kept
 * by identity while no Petal's id or title changes, so streaming never re-renders the page.
 */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";

import { environmentThreadShells } from "~/state/threads";

import { listSidebarBots } from "../bots/botThreads";

interface RosterPetal {
  readonly environmentId: EnvironmentId;
  readonly id: ThreadId;
  readonly title: string;
}

const NO_PETALS: ReadonlyArray<RosterPetal> = [];
const NO_PETALS_ATOM = Atom.make(NO_PETALS).pipe(Atom.withLabel("fork-petal-roster:none"));

let previousPetals = NO_PETALS;
const petalRosterAtom = Atom.make((get) => {
  const next = listSidebarBots(get(environmentThreadShells.threadShellsAtom)).map(
    (petal): RosterPetal => ({
      environmentId: petal.environmentId,
      id: petal.id,
      title: petal.title,
    }),
  );
  const unchanged =
    next.length === previousPetals.length &&
    next.every((petal, index) => {
      const previous = previousPetals[index]!;
      return (
        petal.environmentId === previous.environmentId &&
        petal.id === previous.id &&
        petal.title === previous.title
      );
    });
  if (unchanged) return previousPetals;
  previousPetals = next;
  return next;
}).pipe(Atom.withLabel("fork-petal-roster"));

/** One environment's listed Petals by thread id; empty unless `enabled`, which keeps an
    ungrouped page off the shell list entirely. */
export function usePetalTitles(
  environmentId: EnvironmentId,
  enabled: boolean,
): ReadonlyMap<ThreadId, string> {
  const petals = useAtomValue(enabled ? petalRosterAtom : NO_PETALS_ATOM);
  return new Map(
    petals
      .filter((petal) => petal.environmentId === environmentId)
      .map((petal) => [petal.id, petal.title] as const),
  );
}
