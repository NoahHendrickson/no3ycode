/**
 * The split chat column — see `.fork/customizations.yaml#fork-split-threads`.
 *
 * ThreadRouteView hands every chat view through here, split or not, so the
 * route's ChatView keeps its tree position when a partner pane opens or
 * closes beside it. Outside a split both wrappers are `display: contents`.
 *
 * The route's thread arrives as ThreadRouteView's own element, so its
 * promotion and redirects stay upstream's; the slot latch (splitPaneSlots)
 * alone decides keys. Focus is a URL change: pressing into a pane navigates
 * to its thread (replace), so the right panel, sidebar highlight and global
 * shortcuts follow focus with no changes of their own.
 *
 * A floated thread is one more pane in its own slot, drawn as a window over
 * the column (floatWindow), so floating and docking move one ChatView between
 * layouts without remounting it. Pressing into it does not take the route,
 * only window-level input.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import {
  cloneElement,
  isValidElement,
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";

import ChatView from "~/components/ChatView";
import { useOpenThreadFamily } from "~/components/ThreadRouteView";
import type { ChatComposerHandle } from "~/components/chat/ChatComposer";
import { CollapsedThreadTabs } from "~/custom/CollapsedThreadTabs";
import { ComposerHandleContext, useComposerHandleContext } from "~/composerHandleContext";
import { useComposerDraftStore, type DraftId } from "~/composerDraftStore";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { useResizeDrag } from "~/hooks/useResizeDrag";
import { useStableCallback } from "~/hooks/useStableCallback";
import { useQuietThreadShell } from "~/state/entities";
import { useEnvironmentShellStatus } from "~/state/shell";
import { useEnvironmentThread } from "~/state/threads";
import {
  buildThreadRouteParams,
  isThreadRouteSnapshotAuthoritative,
  resolveThreadRouteRenderState,
} from "~/threadRoutes";

import { FLOAT_WINDOW_CLASS, useDockOnPanelOpen, useFloatWindow } from "./floatWindow";
import {
  SINGLE_PANE,
  SplitPaneContext,
  type PaneWindowAction,
  type SplitPaneState,
} from "./splitPaneContext";
import {
  EMPTY_SPLIT_PANE_SLOTS,
  assignSplitPaneSlots,
  type SplitPaneSlot,
  type SplitPaneSlots,
} from "./splitPaneSlots";
import { DEFAULT_SPLIT_RATIO, sameThread } from "./splitThreadPairs";
import { useSplitThreadStore, type PaneRoute, type SplitLayout } from "./splitThreadStore";

/** Below this the column is too narrow for two transcripts, so only the
    focused pane shows. The pair (or float) is kept and returns on a wider window. */
const SPLIT_THREADS_MIN_WIDTH_QUERY = "lg";

/** Neither pane drags or squeezes narrower than this, unless the column cannot fit two. */
const MIN_SPLIT_PANE_WIDTH = 360;
const SPLIT_PANE_MIN_WIDTH = `min(${MIN_SPLIT_PANE_WIDTH}px, 50%)`;

/** Each pane grows by its share of the column; the divider writes the share
    straight onto the row while it is dragged, so a drag renders nothing. */
const SPLIT_RATIO_VAR = "--fork-split-ratio";
const LEFT_PANE_GROW = `var(${SPLIT_RATIO_VAR})`;
const RIGHT_PANE_GROW = `calc(1 - var(${SPLIT_RATIO_VAR}))`;

/** The divider between a split's panes: drag it to share the column, double-click it to even the
    panes. The share is stored on release. */
