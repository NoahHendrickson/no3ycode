/**
 * Device-local split pairs, the floating thread and the docked thread — see
 * `.fork/customizations.yaml#fork-split-threads`.
 *
 * Both live on this client only: other devices and the mobile app show the
 * threads as ordinary separate cards.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { ScopedThreadRef, type ScopedProjectRef } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import type { DraftId } from "~/composerDraftStore";
import { resolveStorage } from "~/lib/storage";

import type { FloatFrame } from "./floatFrame";
import {
  DEFAULT_SPLIT_RATIO,
  findSplitPair,
  isSplitRatio,
  pairSplitThreads,
  resizeSplitPair,
  sameThread,
  unpairSplitThread,
  type SplitThreadPair,
} from "./splitThreadPairs";

/** Which route a pane's thread is shown on: an unsent draft has its own. */
export type PaneRoute =
  | { readonly kind: "server" }
  | { readonly kind: "draft"; readonly draftId: DraftId };

export interface RouteThread {
  readonly ref: ScopedThreadRef;
  readonly route: PaneRoute;
}

const routeKey = (route: PaneRoute) => (route.kind === "draft" ? route.draftId : "server");

interface SplitThreadStoreState {
  readonly pairs: readonly SplitThreadPair[];
  /** The thread floating over the chat column. Never also in a pair: floating
      a thread unpairs it, and pairing it (docking) lands it. */
  readonly floating: ScopedThreadRef | null;
  /** The floating window's last drag or resize, clamped into the column on render. */
  readonly floatFrame: FloatFrame | null;
  /** The route's thread now and the one before it, which is where the column
      goes when its own thread floats away. Not persisted. */
  readonly routeCurrent: RouteThread | null;
  readonly routePrevious: RouteThread | null;
  /** The route's thread, floating once the route has left it. Not persisted. */
  readonly pendingFloat: ScopedThreadRef | null;
  /** The thread docked as the column's right pane, kept there across every
      navigation until it is undocked. Outranks pairs while it is set. */
  readonly docked: ScopedThreadRef | null;
  /** The last other thread the route showed, which fills the left pane while
      the route is on the docked thread itself. */
  readonly dockLeft: ScopedThreadRef | null;
  /** The left pane's share of the column beside the docked thread. */
  readonly dockRatio: number | null;
  readonly pair: (a: ScopedThreadRef, b: ScopedThreadRef) => void;
  readonly unpair: (ref: ScopedThreadRef) => void;
  /** The left pane's share of the column for the pair holding `ref`. */
  readonly resize: (ref: ScopedThreadRef, ratio: number) => void;
  readonly float: (ref: ScopedThreadRef) => void;
  /** Floats the route's own thread when the route next arrives somewhere
      else. Until then it stays the column's thread, and the panes draw it
      floating from the render the route leaves it, so its ChatView and any
      window it replaces never drop out for a render. */
  readonly floatOnLeave: (ref: ScopedThreadRef) => void;
  readonly unfloat: () => void;
  readonly setFloatFrame: (frame: FloatFrame) => void;
  /** Docks `ref` on the right, with `left` beside it until the route moves. */
  readonly dock: (ref: ScopedThreadRef, left: ScopedThreadRef | null) => void;
  readonly undock: () => void;
  readonly resizeDock: (ratio: number) => void;
  /** A pane's thread is gone for good: drops its pair and its dock. */
  readonly forget: (ref: ScopedThreadRef) => void;
  /** The route reached `next`. A repeat of the current thread and route is a
      no-op, so callers may report every render. Arriving at the floated
      thread ends its float, so leaving it later does not pop it back up. */
  readonly arrive: (next: RouteThread) => void;
}

const isThreadRef = Schema.is(ScopedThreadRef);
const isPair = (value: unknown): value is SplitThreadPair => {
  const pair = value as SplitThreadPair | null;
  return (
    pair !== null &&
    typeof pair === "object" &&
    isThreadRef(pair.a) &&
    isThreadRef(pair.b) &&
    (pair.ratio === undefined || isSplitRatio(pair.ratio))
  );
};
const isFloatFrame = (value: unknown): value is FloatFrame => {
  const frame = value as Partial<FloatFrame> | null;
  return (
    frame !== null &&
    typeof frame === "object" &&
    [frame.x, frame.y, frame.width, frame.height].every(Number.isFinite)
  );
};

