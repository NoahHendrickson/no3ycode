/**
 * The no3y thread pill's status — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * Upstream moved working, compacting, background work and snooze/settle into the feed; the
 * Mac-style pill keeps them, rebuilt here in the pill's old order from what upstream still computes.
 * Syncing is not here: upstream shows it in the thread header, which the no3y header keeps.
 */
import type { EnvironmentConnectionPhase } from "@t3tools/client-runtime/connection";

import type {
  FloatingStatusAction,
  FloatingWorkingStatus,
} from "../src/features/threads/floating-working-status";

type UpstreamConnection = Extract<FloatingWorkingStatus, { readonly kind: "connection" }>;

export type No3yPillStatus =
  | Exclude<FloatingWorkingStatus, { readonly kind: "connection" }>
  | (UpstreamConnection & { readonly tone: "reconnecting" | "unavailable" })
  | { readonly kind: "working"; readonly startedAt: string }
  | { readonly kind: "compacting" }
  | {
      readonly kind: "background";
      readonly label: string;
      readonly accessibilityLabel: string;
      readonly waiting: boolean;
      readonly onPress: () => void;
      readonly action: FloatingStatusAction;
    }
  | {
      readonly kind: "lifecycle";
      readonly state: "snoozed" | "settled" | "woke";
      readonly label: string;
      readonly action: FloatingStatusAction;
    };

export interface No3yPillStatusInput {
  readonly upstream: FloatingWorkingStatus | null;
  readonly connectionState: EnvironmentConnectionPhase;
  /** False while a pending request, a thread start or a failed start owns the slot. */
  readonly open: boolean;
  readonly compacting: boolean;
  readonly workingSince: string | null;
  readonly background: Omit<Extract<No3yPillStatus, { kind: "background" }>, "kind"> | null;
  readonly lifecycle: Omit<Extract<No3yPillStatus, { kind: "lifecycle" }>, "kind"> | null;
}

/** The feed's closing status lines, which the pill carries instead. */
export const NO3Y_NO_STATUS_LINES: ReadonlyArray<never> = [];

export function no3yPillStatus(input: No3yPillStatusInput): No3yPillStatus | null {
  const { upstream } = input;
  if (upstream?.kind === "connection") {
    const retrying =
      input.connectionState === "connecting" || input.connectionState === "reconnecting";
    return { ...upstream, tone: retrying ? "reconnecting" : "unavailable" };
  }
  if (upstream?.kind === "stop" || upstream?.kind === "preparing") return upstream;
  if (!input.open) return null;
  if (upstream?.kind === "child-input") return upstream;
  if (input.compacting) return { kind: "compacting" };
  if (input.workingSince !== null) return { kind: "working", startedAt: input.workingSince };
  if (input.background !== null) return { kind: "background", ...input.background };
  if (input.lifecycle !== null) return { kind: "lifecycle", ...input.lifecycle };
  return upstream;
}
