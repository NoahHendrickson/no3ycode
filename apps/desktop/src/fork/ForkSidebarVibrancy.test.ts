import { assert, describe, it } from "@effect/vitest";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import { vi } from "vite-plus/test";

import * as ElectronWindow from "../electron/ElectronWindow.ts";
import type * as DesktopIpc from "../ipc/DesktopIpc.ts";

const { currentWindow, releaseMock } = vi.hoisted(() => ({
  currentWindow: { value: null as unknown },
  releaseMock: vi.fn(() => "10.0.22631"),
}));

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  release: releaseMock,
}));

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: () => currentWindow.value },
  nativeTheme: { shouldUseDarkColors: true },
  webContents: { fromId: () => ({}) },
}));

import { setForkSidebarVibrancy } from "./ForkSidebarVibrancy.ts";

const event = { sender: { id: 1 } } as unknown as DesktopIpc.DesktopIpcInvokeEvent;

function makeWindow() {
  const window = {
    isDestroyed: () => false,
    setBackgroundColor: vi.fn(),
    setBackgroundMaterial: vi.fn(),
    setVibrancy: vi.fn(),
  };
  currentWindow.value = window;
  return window;
}

const request = (enabled: boolean, platform: NodeJS.Platform = "win32") =>
  setForkSidebarVibrancy.handler({ enabled }, event).pipe(
    Effect.provideService(HostProcess.Platform, platform),
    // Only read for a call with no IPC event; these all carry one.
    Effect.provideService(ElectronWindow.ElectronWindow, {} as never),
  );

describe("ForkSidebarVibrancy", () => {
  it.effect("gates Windows glass on build 22621", () =>
    Effect.gen(function* () {
      for (const [release, expected] of [
        ["10.0.22621", true],
        ["10.0.26100", true],
        ["10.0.22000", false],
        ["10.0.19045", false],
        ["unexpected", false],
      ] as const) {
        releaseMock.mockReturnValue(release);
        const window = makeWindow();

        assert.strictEqual(yield* request(true), expected, release);
        assert.strictEqual(window.setBackgroundMaterial.mock.calls.length, expected ? 1 : 0);
      }
    }),
  );

  it.effect("only touches the Windows material when glass changes", () =>
    Effect.gen(function* () {
      releaseMock.mockReturnValue("10.0.22631");
      const window = makeWindow();

      yield* request(false);
      assert.strictEqual(window.setBackgroundMaterial.mock.calls.length, 0);

      yield* request(true);
      yield* request(true);
      assert.deepStrictEqual(window.setBackgroundMaterial.mock.calls, [["acrylic"]]);

      yield* request(false);
      yield* request(false);
      assert.deepStrictEqual(window.setBackgroundMaterial.mock.calls, [["acrylic"], ["none"]]);
      assert.strictEqual(window.setVibrancy.mock.calls.length, 0);
    }),
  );

  it.effect("clears macOS vibrancy on a window that never had glass", () =>
    Effect.gen(function* () {
      const window = makeWindow();

      assert.strictEqual(yield* request(false, "darwin"), false);
      assert.deepStrictEqual(window.setVibrancy.mock.calls, [[null]]);
      assert.strictEqual(window.setBackgroundMaterial.mock.calls.length, 0);
    }),
  );
});
