/** A bot's timeline without its quiet wakes — see `.fork/customizations.yaml#fork-bots`. */
import type { OrchestrationV2ProjectedTurnItem, ScopedThreadRef } from "@t3tools/contracts";

import { withoutQuietBotWakes } from "./botThreads";
import { useIsBotThread } from "./useIsBotThread";

export function useWithoutQuietBotWakes(
  ref: ScopedThreadRef | null,
  items: ReadonlyArray<OrchestrationV2ProjectedTurnItem>,
): ReadonlyArray<OrchestrationV2ProjectedTurnItem> {
  const isBot = useIsBotThread(ref);
  // Its own statement so the compiler caches it: the timeline sets state when this identity changes.
  const visible = isBot ? withoutQuietBotWakes(items) : items;
  return visible;
}
