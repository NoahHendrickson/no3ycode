/**
 * The live status the no3y status sheet lists — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * The thread screen's status pill publishes it with its action closures, since a route cannot
 * take functions as params; the sheet reads it by thread key.
 */
import type { PendingBackgroundWorkItem } from "@t3tools/client-runtime/state/thread-execution";
import { useSyncExternalStore } from "react";

import type { FloatingStatusAction } from "../src/features/threads/floating-working-status";
import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";
import type { No3yPillStatus } from "./no3yPillStatus";

export interface No3yStatusOpener {
  readonly count: number;
  readonly onPress: () => void;
}

export interface No3yStatusSheetModel {
  readonly status: No3yPillStatus | null;
  readonly extension: { readonly label: string; readonly onPress: () => void } | null;
  readonly background: {
    readonly items: ReadonlyArray<PendingBackgroundWorkItem>;
    /** Stops every background task; only offered while nothing else is running. */
    readonly stop: FloatingStatusAction | null;
    readonly onOpenDetails: () => void;
  } | null;
  readonly subagents: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly mark: SidebarV2CardStatusKind | null;
  }>;
  readonly onOpenAgents: (() => void) | null;
  readonly childInputs: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly needs: "approval" | "input";
    readonly onOpen: () => void;
  }>;
  readonly queue: No3yStatusOpener | null;
  readonly devicePreview: No3yStatusOpener | null;
  readonly browserPreview: No3yStatusOpener | null;
}

const models = new Map<string, No3yStatusSheetModel>();
const listeners = new Set<() => void>();

export function publishNo3yStatusSheet(threadKey: string, model: No3yStatusSheetModel | null) {
  if (model === null) models.delete(threadKey);
  else models.set(threadKey, model);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNo3yStatusSheetModel(threadKey: string): No3yStatusSheetModel | null {
  return useSyncExternalStore(subscribe, () => models.get(threadKey) ?? null);
}