function SplitResizeHandle(props: {
  readonly floatBehind: boolean;
  readonly onResize: (ratio: number) => void;
}) {
  const { ref, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture } =
    useResizeDrag<HTMLDivElement>((event) => {
      const handle = event.currentTarget;
      const row = handle.parentElement;
      if (row === null) return null;
      const style = getComputedStyle(handle);
      // The room the handle takes from the panes (Inlet lays it over a margin, so none).
      const handleSpace =
        handle.offsetWidth +
        Number.parseFloat(style.marginLeft) +
        Number.parseFloat(style.marginRight);
      const span = row.getBoundingClientRect().width - handleSpace;
      if (span <= 0) return null;
      const stored = Number.parseFloat(row.style.getPropertyValue(SPLIT_RATIO_VAR));
      const startRatio = Number.isFinite(stored) ? stored : DEFAULT_SPLIT_RATIO;
      const min = Math.min(span * DEFAULT_SPLIT_RATIO, MIN_SPLIT_PANE_WIDTH);
      handle.dataset.dragging = "";
      return {
        width: startRatio * span,
        edge: "right",
        bounds: { min, max: span - min },
        resize(leftWidth) {
          row.style.setProperty(SPLIT_RATIO_VAR, String(leftWidth / span));
          return leftWidth;
        },
        // A press that never travelled (a click, half a double-click) keeps the stored share.
        finish(leftWidth, moved) {
          if (moved) props.onResize(leftWidth / span);
          else row.style.setProperty(SPLIT_RATIO_VAR, String(startRatio));
        },
        cleanup(committed) {
          delete handle.dataset.dragging;
          if (!committed) row.style.setProperty(SPLIT_RATIO_VAR, String(startRatio));
        },
      };
    });
  return (
    <div
      aria-hidden
      ref={ref}
      // Themes that frame each pane on its own card hide the line and keep the handle.
      data-fork-split-divider=""
      data-fork-float-behind={props.floatBehind || undefined}
      className="relative z-20 order-1 w-px shrink-0 cursor-col-resize touch-none bg-border select-none before:absolute before:inset-y-0 before:-inset-x-1 before:content-[''] hover:bg-ring/60 data-dragging:bg-ring"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
      onDoubleClick={() => props.onResize(DEFAULT_SPLIT_RATIO)}
    />
  );
}

/** What a pane shows for a thread that is not the route's. Existence is upstream's rule
    (resolveThreadRouteRenderState); the route is the pane's own: an unsent draft until its
    promoted thread has started. Null while it loads. */
function usePaneRoute(ref: ScopedThreadRef | null): {
  readonly route: PaneRoute | null;
  readonly missing: boolean;
} {
  const shell = useQuietThreadShell(ref);
  const draftId = useComposerDraftStore((store) =>
    ref === null ? null : store.getDraftIdByRef(ref),
  );
  const shellStatus = useEnvironmentShellStatus(ref?.environmentId ?? null);
  const unlistedRef = shell === null && draftId === null ? ref : null;
  const unlistedThreadDetail = useEnvironmentThread(
    unlistedRef?.environmentId ?? null,
    unlistedRef?.threadId ?? null,
  );
  const bootstrapComplete = isThreadRouteSnapshotAuthoritative(shellStatus);
  useOpenThreadFamily(ref, bootstrapComplete && unlistedRef !== null);
  if (ref === null) return { route: null, missing: false };
  const renderState = resolveThreadRouteRenderState({
    bootstrapComplete,
    serverThreadExists: shell !== null,
    serverThreadDeleted: shell?.deletedAt != null,
    unlistedThreadDetail,
    draftThreadExists: draftId !== null,
  });
  // Upstream dropped threadShellHasStarted; a draft stays one until its first run.
  const shellStarted =
    shell != null &&
    (shell.latestRun !== null || shell.latestUserMessageAt !== null || shell.runtime !== null);
  if (draftId !== null && !shellStarted) {
    return { route: { kind: "draft", draftId }, missing: false };
  }
  if (renderState !== "ready" && !(renderState === "loading" && shell !== null)) {
    return { route: null, missing: renderState === "missing" };
  }
  return { route: SERVER_ROUTE, missing: false };
}

const SERVER_ROUTE: PaneRoute = { kind: "server" };

/** Keys are left to the slot latch (splitPaneSlots). */
function paneView(
  environmentId: EnvironmentId,
  threadId: ThreadId,
  draftId: DraftId | null,
): ReactNode {
  return draftId !== null ? (
    <ChatView
      draftId={draftId}
      environmentId={environmentId}
      threadId={threadId}
      routeKind="draft"
      forceExpandedMobileComposer
    />
  ) : (
    <ChatView environmentId={environmentId} threadId={threadId} routeKind="server" />
  );
}

/** An unkeyed view gets one fixed key, so upstream's reuse of a single
    ChatView across server threads is unchanged while a key can be latched. */
const UNKEYED_VIEW = "chat-view";

const NO_PANE_THREADS: readonly ScopedThreadRef[] = [];

/** The slot is the pane's identity; see splitPaneSlots. */
const PANE_SLOT_KEYS = ["slot-a", "slot-b", "slot-c"] as const;

