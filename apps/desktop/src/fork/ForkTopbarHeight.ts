/**
 * Basic's 44px header rows move the macOS window buttons to their axis — see
 * `.fork/customizations.yaml#fork-basic-theme`. DesktopWindow's own repositioning (zoom, leaving
 * full screen) reads the height recorded here. On the fork's bridge, out of `packages/contracts`.
 */
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import type * as Electron from "electron";

import * as DesktopIpc from "../ipc/DesktopIpc.ts";
import { forkSenderWindow } from "./ForkGlassState.ts";

const FORK_SET_TOPBAR_HEIGHT_CHANNEL = "fork:set-topbar-height";

/** DesktopWindow's MACOS_WORKSPACE_TOPBAR_HEIGHT and button radius, which it keeps private. */
const DEFAULT_TOPBAR_HEIGHT = 52;
const WINDOW_BUTTON_RADIUS = 7;

const heights = new WeakMap<Electron.BrowserWindow, number>();

/** The header height a window's palette draws, when it is not the default. */
export function forkTopbarHeight(window: Electron.BrowserWindow): number | undefined {
  return heights.get(window);
}

export const ForkTopbarHeightRequest = Schema.Struct({
  height: Schema.NullOr(Schema.Int.check(Schema.isBetween({ minimum: 32, maximum: 64 }))),
});

export const setForkTopbarHeight = DesktopIpc.makeIpcMethod({
  channel: FORK_SET_TOPBAR_HEIGHT_CHANNEL,
  payload: ForkTopbarHeightRequest,
  result: Schema.Boolean,
  handler: Effect.fn("desktop.ipc.fork.setTopbarHeight")(function* (request, event) {
    const platform = yield* HostProcess.Platform;
    if (platform !== "darwin") return false;
    const target = yield* forkSenderWindow(event);
    if (target === null || target.isDestroyed()) return false;
    if (request.height === null) heights.delete(target);
    else heights.set(target, request.height);
    // Full screen hides the buttons; DesktopWindow places them again on the way out.
    if (!target.isFullScreen()) {
      const height = request.height ?? DEFAULT_TOPBAR_HEIGHT;
      target.setWindowButtonPosition({
        x: target.getWindowButtonPosition()?.x ?? 21,
        y: Math.round((height * target.webContents.getZoomFactor()) / 2 - WINDOW_BUTTON_RADIUS),
      });
    }
    return true;
  }),
});
