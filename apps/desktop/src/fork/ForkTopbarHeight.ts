/**
 * Basic's 44px header rows move the macOS window buttons to their axis — see
 * `.fork/customizations.yaml#fork-basic-theme`. The handler records the asking window's height and
 * places the buttons through DesktopWindow's own positioning, which reads it.
 */
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as DesktopIpc from "../ipc/DesktopIpc.ts";
import { syncMacosWindowButtons } from "../window/DesktopWindow.ts";
import { forkSenderWindow } from "./ForkGlassState.ts";
import { setForkTopbarHeightFor } from "./ForkTopbarHeightState.ts";

const FORK_SET_TOPBAR_HEIGHT_CHANNEL = "fork:set-topbar-height";

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
    setForkTopbarHeightFor(target, request.height);
    syncMacosWindowButtons(target);
    return true;
  }),
});