function viewKey(view: ReactNode): string | null {
  return isValidElement(view) ? (view.key ?? UNKEYED_VIEW) : null;
}

/** A pane's view key before its view is built: paneView's views carry none. */
function paneViewKey(route: PaneRoute | null): string | null {
  return route === null ? null : UNKEYED_VIEW;
}

type ComposerRef = RefObject<ChatComposerHandle | null>;

/** Puts a pane's thread on the route (replace): how focus moves between panes. */
function navigateToPane(
  navigate: ReturnType<typeof useNavigate>,
  threadRef: ScopedThreadRef,
  route: PaneRoute,
): Promise<void> {
  return route.kind === "draft"
    ? navigate({ to: "/draft/$draftId", params: { draftId: route.draftId }, replace: true })
    : navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(threadRef),
        replace: true,
      });
}

/** Controls that act on their own pane (close, float) must not first focus it. */
const PANE_ACTION_SELECTOR = "[data-split-pane-action]";

/** The pane's context and ChatView behind a memo boundary. Every prop is a primitive, a
    stable callback or a view that keeps its identity, so the context value and the ChatView
    under it change only when one of them does, not on every render of the panes. */
const SplitPaneBody = memo(function SplitPaneBody(props: {
  readonly split: boolean;
  readonly focused: boolean;
  readonly leading: boolean;
  readonly canSplit: boolean;
  readonly floating: boolean;
  readonly windowActionKind: PaneWindowAction["kind"] | null;
  readonly focusPartner: () => Promise<boolean>;
  readonly runWindowAction: () => void;
  readonly composerRef: ComposerRef;
  /** The route's own view; null for a pane that shows its thread through paneView. */
  readonly routeView: ReactNode;
  readonly environmentId: EnvironmentId | null;
  readonly threadId: ThreadId | null;
  readonly draftId: DraftId | null;
  readonly elementKey: string | null;
}) {
  const { split, focused, leading, canSplit, floating, focusPartner } = props;
  const { windowActionKind, routeView, environmentId, threadId, elementKey } = props;
  const windowAction =
    windowActionKind === null ? null : { kind: windowActionKind, run: props.runWindowAction };
  const state: SplitPaneState = {
    split,
    focused,
    leading,
    canSplit,
    floating,
    focusPartner,
    windowAction,
  };
  const view =
    routeView ??
    (environmentId === null || threadId === null
      ? null
      : paneView(environmentId, threadId, props.draftId));
  const child =
    isValidElement(view) && elementKey !== null ? cloneElement(view, { key: elementKey }) : view;
  return (
    <ComposerHandleContext value={props.composerRef}>
      <SplitPaneContext.Provider value={state}>{child}</SplitPaneContext.Provider>
    </ComposerHandleContext>
  );
});

