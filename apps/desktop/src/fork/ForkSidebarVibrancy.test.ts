import { assert, describe, it } from "@effect/vitest";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import { vi } from "vite-plus/test";

import * as ElectronWindow from "../electron/ElectronWindow.ts";
import type * as DesktopIpc from "../ipc/DesktopIpc.ts";

const { currentWindow, liquidGlassSupportedMock, clearLiquidGlassMock, releaseMock } = vi.hoisted(
  () => ({
    currentWindow: { value: null as unknown },
    liquidGlassSupportedMock: vi.fn(() => false),
    clearLiquidGlassMock: vi.fn(),
    releaseMock: vi.fn(() => "10.0.22631"),
  }),
);

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  release: releaseMock,
}));

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: () => currentWindow.value },
  nativeTheme: { shouldUseDarkColors: true },
  webContents: { fromId: () => ({}) },
}));

vi.mock("./ForkLiquidGlass.ts", () => ({
  isForkLiquidGlassSupported: liquidGlassSupportedMock,
  clearForkLiquidGlass: clearLiquidGlassMock,
  takeForkLiquidGlassLoadFailure: () => null,
}));

import type * as Electron from "electron";

import { markForkAuxiliaryWindow } from "./ForkAuxiliaryWindows.ts";
import { setForkSidebarVibrancy } from "./ForkSidebarVibrancy.ts";

const event = { sender: { id: 1 } } as unknown as DesktopIpc.DesktopIpcInvokeEvent;

function makeWindow() {
  const window = {
    isDestroyed: () => false,
    once: vi.fn(),
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
        ["10.0.22621", "vibrancy"],
        ["10.0.26100", "vibrancy"],
        ["10.0.22000", "off"],
        ["10.0.19045", "off"],
        ["unexpected", "off"],
      ] as const) {
        releaseMock.mockReturnValue(release);
        const window = makeWindow();

        assert.strictEqual(yield* request(true), expected, release);
        assert.strictEqual(
          window.setBackgroundMaterial.mock.calls.length,
          expected === "vibrancy" ? 1 : 0,
        );
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
      liquidGlassSupportedMock.mockReturnValue(false);
      clearLiquidGlassMock.mockClear();
      const window = makeWindow();

      assert.strictEqual(yield* request(false, "darwin"), "off");
      assert.deepStrictEqual(window.setVibrancy.mock.calls, [[null]]);
      assert.strictEqual(window.setBackgroundMaterial.mock.calls.length, 0);
      assert.strictEqual(clearLiquidGlassMock.mock.calls.length, 1);
    }),
  );

  it.effect("clears Electron vibrancy on main macOS windows when Liquid Glass is supported", () =>
    Effect.gen(function* () {
      liquidGlassSupportedMock.mockReturnValue(true);
      clearLiquidGlassMock.mockClear();
      const mainWindow = makeWindow();

      assert.strictEqual(yield* request(true, "darwin"), "liquid-glass");
      assert.deepStrictEqual(mainWindow.setVibrancy.mock.calls, [[null]]);
      // Transparent even under Liquid Glass: the call also clears the web view's base colour.
      assert.deepStrictEqual(mainWindow.setBackgroundColor.mock.calls, [["#00000000"]]);
      assert.strictEqual(clearLiquidGlassMock.mock.calls.length, 0);

      // Auxiliary windows (Side Chat) have no sidebar and keep whole-window vibrancy.
      const auxWindow = makeWindow();
      markForkAuxiliaryWindow(auxWindow as unknown as Electron.BrowserWindow);
      assert.strictEqual(yield* request(true, "darwin"), "vibrancy");
      assert.deepStrictEqual(auxWindow.setVibrancy.mock.calls, [["fullscreen-ui"]]);
      assert.strictEqual(clearLiquidGlassMock.mock.calls.length, 1);
    }),
  );
});
