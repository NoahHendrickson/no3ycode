/**
 * Fork sidebar glass — see `.fork/customizations.yaml#fork-cool-darker-sidebar-vibrancy`.
 *
 * Asks the desktop shell for the native window material and records what it
 * actually got. The renderer never assumes the glass turned on: the main process
 * resolves `false` where no material exists, as does a missing bridge, and only that resolved value
 * stamps the DOM marker. The CSS gate hangs off the marker rather than off the
 * palette, so a Linux or web client keeps solid fills instead of painting holes
 * into an opaque window.
 *
 * Two native modes exist:
 * - `"true"`: whole-window vibrancy (macOS < 26 `fullscreen-ui`, Windows 11
 *   acrylic, and the sidebar-less Side Chat window).
 * - `"liquid-glass"`: macOS 26+ AppKit `NSGlassEffectView` positioned strictly
 *   behind the docked sidebar while the chat stage stays opaque.
 *
 * This module imports nothing from `forkTheme`, on purpose. It used to, and
 * `forkTheme` imports it, so the cycle had to be worked around with functions
 * that deferred reading the constants until call time. Taking `enabled` as an
 * argument deletes the cycle instead of dodging it — and, more importantly,
 * stops this module guessing at palette-specific values it has no business
 * knowing. The window's opaque restore colour is resolved in the main process
 * from `nativeTheme`, because only it knows the theme being restored to.
 */

import { observeResize } from "~/lib/observeResize";

export const FORK_SIDEBAR_VIBRANCY_ATTRIBUTE = "data-fork-sidebar-vibrancy";
export const FORK_SIDEBAR_LIQUID_GLASS_VALUE = "liquid-glass";

export type ForkSidebarLiquidGlassRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly cornerRadius?: number;
  readonly docked?: boolean;
};

type ForkSidebarLiquidGlassBridge = {
  readonly isSupported: () => Promise<boolean>;
  readonly setRect: (rect: ForkSidebarLiquidGlassRect | null) => Promise<boolean>;
};

type ForkDesktopBridge = {
  readonly setSidebarVibrancy: (enabled: boolean) => Promise<boolean>;
  readonly sidebarLiquidGlass?: ForkSidebarLiquidGlassBridge;
};

/**
 * Read off `globalThis`, not `window`. In the renderer the two are the same
 * object; in a non-DOM test environment only `globalThis` exists, and reaching
 * for `window` there would make the helper silently untestable.
 */