/** Persist writes after every set, and arrive() sets on each navigation
    without touching what is stored, so an unchanged payload is not rewritten. */
function skipUnchangedWrites(storage: StateStorage): StateStorage {
  return {
    getItem: (name) => storage.getItem(name),
    setItem: (name, value) => {
      if (storage.getItem(name) === value) return;
      return storage.setItem(name, value);
    },
    removeItem: (name) => storage.removeItem(name),
  };
}

export const useSplitThreadStore = create<SplitThreadStoreState>()(
  persist(
    (set) => ({
      pairs: [],
      floating: null,
      floatFrame: null,
      routeCurrent: null,
      routePrevious: null,
      pendingFloat: null,
      docked: null,
      dockLeft: null,
      dockRatio: null,
      pair: (a, b) =>
        set((state) => ({
          pairs: pairSplitThreads(state.pairs, a, b),
          floating:
            sameThread(state.floating, a) || sameThread(state.floating, b) ? null : state.floating,
          docked: sameThread(state.docked, a) || sameThread(state.docked, b) ? null : state.docked,
        })),
      unpair: (ref) => set((state) => ({ pairs: unpairSplitThread(state.pairs, ref) })),
      resize: (ref, ratio) => set((state) => ({ pairs: resizeSplitPair(state.pairs, ref, ratio) })),
      float: (ref) =>
        set((state) => ({
          floating: ref,
          pairs: unpairSplitThread(state.pairs, ref),
          docked: sameThread(state.docked, ref) ? null : state.docked,
          dockLeft: sameThread(state.dockLeft, ref) ? null : state.dockLeft,
        })),
      floatOnLeave: (ref) => set({ pendingFloat: ref }),
      unfloat: () => set({ floating: null }),
      setFloatFrame: (floatFrame) => set({ floatFrame }),
      dock: (ref, left) =>
        set((state) => ({
          docked: ref,
          dockLeft:
            left !== null && !sameThread(left, ref) && !sameThread(left, state.floating)
              ? left
              : null,
          pairs: unpairSplitThread(state.pairs, ref),
          floating: sameThread(state.floating, ref) ? null : state.floating,
        })),
      undock: () => set({ docked: null, dockLeft: null }),
      resizeDock: (ratio) => set({ dockRatio: isSplitRatio(ratio) ? ratio : null }),
      forget: (ref) =>
        set((state) => ({
          pairs: unpairSplitThread(state.pairs, ref),
          docked: sameThread(state.docked, ref) ? null : state.docked,
          dockLeft: sameThread(state.dockLeft, ref) ? null : state.dockLeft,
        })),
      arrive: (next) =>
        set((state) => {
          const current = state.routeCurrent;
          if (current !== null && sameThread(current.ref, next.ref)) {
            // A draft promoted on its route is the same visit, not a new one.
            return routeKey(current.route) === routeKey(next.route)
              ? state
              : { routeCurrent: next };
          }
          const lifted = state.pendingFloat;
          const floating =
            lifted !== null && !sameThread(lifted, next.ref)
              ? lifted
              : sameThread(state.floating, next.ref)
                ? null
                : state.floating;
          // Floating the docked thread undocks it, and a floated thread leaves the left pane.
          const docked = sameThread(state.docked, floating) ? null : state.docked;
          const dockLeft =
            docked === null ? null : !sameThread(docked, next.ref) ? next.ref : state.dockLeft;
          return {
            routeCurrent: next,
            routePrevious: current,
            pendingFloat: null,
            floating,
            pairs: floating === null ? state.pairs : unpairSplitThread(state.pairs, floating),
            docked,
            dockLeft: sameThread(dockLeft, floating) ? null : dockLeft,
          };
        }),
    }),
    {
      name: "t3code:fork:split-threads:v1",
      storage: createJSONStorage(() =>
        skipUnchangedWrites(
          resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
        ),
      ),
      version: 1,
      partialize: ({ pairs, floating, floatFrame, docked, dockLeft, dockRatio }) => ({
        pairs,
        floating,
        floatFrame,
        docked,
        dockLeft,
        dockRatio,
      }),
      merge: (persisted, current) => {
        const stored = persisted as {
          pairs?: unknown;
          floating?: unknown;
          floatFrame?: unknown;
          docked?: unknown;
          dockLeft?: unknown;
          dockRatio?: unknown;
        } | null;
        const docked = isThreadRef(stored?.docked) ? stored.docked : null;
        return {
          ...current,
          pairs: Array.isArray(stored?.pairs) ? stored.pairs.filter(isPair) : [],
          floating: isThreadRef(stored?.floating) ? stored.floating : null,
          floatFrame: isFloatFrame(stored?.floatFrame) ? stored.floatFrame : null,
          docked,
          dockLeft: docked !== null && isThreadRef(stored?.dockLeft) ? stored.dockLeft : null,
          dockRatio: isSplitRatio(stored?.dockRatio) ? stored.dockRatio : null,
        };
      },
    },
  ),
);