function SplitPane(props: {
  readonly state: SplitPaneState;
  /** CSS order: left and right are drawn, not slotted. */
  readonly order: number;
  /** Its share of a split's column (flex-grow). */
  readonly grow: string;
  readonly composerRef: ComposerRef;
  /** A column pane while a window floats over it: it gets a box of its own,
      as a split pane does, so the hole under the window has one to cut. */
  readonly behindFloat: boolean;
  /** A press or focus coming into the pane, before its target sees it. */
  readonly onEnter: (() => void) | null;
  readonly routeView: ReactNode;
  readonly paneRef: ScopedThreadRef | null;
  readonly paneRoute: PaneRoute | null;
  readonly elementKey: string | null;
}) {
  const { state, onEnter, paneRef, paneRoute } = props;
  // The parent rebuilds these closures every render; the body gets one identity that calls the latest.
  const focusPartner = useStableCallback(() => state.focusPartner());
  const runWindowAction = useStableCallback(() => state.windowAction?.run());
  const {
    setElement: setFloatElement,
    style: floatStyle,
    onPointerDown: onFloatPointerDown,
    resizeHandles,
  } = useFloatWindow(state.floating);
  const enter =
    onEnter === null
      ? undefined
      : (event: SyntheticEvent) => {
          if (event.target instanceof Element && event.target.closest(PANE_ACTION_SELECTOR)) return;
          onEnter();
        };
  return (
    <div
      ref={setFloatElement}
      data-fork-split-pane={
        state.floating
          ? "floating"
          : state.split
            ? state.focused
              ? "focused"
              : "background"
            : undefined
      }
      // The floating window's look (Glass: theme.custom.palettes.css, the
      // rest: theme.custom.css) and its header's drag strip live in CSS.
      data-fork-float-behind={props.behindFloat || undefined}
      data-fork-split-side={state.split ? (state.leading ? "left" : "right") : undefined}
      // Workspace focus finds areas by name, and every pane has a "composer". Focus that drops
      // (a dictation freezing the editor) must not recover into a pane that would take the route.
      data-workspace-unavailable={state.focused ? undefined : "true"}
      // Layout containment makes the pane the containing block for ChatView's
      // fixed-position pieces (the header's panel toggles, the Glass frost),
      // so each pane's sit on that pane rather than both on the window.
      className={
        state.floating
          ? FLOAT_WINDOW_CLASS
          : state.split || props.behindFloat
            ? "relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col [contain:layout]"
            : "contents"
      }
      style={
        state.floating
          ? floatStyle
          : state.split
            ? { order: props.order, flexGrow: props.grow, minWidth: SPLIT_PANE_MIN_WIDTH }
            : undefined
      }
      onPointerDown={state.floating ? onFloatPointerDown : undefined}
      onPointerDownCapture={enter}
      onFocusCapture={enter}
    >
      <SplitPaneBody
        split={state.split}
        focused={state.focused}
        leading={state.leading}
        canSplit={state.canSplit}
        floating={state.floating}
        windowActionKind={state.windowAction?.kind ?? null}
        focusPartner={focusPartner}
        runWindowAction={runWindowAction}
        composerRef={props.composerRef}
        routeView={props.routeView}
        environmentId={paneRoute === null ? null : (paneRef?.environmentId ?? null)}
        threadId={paneRoute === null ? null : (paneRef?.threadId ?? null)}
        draftId={paneRoute?.kind === "draft" ? paneRoute.draftId : null}
        elementKey={props.elementKey}
      />
      {state.floating ? resizeHandles : null}
    </div>
  );
}