function readBridge(): ForkDesktopBridge | null {
  const bridge = (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge;
  if (typeof bridge !== "object" || bridge === null) return null;
  const candidate = bridge as { setSidebarVibrancy?: unknown };
  return typeof candidate.setSidebarVibrancy === "function" ? (bridge as ForkDesktopBridge) : null;
}

function readLiquidGlassBridge(bridge: ForkDesktopBridge): ForkSidebarLiquidGlassBridge | null {
  const candidate = bridge.sidebarLiquidGlass;
  if (typeof candidate !== "object" || candidate === null) return null;
  return typeof candidate.isSupported === "function" && typeof candidate.setRect === "function"
    ? candidate
    : null;
}

function stampMarker(root: Element, mode: "off" | "vibrancy" | "liquid-glass"): void {
  if (mode === "vibrancy") {
    root.setAttribute(FORK_SIDEBAR_VIBRANCY_ATTRIBUTE, "true");
  } else if (mode === "liquid-glass") {
    root.setAttribute(FORK_SIDEBAR_VIBRANCY_ATTRIBUTE, FORK_SIDEBAR_LIQUID_GLASS_VALUE);
  } else {
    root.removeAttribute(FORK_SIDEBAR_VIBRANCY_ATTRIBUTE);
  }
}

/**
 * Whether whole-window glass is on right now, read from the marker rather than
 * from a sync's return value: a superseded sync still resolves with its own
 * answer, but only the newest one is allowed to stamp.
 *
 * Returns `false` in Liquid Glass mode because the stage is opaque there — the
 * floor-colour sampler and popup cutout must stay off.
 */
export function isForkSidebarVibrancyApplied(
  root: Element | null = typeof document === "undefined" ? null : document.documentElement,
): boolean {
  // The theme tests hand the palette sync a bare fake root with no reader.
  if (typeof root?.getAttribute !== "function") return false;
  return root.getAttribute(FORK_SIDEBAR_VIBRANCY_ATTRIBUTE) === "true";
}

/** Whether sidebar-only native Liquid Glass is active on the current window. */
export function isForkSidebarLiquidGlassApplied(
  root: Element | null = typeof document === "undefined" ? null : document.documentElement,
): boolean {
  if (typeof root?.getAttribute !== "function") return false;
  return root.getAttribute(FORK_SIDEBAR_VIBRANCY_ATTRIBUTE) === FORK_SIDEBAR_LIQUID_GLASS_VALUE;
}

/**
 * Measures the docked sidebar's live bounding rectangle in CSS pixels.
 * Uses `[data-slot="sidebar-gap"]` because its width is non-zero only when the
 * sidebar is docked beside the stage (collapsing or switching to narrow-window
 * overlay zeroes it, and drag-resizing updates it every frame).
 */
function readDockedSidebarGlassRect(
  doc: Document | null = typeof document === "undefined" ? null : document,
  viewportHeight: number = typeof window === "undefined" ? 0 : window.innerHeight,
): ForkSidebarLiquidGlassRect | null {
  if (doc === null || viewportHeight <= 0) return null;
  const wrapper = doc.querySelector<HTMLElement>('[data-slot="sidebar-wrapper"]');
  if (wrapper === null) return null;
  if (wrapper.getAttribute("data-fork-sidebar-overlay") === "true") return null;

  const gap = wrapper.querySelector<HTMLElement>('[data-slot="sidebar-gap"]');
  if (gap === null) return null;

  const rect = gap.getBoundingClientRect();
  const width = Math.round(rect.width);
  if (width <= 0) return null;

  return {
    x: Math.max(0, Math.round(rect.left)),
    y: 0,
    width,
    height: Math.round(viewportHeight),
    cornerRadius: 0,
    docked: true,
  };
}

let stopLiquidGlassTracking: (() => void) | null = null;

function rectKey(rect: ForkSidebarLiquidGlassRect | null): string {
  if (rect === null) return "null";
  return `${rect.x},${rect.y},${rect.width},${rect.height},${rect.cornerRadius ?? 0},${rect.docked ? 1 : 0}`;
}

function startLiquidGlassTracking(
  liquidGlass: ForkSidebarLiquidGlassBridge,
  root: Element,
  isStale: () => boolean,
): void {
  stopLiquidGlassTracking?.();
  stopLiquidGlassTracking = null;

  if (typeof document === "undefined" || typeof window === "undefined") {
    stampMarker(root, "liquid-glass");
    return;
  }

  let active = true;
  let lastAppliedKey: string | null = null;
  let inFlightKey: string | null = null;
  let pushId = 0;
  let observedGap: Element | null = null;
  let stopObservedGap: (() => void) | null = null;
  let rafId: number | null = null;

  const pushRect = () => {
    rafId = null;
    if (!active || isStale()) return;
    const rect = readDockedSidebarGlassRect(document, window.innerHeight);
    const key = rectKey(rect);
    if (key === lastAppliedKey || key === inFlightKey) return;
    inFlightKey = key;
    pushId += 1;
    const requestId = pushId;
    void liquidGlass
      .setRect(rect)
      .then((applied) => {
        if (!active || isStale() || requestId !== pushId) return;
        inFlightKey = null;
        if (applied) {
          lastAppliedKey = key;
          stampMarker(root, "liquid-glass");
        } else {
          lastAppliedKey = null;
          stampMarker(root, "off");
        }
      })
      .catch(() => {
        if (!active || isStale() || requestId !== pushId) return;
        inFlightKey = null;
        lastAppliedKey = null;
        stampMarker(root, "off");
      });
  };

  const schedulePush = () => {
    if (!active || isStale()) return;
    if (typeof window.requestAnimationFrame !== "function") {
      pushRect();
      return;
    }
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(pushRect);
  };

  const syncObservedGap = () => {
    const nextGap = document.querySelector('[data-slot="sidebar-gap"]');
    if (nextGap === observedGap) return;
    stopObservedGap?.();
    stopObservedGap = null;
    observedGap = nextGap;
    if (observedGap !== null) {
      stopObservedGap = observeResize(observedGap, schedulePush);
    }
  };

  const mutationObserver =
    typeof MutationObserver === "function"
      ? new MutationObserver(() => {
          syncObservedGap();
          schedulePush();
        })
      : null;

  syncObservedGap();
  if (mutationObserver !== null && document.body !== null) {
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-fork-sidebar-overlay", "data-sidebar-state", "data-state", "style"],
    });
  }
  window.addEventListener("resize", schedulePush);
  pushRect();

  stopLiquidGlassTracking = () => {
    active = false;
    if (rafId !== null && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    stopObservedGap?.();
    stopObservedGap = null;
    observedGap = null;
    mutationObserver?.disconnect();
    window.removeEventListener("resize", schedulePush);
  };
}

