// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork sidebar Liquid Glass — see `.fork/customizations.yaml#fork-cool-darker-sidebar-vibrancy`.
 * Mounts AppKit's sidebar glass (`native/sidebar-glass/sidebar_glass.m`) under the docked sidebar
 * and behind Flat Glass new-agent draft cards.
 */
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";

import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as Electron from "electron";

import * as DesktopIpc from "../ipc/DesktopIpc.ts";
import { isForkAuxiliaryWindow } from "./ForkAuxiliaryWindows.ts";
import { forkSenderWindow, isForkGlassActive } from "./ForkGlassState.ts";

const FORK_SET_SIDEBAR_LIQUID_GLASS_WIDTH_CHANNEL = "fork:set-sidebar-liquid-glass-width";
const FORK_SET_DRAFT_LIQUID_GLASS_CHANNEL = "fork:set-draft-liquid-glass";

/** Window backing colour behind AppKit's floating sidebar capsule (`#141618` for Full Glass). */
export const FORK_LIQUID_GLASS_BACKING_RGB = 0x141618;

const ForkSidebarLiquidGlassWidthRequest = Schema.Struct({
  width: Schema.NullOr(Schema.Number),
  backing: Schema.optional(Schema.Number),
});

const ForkRect2D = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
});

const ForkDraftLiquidGlassCard = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
  cornerRadius: Schema.Number,
});

const ForkDraftLiquidGlassState = Schema.Struct({
  stage: ForkRect2D,
  imageKey: Schema.String,
  imageBase64: Schema.optional(Schema.String),
  image: ForkRect2D,
  cards: Schema.Array(ForkDraftLiquidGlassCard),
});

export type ForkDraftLiquidGlassState = typeof ForkDraftLiquidGlassState.Type;

const ForkDraftLiquidGlassRequest = Schema.Struct({
  state: Schema.NullOr(ForkDraftLiquidGlassState),
});

export type SidebarGlassShowOptions = {
  readonly width: number;
  readonly backing: number;
};

export type SidebarGlassNativeAddon = {
  readonly isSupported: () => boolean;
  readonly show: (handle: Buffer, options: SidebarGlassShowOptions) => boolean;
  readonly hide: (handle: Buffer) => boolean;
  readonly setDraftGlass: (handle: Buffer, options: ForkDraftLiquidGlassState) => boolean;
  readonly hideDraftGlass: (handle: Buffer) => boolean;
};

let cachedAddon: SidebarGlassNativeAddon | null | undefined;

function resolveAddonCandidates(): readonly string[] {
  const candidates: string[] = [];
  // oxlint-disable-next-line t3code/no-global-process-runtime -- Native addon lookup targets the host Electron architecture.
  const arch = process.arch;
  const resourcesPath = (process as { resourcesPath?: unknown }).resourcesPath;
  if (Electron.app?.isPackaged && typeof resourcesPath === "string") {
    candidates.push(NodePath.join(resourcesPath, "sidebar-glass", "sidebar_glass.node"));
  }
  const appPath = Electron.app?.getAppPath?.();
  if (typeof appPath === "string" && appPath.length > 0) {
    candidates.push(
      NodePath.resolve(appPath, "../../native/sidebar-glass/build", arch, "sidebar_glass.node"),
      NodePath.resolve(appPath, "../native/sidebar-glass/build", arch, "sidebar_glass.node"),
    );
  }
  candidates.push(
    NodePath.resolve(process.cwd(), "native/sidebar-glass/build", arch, "sidebar_glass.node"),
    NodePath.resolve(process.cwd(), "../../native/sidebar-glass/build", arch, "sidebar_glass.node"),
  );
  return candidates;
}

function loadNativeAddon(): SidebarGlassNativeAddon | null {
  if (cachedAddon !== undefined) return cachedAddon;
  const req = NodeModule.createRequire(import.meta.url);
  for (const candidate of resolveAddonCandidates()) {
    if (!NodeFS.existsSync(candidate)) continue;
    try {
      const loaded = req(candidate) as Partial<SidebarGlassNativeAddon>;
      if (
        typeof loaded.isSupported === "function" &&
        typeof loaded.show === "function" &&
        typeof loaded.hide === "function" &&
        typeof loaded.setDraftGlass === "function" &&
        typeof loaded.hideDraftGlass === "function"
      ) {
        cachedAddon = loaded as SidebarGlassNativeAddon;
        return cachedAddon;
      }
    } catch {
      // Try next candidate path.
    }
  }
  cachedAddon = null;
  return null;
}

/** Test hook to inject a fake native addon without touching the filesystem. */
export function setSidebarGlassAddonForTests(
  addon: SidebarGlassNativeAddon | null | undefined,
): void {
  cachedAddon = addon;
}

/** Computes the sidebar Liquid Glass width in macOS points, clamped to content bounds. */
export function clampLiquidGlassWidth(
  cssWidth: number,
  zoomFactor: number,
  contentSize: readonly number[],
): number | null {
  if (!Number.isFinite(cssWidth) || cssWidth <= 0) return null;
  const zoom = Number.isFinite(zoomFactor) && zoomFactor > 0 ? zoomFactor : 1;
  const contentWidth = contentSize[0] ?? 0;
  const contentHeight = contentSize[1] ?? 0;
  if (contentWidth <= 0 || contentHeight <= 0) return null;
  const width = Math.min(contentWidth, Math.round(cssWidth * zoom));
  return width > 0 ? width : null;
}

