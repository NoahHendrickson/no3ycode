import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { assert, it } from "@effect/vitest";
import { vi } from "vite-plus/test";

vi.mock("electron", () => ({}));

import * as ElectronWindow from "../electron/ElectronWindow.ts";
import * as DesktopIpc from "./DesktopIpc.ts";
/* fork:begin fork-side-chat — see .fork/customizations.yaml#fork-side-chat */
import { markForkAuxiliaryWindow } from "../fork/ForkAuxiliaryWindows.ts";
/* fork:end fork-side-chat */

it.effect("answers only the main window's top frame", () =>
  Effect.gen(function* () {
    const mainFrame = {};
    /* fork:begin fork-side-chat — see .fork/customizations.yaml#fork-side-chat */
    const sideChatFrame = {};
    let closeSideChat = () => {};
    markForkAuxiliaryWindow({
      webContents: { id: 3, mainFrame: sideChatFrame },
      once: (_event: "closed", listener: () => void) => void (closeSideChat = listener),
    } as unknown as Electron.BrowserWindow);
    /* fork:end fork-side-chat */
    const invoke = new Map<string, DesktopIpc.DesktopIpcHandleListener>();
    const sync = new Map<string, DesktopIpc.DesktopIpcSyncListener>();
    const ipc = yield* DesktopIpc.DesktopIpc.pipe(
      Effect.provide(
        DesktopIpc.layer({
          removeHandler: (channel) => void invoke.delete(channel),
          handle: (channel, listener) => void invoke.set(channel, listener),
          removeAllListeners: (channel) => void sync.delete(channel),
          on: (channel, listener) => void sync.set(channel, listener),
        }).pipe(
          Layer.provide(
            Layer.mock(ElectronWindow.ElectronWindow, {
              main: Effect.succeedSome({
                webContents: { id: 1, mainFrame },
              } as unknown as Electron.BrowserWindow),
            }),
          ),
        ),
      ),
    );
    yield* ipc.handle(
      DesktopIpc.makeIpcMethod({
        channel: "token",
        payload: Schema.Void,
        result: Schema.String,
        handler: () => Effect.succeed("secret"),
      }),
    );
    yield* ipc.handleSync({ channel: "token-sync", handler: () => Effect.succeed("secret") });

    const senders = {
      app: { sender: { id: 1 }, senderFrame: mainFrame },
      appSubframe: { sender: { id: 1 }, senderFrame: {} },
      previewGuest: { sender: { id: 2 }, senderFrame: {} },
      // fork:begin fork-side-chat — see .fork/customizations.yaml#fork-side-chat
      sideChat: { sender: { id: 3 }, senderFrame: sideChatFrame },
      sideChatSubframe: { sender: { id: 3 }, senderFrame: {} },
      // fork:end fork-side-chat
    };
    const results: Record<string, unknown> = {};
    for (const [name, sender] of Object.entries(senders)) {
      const event = { ...sender, returnValue: "unset" as unknown };
      sync.get("token-sync")!(event);
      results[name] = [
        yield* Effect.promise(() =>
          Promise.resolve(invoke.get("token")!(sender, undefined)).catch(() => "rejected"),
        ),
        event.returnValue,
      ];
    }
    assert.deepEqual(results, {
      app: ["secret", "secret"],
      appSubframe: ["rejected", undefined],
      previewGuest: ["rejected", undefined],
      // fork:begin fork-side-chat — see .fork/customizations.yaml#fork-side-chat
      sideChat: ["secret", "secret"],
      sideChatSubframe: ["rejected", undefined],
      // fork:end fork-side-chat
    });
    // fork:begin fork-side-chat — see .fork/customizations.yaml#fork-side-chat
    closeSideChat();
    // fork:end fork-side-chat
  }),
);
