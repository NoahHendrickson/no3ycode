// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork-owned desktop IPC — see `.fork/customizations.yaml#fork-cool-darker-sidebar-vibrancy`.
 *
 * Turns the native window material (macOS vibrancy, Windows 11 acrylic) on and
 * off for the window that asks, so the Glass sidebar can show what is behind
 * the app. Only the main window and the
 * side chat (fork-side-chat) run the fork's renderer and its palette sync; the
 * preview picture-in-picture window and the WSL splash carry their own fills
 * and none of the fork's CSS, so they never ask. Deliberately kept out of
 * `packages/contracts` and out of the upstream `DesktopBridge`: the renderer
 * reaches it through the fork's own `forkDesktopBridge` key, so an upstream
 * sync never has to merge a contract this fork added.
 *
 * Every other platform resolves `false` and leaves the window
 * opaque, which is why the renderer treats the resolved value — not the
 * requested one — as the answer to "is glass on right now".
 */
import * as NodeOS from "node:os";

import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as Electron from "electron";

import * as DesktopIpc from "../ipc/DesktopIpc.ts";
import {
  FORK_VIBRANCY_MATERIAL,
  forkSenderWindow,
  isForkGlassActive,
  setForkGlassActive,
} from "./ForkGlassState.ts";

const FORK_SET_SIDEBAR_VIBRANCY_CHANNEL = "fork:set-sidebar-vibrancy";

/** Windows' counterpart to the macOS material: both sample what is behind the window. */
const FORK_WINDOWS_BACKDROP_MATERIAL = "acrylic";

/** DWM system backdrops need Windows 11 22H2, build 22621; `release` is `os.release()`. */
function supportsWindowsBackdrop(release: string): boolean {
  return Number(release.split(".")[2]) >= 22621;
}

/**
 * The window is created with an opaque `backgroundColor`. Vibrancy only reaches
 * the glass if that fill stops painting, so enabling swaps in a fully
 * transparent background.
 */
const TRANSPARENT_BACKGROUND = "#00000000";

/**
 * Mirrors `getInitialWindowBackgroundColor` in `window/DesktopWindow.ts`, which
 * is module-private there. The renderer must NOT supply this: it only knows the
 * palette it is switching to, and an earlier cut had it ship Glass's stage
 * colour on every call — which repainted the window fill for Light, default
 * Dark, Westworld and both Neutral palettes. Resolving it here from
 * `nativeTheme` keeps the restore correct for whatever theme is actually
 * active. A fork guard pins these two values against DesktopWindow's.
 */
function opaqueWindowBackground(): string {
  return Electron.nativeTheme.shouldUseDarkColors ? "#000000" : "#ffffff";
}

export const ForkSidebarVibrancyRequest = Schema.Struct({
  enabled: Schema.Boolean,
});

export const setForkSidebarVibrancy = DesktopIpc.makeIpcMethod({
  channel: FORK_SET_SIDEBAR_VIBRANCY_CHANNEL,
  payload: ForkSidebarVibrancyRequest,
  result: Schema.Boolean,
  handler: Effect.fn("desktop.ipc.fork.setSidebarVibrancy")(function* (request, event) {
    const platform = yield* HostProcess.Platform;

    // Asking where no material exists is not an error: the palette is still
    // selectable, it just paints solid.
    const enabled =
      request.enabled &&
      (platform === "darwin" ||
        (platform === "win32" && supportsWindowsBackdrop(NodeOS.release())));

    // The asking window only, not syncAllAppearance. That walks every
    // BrowserWindow, which includes the picture-in-picture preview window
    // (preview/Manager.ts, its own #111111 fill and no fork CSS) and the WSL
    // connecting splash. Handing those the material makes any previewed page
    // without an opaque background render see-through, and restoring would
    // repaint them with the app's fill instead of their own.
    const target = yield* forkSenderWindow(event);
    const painted = target !== null && !target.isDestroyed();
    if (painted) {
      // Set before painting, so an appearance sync racing this call sees the
      // new owner and does not repaint the fill out from under the material.
      const hadGlass = isForkGlassActive(target);
      setForkGlassActive(target, enabled);
      if (platform !== "win32") {
        // Every macOS window is built with the view, so even a never-glass window clears it.
        target.setVibrancy(enabled ? FORK_VIBRANCY_MATERIAL : null);
      } else if (enabled !== hadGlass) {
        // Every call reruns DWM's frame setup and "none" also paints white, so
        // only a real change of glass may reach it.
        target.setBackgroundMaterial(enabled ? FORK_WINDOWS_BACKDROP_MATERIAL : "none");
      }
      target.setBackgroundColor(enabled ? TRANSPARENT_BACKGROUND : opaqueWindowBackground());
    }

    // The renderer stamps its Glass marker from this answer, so a window that
    // was never painted must not report glass on.
    const applied = enabled && painted;
    yield* Effect.logDebug("fork sidebar vibrancy applied", {
      requested: request.enabled,
      applied,
      platform,
    });

    return applied;
  }),
});
