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

import { setForkSidebarVibrancy, supportsWindowsBackdrop } from "./ForkSidebarVibrancy.ts";

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

const request = (enabled: boolean) =>
  setForkSidebarVibrancy.handler({ enabled }, event).pipe(
    Effect.provideService(HostProcess.Platform, "win32"),
    // Only read for a call with no IPC event; these all carry one.
    Effect.provideService(ElectronWindow.ElectronWindow, {} as never),
  );

describe("ForkSidebarVibrancy on Windows", () => {
  it.each([
    ["10.0.22621", true],
    ["10.0.26100", true],
    ["10.0.22000", false],
    ["10.0.19045", false],
    ["unexpected", false],
  ])("supportsWindowsBackdrop(%s) is %s", (release, expected) => {
    assert.strictEqual(supportsWindowsBackdrop(release), expected);
  });

  it.effect("paints acrylic on and restores the opaque fill off", () =>
    Effect.gen(function* () {
      releaseMock.mockReturnValue("10.0.22631");
      const window = makeWindow();

      assert.strictEqual(yield* request(true), true);
      assert.deepStrictEqual(window.setBackgroundMaterial.mock.calls, [["acrylic"]]);
      assert.deepStrictEqual(window.setBackgroundColor.mock.calls, [["#00000000"]]);

      assert.strictEqual(yield* request(false), false);
      assert.deepStrictEqual(window.setBackgroundMaterial.mock.calls, [["acrylic"], ["none"]]);
      assert.deepStrictEqual(window.setBackgroundColor.mock.calls.at(-1), ["#000000"]);
      assert.strictEqual(window.setVibrancy.mock.calls.length, 0);
    }),
  );

  it.effect("leaves the material alone on a window that never had glass", () =>
    Effect.gen(function* () {
      releaseMock.mockReturnValue("10.0.22631");
      const window = makeWindow();

      assert.strictEqual(yield* request(false), false);
      assert.strictEqual(window.setBackgroundMaterial.mock.calls.length, 0);
    }),
  );

  it.effect("reports no glass below Windows 11 22H2", () =>
    Effect.gen(function* () {
      releaseMock.mockReturnValue("10.0.19045");
      const window = makeWindow();

      assert.strictEqual(yield* request(true), false);
      assert.strictEqual(window.setBackgroundMaterial.mock.calls.length, 0);
    }),
  );
});