/** A "Split agent" click in flight: the thread it started from and the
    project its new draft is being minted in. handleNewThread navigates before
    it returns the draft's thread id, so without this the draft would render
    alone for a frame and then remount into the split. Not persisted. */
interface PendingSplit {
  readonly source: ScopedThreadRef;
  readonly projectRef: ScopedProjectRef;
}

export const usePendingSplitStore = create<{ readonly pending: PendingSplit | null }>()(() => ({
  pending: null,
}));

export interface SplitLayout {
  readonly left: ScopedThreadRef;
  readonly right: ScopedThreadRef;
  /** The left pane's share of the column. */
  readonly ratio: number;
  /** The right pane is the docked thread, not a pair. */
  readonly docked: boolean;
}

/** The docked thread on the right, beside the route's thread or, on the
    docked thread's own route, the last other thread it showed. */
export function resolveDockedLayout(
  docked: ScopedThreadRef,
  dockLeft: ScopedThreadRef | null,
  ratio: number,
  ref: ScopedThreadRef,
): SplitLayout | null {
  const left = sameThread(docked, ref) ? dockLeft : ref;
  return left === null || sameThread(left, docked)
    ? null
    : { left, right: docked, ratio, docked: true };
}

/** The two panes to show for the thread on screen, or null to show it alone.
    `draftProjectRef` is the project of the draft on screen (null on a server
    route): only a draft in the project a pending click is minting into joins
    its source while the click settles. */
export function useSplitLayout(
  ref: ScopedThreadRef | null,
  draftProjectRef: ScopedProjectRef | null,
): SplitLayout | null {
  const pair = useSplitThreadStore((state) =>
    ref === null ? null : findSplitPair(state.pairs, ref),
  );
  const pending = usePendingSplitStore((state) => state.pending);
  const docked = useSplitThreadStore((state) => state.docked);
  const dockLeft = useSplitThreadStore((state) => state.dockLeft);
  const dockRatio = useSplitThreadStore((state) => state.dockRatio) ?? DEFAULT_SPLIT_RATIO;
  if (ref === null) return null;
  if (docked !== null) return resolveDockedLayout(docked, dockLeft, dockRatio, ref);
  if (pair) {
    return { left: pair.a, right: pair.b, ratio: pair.ratio ?? DEFAULT_SPLIT_RATIO, docked: false };
  }
  if (
    pending !== null &&
    draftProjectRef !== null &&
    pending.projectRef.environmentId === draftProjectRef.environmentId &&
    pending.projectRef.projectId === draftProjectRef.projectId &&
    scopedThreadKey(pending.source) !== scopedThreadKey(ref)
  ) {
    return { left: pending.source, right: ref, ratio: DEFAULT_SPLIT_RATIO, docked: false };
  }
  return null;
}