/**
 * Monotonic id for in-flight syncs. Palette changes fire this without awaiting,
 * so Glass → Dark → Glass can resolve out of order and stamp the
 * marker from a superseded request. Only the newest sync is allowed to write.
 */
let latestSyncId = 0;

/**
 * Asks the desktop shell to match `enabled`, then stamps the marker with the
 * result. Resolves with whether the glass is actually on.
 *
 * Clearing runs synchronously before the request so switching away from glass
 * never leaves a frame of transparent CSS over an already-opaque window — that
 * flash reads as the sidebar blinking black.
 */
export async function syncForkSidebarVibrancy(
  enabled: boolean,
  root: Element | null = typeof document === "undefined" ? null : document.documentElement,
): Promise<boolean> {
  if (root === null) return false;

  latestSyncId += 1;
  const syncId = latestSyncId;
  const isStale = () => syncId !== latestSyncId;

  if (!enabled) {
    stopLiquidGlassTracking?.();
    stopLiquidGlassTracking = null;
    stampMarker(root, "off");
  }

  const bridge = readBridge();
  if (bridge === null) {
    if (!isStale()) {
      stopLiquidGlassTracking?.();
      stopLiquidGlassTracking = null;
      stampMarker(root, "off");
    }
    return false;
  }

  let applied = false;
  try {
    applied = await bridge.setSidebarVibrancy(enabled);
  } catch {
    // A bridge that rejects (older shell, window already torn down) means no
    // glass. Falling through to the opaque marker keeps the sidebar readable.
    applied = false;
  }

  // A newer sync has already answered; this one's result describes a palette
  // the user has left.
  if (isStale()) return applied;

  if (!applied) {
    stopLiquidGlassTracking?.();
    stopLiquidGlassTracking = null;
    stampMarker(root, "off");
    return false;
  }

  const isSideChat =
    typeof root.getAttribute === "function" && root.getAttribute("data-fork-side-chat") === "true";
  const liquidGlass = isSideChat ? null : readLiquidGlassBridge(bridge);
  let useLiquidGlass = false;
  if (liquidGlass !== null) {
    try {
      useLiquidGlass = await liquidGlass.isSupported();
    } catch {
      useLiquidGlass = false;
    }
  }

  if (isStale()) return applied;

  if (useLiquidGlass && liquidGlass !== null) {
    startLiquidGlassTracking(liquidGlass, root, isStale);
  } else {
    stopLiquidGlassTracking?.();
    stopLiquidGlassTracking = null;
    stampMarker(root, "vibrancy");
  }
  return applied;
}
