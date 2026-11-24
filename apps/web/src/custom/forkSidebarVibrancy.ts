/**
 * Fork sidebar glass — see `.fork/customizations.yaml#fork-cool-darker-sidebar-vibrancy`.
 *
 * Asks the desktop shell for the native window material and stamps what it
 * actually got (`"off"`, `"vibrancy"`, or `"liquid-glass"`). Main decides the
 * mode in one round trip so the renderer never disagrees with Electron about
 * whether whole-window vibrancy or macOS 26+ sidebar Liquid Glass is active.
 */

import { observeResize } from "~/lib/observeResize";

import { FORK_GLASS_3D_ATTRIBUTE } from "./forkGlass3d";

export const FORK_SIDEBAR_VIBRANCY_ATTRIBUTE = "data-fork-sidebar-vibrancy";
export const FORK_SIDEBAR_LIQUID_GLASS_VALUE = "liquid-glass";

const FULL_GLASS_BACKING_RGB = 0x141618;
const FLAT_GLASS_BACKING_RGB = 0x1d1d1e;
const THREAD_TABS_STAMP = "data-fork-has-thread-tabs";

export type ForkSidebarVibrancyMode = "off" | "vibrancy" | "liquid-glass";

/** CSS px: the docked sidebar's column runs the window's full height; a `height` makes it a band
    that tall along the window's top. Mirrors apps/desktop/src/fork/ForkLiquidGlass.ts. */
type SidebarGlassFrame = { readonly width: number; readonly height?: number };

type ForkSidebarLiquidGlassBridge = {
  readonly setFrame: (frame: SidebarGlassFrame | null, backing: number) => Promise<boolean>;
};

type ForkDesktopBridge = {
  readonly setSidebarVibrancy: (enabled: boolean) => Promise<ForkSidebarVibrancyMode | boolean>;
  readonly sidebarLiquidGlass?: unknown;
};

