/** Runs a rules refresh once a session for each listed Petal or sprint — see
    `.fork/customizations.yaml#fork-bot-rules-refresh` and `#fork-sprint-rules-refresh`. */
import { RegistryContext } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import type { AtomRegistry } from "effect/reactivity";
import { useContext, useEffect } from "react";

/** Folders this session refreshed, found current, or is refreshing now. */
const checked = new Set<string>();
/** When a folder's last attempt failed. A connection still coming up fails once and is retried;
    a client that cannot read or write the host's files keeps failing, once a minute at most. */
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 60_000;

/** `refresh` resolves to whether it wrote anything, or is null for an item that cannot be
    refreshed yet (no folder, or what it needs has not loaded); that item waits for a later render. */
export function useRefreshFolderRules<
  Item extends { readonly environmentId: EnvironmentId; readonly id: string },
>(
  items: ReadonlyArray<Item>,
  refresh: (item: Item, registry: AtomRegistry.AtomRegistry) => Promise<boolean> | null,
): void {
  const registry = useContext(RegistryContext);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- writes the listed folders' rule files on their host, once per folder per session unless it failed
  useEffect(() => {
    for (const item of items) {
      const key = `${item.environmentId}:${item.id}`;
      if (checked.has(key)) continue;
      if (Date.now() - (failedAt.get(key) ?? -Infinity) < RETRY_AFTER_MS) continue;
      const running = refresh(item, registry);
      if (running === null) continue;
      checked.add(key);
      void running.catch(() => {
        checked.delete(key);
        failedAt.set(key, Date.now());
      });
    }
  }, [items, refresh, registry]);
}