/** True when macOS 26+ Liquid Glass is loadable and currently available. */
export function isForkLiquidGlassSupported(platform: NodeJS.Platform): boolean {
  if (platform !== "darwin") return false;
  const addon = loadNativeAddon();
  if (addon === null) return false;
  try {
    return addon.isSupported();
  } catch {
    return false;
  }
}

/** Removes only the sidebar Liquid Glass view on `window`, preserving any draft glass layer. */
function hideForkSidebarLiquidGlass(window: Electron.BrowserWindow): void {
  if (window.isDestroyed()) return;
  const addon = loadNativeAddon();
  if (addon === null) return;
  try {
    addon.hide(window.getNativeWindowHandle());
  } catch {
    // Best-effort removal on teardown.
  }
}

/** Removes any attached Liquid Glass view (sidebar and draft) on `window`. */
export function clearForkLiquidGlass(window: Electron.BrowserWindow): void {
  if (window.isDestroyed()) return;
  const addon = loadNativeAddon();
  if (addon === null) return;
  try {
    const handle = window.getNativeWindowHandle();
    addon.hideDraftGlass(handle);
    addon.hide(handle);
  } catch {
    // Best-effort removal on teardown.
  }
}

function scaleRect(
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  zoom: number,
) {
  return {
    x: rect.x * zoom,
    y: rect.y * zoom,
    width: rect.width * zoom,
    height: rect.height * zoom,
  };
}

function applyForkDraftLiquidGlass(
  window: Electron.BrowserWindow,
  state: ForkDraftLiquidGlassState | null,
): boolean {
  if (window.isDestroyed()) return false;
  const addon = loadNativeAddon();
  if (addon === null) return false;
  const handle = window.getNativeWindowHandle();
  if (state === null) {
    try {
      addon.hideDraftGlass(handle);
    } catch {
      // Best-effort teardown.
    }
    return true;
  }

  const rawZoom = window.webContents.getZoomFactor();
  const zoom = Number.isFinite(rawZoom) && rawZoom > 0 ? rawZoom : 1;
  const scaled: ForkDraftLiquidGlassState = {
    stage: scaleRect(state.stage, zoom),
    imageKey: state.imageKey,
    ...(state.imageBase64 !== undefined ? { imageBase64: state.imageBase64 } : {}),
    image: scaleRect(state.image, zoom),
    cards: state.cards.map((card) => ({
      ...scaleRect(card, zoom),
      cornerRadius: card.cornerRadius * zoom,
    })),
  };

  try {
    return addon.setDraftGlass(handle, scaled);
  } catch {
    return false;
  }
}

/** Attaches, updates, or removes the sidebar Liquid Glass view on `window`. */
export function applyForkLiquidGlassWidth(
  window: Electron.BrowserWindow,
  cssWidth: number | null,
  backingRgb: number = FORK_LIQUID_GLASS_BACKING_RGB,
): boolean {
  if (window.isDestroyed()) return false;

  if (cssWidth === null) {
    hideForkSidebarLiquidGlass(window);
    return true;
  }

  const width = clampLiquidGlassWidth(
    cssWidth,
    window.webContents.getZoomFactor(),
    window.getContentSize(),
  );
  if (width === null) {
    hideForkSidebarLiquidGlass(window);
    return true;
  }

  const addon = loadNativeAddon();
  if (addon === null) return false;

  const backing =
    Number.isFinite(backingRgb) && backingRgb >= 0 && backingRgb <= 0xffffff
      ? Math.trunc(backingRgb)
      : FORK_LIQUID_GLASS_BACKING_RGB;

  try {
    return addon.show(window.getNativeWindowHandle(), { width, backing });
  } catch {
    return false;
  }
}

const resolveLiquidGlassWindow = Effect.fn("desktop.ipc.fork.resolveLiquidGlassWindow")(function* (
  event: DesktopIpc.DesktopIpcInvokeEvent | undefined,
  enabling: boolean,
) {
  const platform = yield* HostProcess.Platform;
  if (platform !== "darwin") return null;
  const target = yield* forkSenderWindow(event);
  if (target === null || target.isDestroyed() || isForkAuxiliaryWindow(target)) {
    return null;
  }
  if (enabling && !isForkGlassActive(target)) {
    return null;
  }
  return target;
});

export const setForkSidebarLiquidGlassWidth = DesktopIpc.makeIpcMethod({
  channel: FORK_SET_SIDEBAR_LIQUID_GLASS_WIDTH_CHANNEL,
  payload: ForkSidebarLiquidGlassWidthRequest,
  result: Schema.Boolean,
  handler: Effect.fn("desktop.ipc.fork.setSidebarLiquidGlassWidth")(function* (request, event) {
    const target = yield* resolveLiquidGlassWindow(event, request.width !== null);
    if (target === null) return false;
    return applyForkLiquidGlassWidth(target, request.width, request.backing);
  }),
});

export const setForkDraftLiquidGlass = DesktopIpc.makeIpcMethod({
  channel: FORK_SET_DRAFT_LIQUID_GLASS_CHANNEL,
  payload: ForkDraftLiquidGlassRequest,
  result: Schema.Boolean,
  handler: Effect.fn("desktop.ipc.fork.setDraftLiquidGlass")(function* (request, event) {
    const target = yield* resolveLiquidGlassWindow(event, request.state !== null);
    if (target === null) return false;
    return applyForkDraftLiquidGlass(target, request.state);
  }),
});