function readBridge(): ForkDesktopBridge | null {
  const bridge = (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge;
  if (typeof bridge !== "object" || bridge === null) return null;
  const candidate = bridge as { setSidebarVibrancy?: unknown };
  return typeof candidate.setSidebarVibrancy === "function" ? (bridge as ForkDesktopBridge) : null;
}

function readLiquidGlassBridge(bridge: ForkDesktopBridge): ForkSidebarLiquidGlassBridge | null {
  const candidate = bridge.sidebarLiquidGlass;
  if (typeof candidate !== "object" || candidate === null) return null;
  const lg = candidate as { setFrame?: unknown };
  return typeof lg.setFrame === "function" ? (candidate as ForkSidebarLiquidGlassBridge) : null;
}

function normalizeVibrancyMode(value: ForkSidebarVibrancyMode | boolean): ForkSidebarVibrancyMode {
  if (value === "liquid-glass") return "liquid-glass";
  if (value === "vibrancy" || value === true) return "vibrancy";
  return "off";
}

function stampMarker(root: Element, mode: ForkSidebarVibrancyMode): void {
  if (mode === "liquid-glass") {
    root.setAttribute(FORK_SIDEBAR_VIBRANCY_ATTRIBUTE, FORK_SIDEBAR_LIQUID_GLASS_VALUE);
  } else if (mode === "vibrancy") {
    root.setAttribute(FORK_SIDEBAR_VIBRANCY_ATTRIBUTE, "true");
  } else {
    root.removeAttribute(FORK_SIDEBAR_VIBRANCY_ATTRIBUTE);
  }
}

/** Whether whole-window desktop vibrancy is active on the current window. */
export function isForkSidebarVibrancyApplied(
  root: Element | null = typeof document === "undefined" ? null : document.documentElement,
): boolean {
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

function readDockedSidebarGlassWidth(
  doc: Document | null = typeof document === "undefined" ? null : document,
): number | null {
  if (doc === null) return null;
  const wrapper = doc.querySelector<HTMLElement>('[data-slot="sidebar-wrapper"]');
  if (wrapper === null) return null;
  if (wrapper.getAttribute("data-fork-sidebar-overlay") === "true") return null;

  const gap = wrapper.querySelector<HTMLElement>('[data-slot="sidebar-gap"]');
  if (gap === null) return null;

  const width = Math.round(gap.getBoundingClientRect().width);
  return width > 0 ? width : null;
}

/** On Flat Glass the collapsed sidebar's tab row (fork-collapsed-thread-tabs) is the window's
    titlebar, so the glass is a band behind the row alone: full height, it would cover the new
    agent screen's native picture and cards. */
function readThreadTabsGlass(doc: Document | null, root: Element): SidebarGlassFrame | null {
  if (doc === null || typeof root.getAttribute !== "function") return null;
  if (root.getAttribute(FORK_GLASS_3D_ATTRIBUTE) !== "off") return null;
  if (root.getAttribute(THREAD_TABS_STAMP) === null) return null;
  const strip = doc.querySelector<HTMLElement>("[data-fork-thread-tabs]");
  if (strip === null) return null;
  const rect = strip.getBoundingClientRect();
  const width = Math.round(rect.right);
  const height = Math.round(rect.bottom);
  return width > 0 && height > 0 ? { width, height } : null;
}

/** The docked sidebar first: the tab row mounts as a collapse starts, and the sidebar keeps
    its glass until the gap's slide-out ends. */
function readSidebarGlass(root: Element): SidebarGlassFrame | null {
  const doc = typeof document === "undefined" ? null : document;
  const width = readDockedSidebarGlassWidth(doc);
  return width === null ? readThreadTabsGlass(doc, root) : { width };
}

function readLiquidGlassBackingRgb(root: Element): number {
  if (typeof root.getAttribute !== "function") return FULL_GLASS_BACKING_RGB;
  return root.getAttribute(FORK_GLASS_3D_ATTRIBUTE) === "off"
    ? FLAT_GLASS_BACKING_RGB
    : FULL_GLASS_BACKING_RGB;
}

let stopLiquidGlassTracking: (() => void) | null = null;

function stopTracking(): void {
  stopLiquidGlassTracking?.();
  stopLiquidGlassTracking = null;
}

/** Main converts CSS px to points with the zoom factor, so a zoom change (which moves
    devicePixelRatio) has to re-send an unchanged CSS width. */
function frameKey(frame: SidebarGlassFrame | null, backing: number): string {
  return frame === null
    ? "null"
    : `${frame.width}x${frame.height ?? "full"}:${backing}:${window.devicePixelRatio}`;
}

function startLiquidGlassTracking(
  liquidGlass: ForkSidebarLiquidGlassBridge,
  root: Element,
  isStale: () => boolean,
): void {
  stopTracking();

  if (typeof document === "undefined" || typeof window === "undefined") {
    stampMarker(root, "liquid-glass");
    return;
  }

  let active = true;
  let lastAppliedKey: string | null = null;
  let inFlight = false;
  let observedWrapper: Element | null = null;
  let observedGap: Element | null = null;
  let stopObservedGap: (() => void) | null = null;
  let wrapperObserver: MutationObserver | null = null;
  let bootstrapObserver: MutationObserver | null = null;
  let rafId: number | null = null;

  const pushFrame = () => {
    rafId = null;
    if (!active || isStale() || inFlight) return;
    const frame = readSidebarGlass(root);
    const backing = readLiquidGlassBackingRgb(root);
    const key = frameKey(frame, backing);
    if (key === lastAppliedKey) return;
    inFlight = true;
    void liquidGlass
      .setFrame(frame, backing)
      .then((applied) => {
        if (!active || isStale()) return;
        inFlight = false;
        if (!applied) {
          // Refused (Reduce Transparency, or the window lost glass): retrying every
          // frame would spin on IPC, so the next sidebar change asks again.
          lastAppliedKey = null;
          stampMarker(root, "off");
          return;
        }
        lastAppliedKey = key;
        stampMarker(root, "liquid-glass");
        // Reconcile if the sidebar resized or reversed while IPC was in flight.
        if (frameKey(readSidebarGlass(root), readLiquidGlassBackingRgb(root)) !== lastAppliedKey) {
          schedulePush();
        }
      })
      .catch(() => {
        if (!active || isStale()) return;
        inFlight = false;
        lastAppliedKey = null;
        stampMarker(root, "off");
      });
  };

  const schedulePush = () => {
    if (!active || isStale()) return;
    if (typeof window.requestAnimationFrame !== "function") {
      pushFrame();
      return;
    }
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(pushFrame);
  };

  const syncObservedGap = () => {
    const nextGap = observedWrapper?.querySelector('[data-slot="sidebar-gap"]') ?? null;
    if (nextGap === observedGap) return;
    stopObservedGap?.();
    stopObservedGap = null;
    observedGap = nextGap;
    if (observedGap !== null) {
      stopObservedGap = observeResize(observedGap, schedulePush);
    }
  };

  const attachWrapper = () => {
    const wrapper = document.querySelector('[data-slot="sidebar-wrapper"]');
    if (wrapper === null || wrapper === observedWrapper) return;
    observedWrapper = wrapper;
    bootstrapObserver?.disconnect();
    bootstrapObserver = null;
    wrapperObserver?.disconnect();
    if (typeof MutationObserver === "function") {
      wrapperObserver = new MutationObserver(() => {
        syncObservedGap();
        schedulePush();
      });
      wrapperObserver.observe(wrapper, {
        childList: true,
        attributes: true,
        attributeFilter: ["data-fork-sidebar-overlay", "data-sidebar-state", "data-state"],
      });
    }
    syncObservedGap();
    schedulePush();
  };

  attachWrapper();
  if (
    observedWrapper === null &&
    typeof MutationObserver === "function" &&
    document.body !== null
  ) {
    bootstrapObserver = new MutationObserver(() => {
      attachWrapper();
    });
    bootstrapObserver.observe(document.body, { childList: true, subtree: true });
  }

  const rootObserver =
    typeof MutationObserver === "function" ? new MutationObserver(() => schedulePush()) : null;
  rootObserver?.observe(root, {
    attributes: true,
    attributeFilter: [FORK_GLASS_3D_ATTRIBUTE, THREAD_TABS_STAMP],
  });

  window.addEventListener("resize", schedulePush);
  pushFrame();

  stopLiquidGlassTracking = () => {
    active = false;
    if (rafId !== null && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    stopObservedGap?.();
    stopObservedGap = null;
    observedGap = null;
    observedWrapper = null;
    wrapperObserver?.disconnect();
    wrapperObserver = null;
    bootstrapObserver?.disconnect();
    bootstrapObserver = null;
    rootObserver?.disconnect();
    window.removeEventListener("resize", schedulePush);
  };
}

let latestSyncId = 0;

/**
 * Asks the desktop shell to match `enabled`, then stamps the marker with the
 * resolved mode. Resolves with whether any glass mode is active.
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
    stopTracking();
    stampMarker(root, "off");
  }

  const bridge = readBridge();
  if (bridge === null) {
    if (!isStale()) {
      stopTracking();
      stampMarker(root, "off");
    }
    return false;
  }

  let mode: ForkSidebarVibrancyMode = "off";
  try {
    mode = normalizeVibrancyMode(await bridge.setSidebarVibrancy(enabled));
  } catch {
    mode = "off";
  }

  if (isStale()) return mode !== "off";

  const liquidGlass = mode === "liquid-glass" ? readLiquidGlassBridge(bridge) : null;
  if (liquidGlass !== null) {
    startLiquidGlassTracking(liquidGlass, root, isStale);
  } else {
    stopTracking();
    stampMarker(root, mode === "liquid-glass" ? "off" : mode);
  }
  return mode !== "off";
}