export function SplitThreadPanes(props: {
  readonly layout: SplitLayout | null;
  readonly focusedRef: ScopedThreadRef | null;
  /** The route's draft, or null on a thread's own route. */
  readonly focusedDraftId: DraftId | null;
  readonly focusedView: ReactNode;
}) {
  const { layout, focusedRef, focusedDraftId, focusedView } = props;
  const wide = useMediaQuery(SPLIT_THREADS_MIN_WIDTH_QUERY);
  const navigate = useNavigate();
  // ChatView takes its composer handle from the command palette's context, so
  // two panes sharing it would send, attach and focus through whichever
  // composer mounted last. Each slot gives its ChatView a ref of its own that
  // never changes (a send holds it across awaits), and the palette, which only
  // reads its ref, is pointed once at whichever slot is focused.
  const paletteComposerRef = useComposerHandleContext();
  // One statement per ref: React Compiler caches an array literal on first
  // render, hook calls and all, so later renders would skip the useRefs.
  const firstSlotComposerRef = useRef<ChatComposerHandle | null>(null);
  const secondSlotComposerRef = useRef<ChatComposerHandle | null>(null);
  const thirdSlotComposerRef = useRef<ChatComposerHandle | null>(null);
  const slotComposerRefs = [firstSlotComposerRef, secondSlotComposerRef, thirdSlotComposerRef];
  const focusedSlotRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (paletteComposerRef === null) return;
    const refs = slotComposerRefs;
    // A write from outside the panes is kept, and read when no slot is focused.
    let assigned = paletteComposerRef.current;
    Object.defineProperty(paletteComposerRef, "current", {
      configurable: true,
      get: () => {
        const slot = focusedSlotRef.current;
        return (slot === null ? null : refs[slot]?.current) ?? assigned;
      },
      set: (value: ChatComposerHandle | null) => {
        assigned = value;
      },
    });
    return () => {
      Object.defineProperty(paletteComposerRef, "current", {
        configurable: true,
        writable: true,
        value: assigned,
      });
    };
    // The slot refs are stable for this component's life.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [paletteComposerRef]);

  const focusedKey = focusedRef === null ? null : scopedThreadKey(focusedRef);
  const focusedRoute: PaneRoute =
    focusedDraftId === null ? SERVER_ROUTE : { kind: "draft", draftId: focusedDraftId };
  const arrive = useSplitThreadStore((state) => state.arrive);
  // A draft's route ref is rebuilt every render; arrive ignores a repeat.
  useEffect(() => {
    if (focusedRef === null) return;
    arrive({
      ref: focusedRef,
      route: focusedDraftId === null ? SERVER_ROUTE : { kind: "draft", draftId: focusedDraftId },
    });
  }, [arrive, focusedRef, focusedDraftId]);

  const split = layout !== null && focusedRef !== null && wide;
  const leftFocused = !split || scopedThreadKey(layout.left) === scopedThreadKey(focusedRef);
  const partnerRef = !split ? null : leftFocused ? layout.right : layout.left;
  const partner = usePaneRoute(partnerRef);

  const storedFloatingRef = useSplitThreadStore((state) => state.floating);
  const pendingFloat = useSplitThreadStore((state) => state.pendingFloat);
  // The route's thread floats from the render the route leaves it, before
  // the arrival is stored; see floatOnLeave.
  const floatingRef =
    pendingFloat !== null && !sameThread(pendingFloat, focusedRef)
      ? pendingFloat
      : storedFloatingRef;
  const floatShown =
    wide &&
    focusedRef !== null &&
    floatingRef !== null &&
    !sameThread(floatingRef, focusedRef) &&
    !sameThread(floatingRef, partnerRef);
  const floating = usePaneRoute(floatShown ? floatingRef : null);
  const floatingKey = floatShown ? scopedThreadKey(floatingRef) : null;

  // Where the column goes when its own thread floats away, if it still exists.
  const routePrevious = useSplitThreadStore((state) => state.routePrevious);
  const behindRef =
    wide && !split && routePrevious !== null && !sameThread(routePrevious.ref, focusedRef)
      ? routePrevious.ref
      : null;
  const behind = usePaneRoute(behindRef);

  // A pane gone for good (deleted, or a discarded draft) dissolves its pair,
  // and a floated one closes its window. "missing" waits for the
  // environment's snapshot, so a cold start does not mistake "not loaded
  // yet" for "gone".
  const partnerMissing = partner.missing;
  const floatingMissing = floating.missing;
  const unpair = useSplitThreadStore((state) => state.unpair);
  const resize = useSplitThreadStore((state) => state.resize);
  const pair = useSplitThreadStore((state) => state.pair);
  const floatThread = useSplitThreadStore((state) => state.float);
  const floatOnLeave = useSplitThreadStore((state) => state.floatOnLeave);
  const unfloat = useSplitThreadStore((state) => state.unfloat);
  useEffect(() => {
    if (partnerMissing && partnerRef !== null) unpair(partnerRef);
  }, [partnerMissing, partnerRef, unpair]);
  useEffect(() => {
    if (floatingMissing) unfloat();
  }, [floatingMissing, unfloat]);

  // A press in the floating window gives it window-level input until a press
  // back in the column, or until either side changes thread.
  const [floatInput, setFloatInput] = useState<{
    readonly floatKey: string;
    readonly routeKey: string;
  } | null>(null);
  const floatOwnsInput =
    floatingKey !== null &&
    floatInput?.floatKey === floatingKey &&
    floatInput.routeKey === focusedKey;
  const floatRoute = floating.route;
  // A window that owns input keeps it once docked: an unfocused pane is skipped by
  // workspace focus, so its panel or composer would never get focus back.
  const dockFloat =
    floatShown && focusedRef !== null && floatingRef !== null
      ? () => {
          pair(focusedRef, floatingRef);
          if (floatOwnsInput && floatRoute !== null)
            void navigateToPane(navigate, floatingRef, floatRoute);
        }
      : null;
  useDockOnPanelOpen(floatOwnsInput ? floatingRef : null, () => dockFloat?.());

  /** Floating a started pane's thread (a draft's promotion runs on its
      route, which the window never holds). The background pane of a split
      floats at once. The route's own thread floats once the route has moved
      to the split partner, or alone, back to the previous thread. */
  const floatAction = (
    paneRef: ScopedThreadRef | null,
    paneRoute: PaneRoute | null,
    holdsRoute: boolean,
  ): PaneWindowAction | null => {
    if (!wide || paneRef === null || paneRoute?.kind !== "server") return null;
    if (split && !holdsRoute) return { kind: "float", run: () => floatThread(paneRef) };
    const [targetRef, targetRoute] = split
      ? [partnerRef, partner.route]
      : [behindRef, behind.route];
    if (targetRef === null || targetRoute === null) return null;
    return {
      kind: "float",
      run: () => {
        floatOnLeave(paneRef);
        void navigateToPane(navigate, targetRef, targetRoute);
      },
    };
  };

  const shown: SplitPaneSlot[] = [];
  if (focusedKey !== null) shown.push({ threadKey: focusedKey, elementKey: viewKey(focusedView) });
  if (partnerRef !== null) {
    shown.push({ threadKey: scopedThreadKey(partnerRef), elementKey: paneViewKey(partner.route) });
  }
  if (floatingKey !== null) {
    shown.push({ threadKey: floatingKey, elementKey: paneViewKey(floating.route) });
  }
  const [previousSlots, setSlots] = useState<SplitPaneSlots>(EMPTY_SPLIT_PANE_SLOTS);
  const slots = assignSplitPaneSlots(previousSlots, shown);
  if (slots !== previousSlots) setSlots(slots);
  const inputKey = floatOwnsInput ? floatingKey : focusedKey;
  const inputSlot = slots.findIndex((slot) => slot !== null && slot.threadKey === inputKey);
  useLayoutEffect(() => {
    focusedSlotRef.current = inputSlot === -1 ? null : inputSlot;
  }, [inputSlot]);

  const panes = slots.map((slot, index) => {
    if (slot === null) return null;
    const holdsRoute = slot.threadKey === focusedKey;
    const isFloating = !holdsRoute && slot.threadKey === floatingKey;
    const paneRef = holdsRoute ? focusedRef : isFloating ? floatingRef : partnerRef;
    const left = !split || slot.threadKey === scopedThreadKey(layout.left);
    let state: SplitPaneState;
    let onEnter: (() => void) | null;
    if (isFloating) {
      state = {
        ...SINGLE_PANE,
        focused: floatOwnsInput,
        leading: false,
        floating: true,
        windowAction: dockFloat === null ? null : { kind: "dock", run: dockFloat },
      };
      onEnter =
        floatOwnsInput || floatingKey === null || focusedKey === null
          ? null
          : () => setFloatInput({ floatKey: floatingKey, routeKey: focusedKey });
    } else {
      const focused = holdsRoute && !floatOwnsInput;
      const paneRoute = holdsRoute ? focusedRoute : partner.route;
      const windowAction = floatAction(paneRef, paneRoute, holdsRoute);
      state = split
        ? {
            ...SINGLE_PANE,
            split: true,
            focused,
            leading: left,
            canSplit: true,
            focusPartner: async () => {
              if (!holdsRoute) return true;
              if (partnerRef === null || partner.route === null) return false;
              await navigateToPane(navigate, partnerRef, partner.route);
              return true;
            },
            windowAction,
          }
        : { ...SINGLE_PANE, focused, canSplit: wide, windowAction };
      onEnter = !holdsRoute
        ? paneRef === null || paneRoute === null
          ? null
          : () => void navigateToPane(navigate, paneRef, paneRoute)
        : floatOwnsInput
          ? () => setFloatInput(null)
          : null;
    }
    return (
      <SplitPane
        key={PANE_SLOT_KEYS[index]}
        state={state}
        order={left ? 0 : 2}
        grow={left ? LEFT_PANE_GROW : RIGHT_PANE_GROW}
        composerRef={slotComposerRefs[index] ?? firstSlotComposerRef}
        behindFloat={floatShown && !isFloating}
        onEnter={onEnter}
        routeView={holdsRoute ? focusedView : null}
        paneRef={holdsRoute ? null : paneRef}
        paneRoute={holdsRoute ? null : isFloating ? floating.route : partner.route}
        elementKey={slot.elementKey}
      />
    );
  });
  return (
    <>
      {/* Above every pane, so a split's panes and the stage cards start level under it. */}
      <CollapsedThreadTabs paneThreadRefs={split ? [layout.left, layout.right] : NO_PANE_THREADS} />
      <div
        data-fork-thread-panes=""
        data-fork-split-threads={split ? "" : undefined}
        className={split ? "flex min-h-0 flex-1 flex-row" : "contents"}
        style={split ? ({ [SPLIT_RATIO_VAR]: layout.ratio } as CSSProperties) : undefined}
      >
        {panes}
        {split ? (
          <SplitResizeHandle
            floatBehind={floatShown}
            onResize={(ratio) => resize(layout.left, ratio)}
          />
        ) : null}
      </div>
    </>
  );
}
