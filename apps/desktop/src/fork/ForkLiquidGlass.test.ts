import { assert, describe, it } from "@effect/vitest";
import { vi } from "vite-plus/test";

vi.mock("electron", () => ({
  app: { isPackaged: false, getAppPath: () => "" },
}));

import type * as Electron from "electron";

import {
  applyForkSidebarLiquidGlassFrame,
  clearForkLiquidGlass,
  FORK_LIQUID_GLASS_BACKING_RGB,
  isForkLiquidGlassSupported,
  setSidebarGlassAddonForTests,
  type SidebarGlassShowOptions,
  toClampedPoints,
} from "./ForkLiquidGlass.ts";

function makeFakeWindow(contentSize: [number, number] = [1200, 800], zoom = 1) {
  const handle = Buffer.from([1, 2, 3, 4]);
  const window = {
    isDestroyed: () => false,
    getContentSize: () => contentSize,
    getNativeWindowHandle: () => handle,
    webContents: { getZoomFactor: () => zoom },
  };
  return { window: window as unknown as Electron.BrowserWindow, handle };
}

describe("ForkLiquidGlass", () => {
  it("scales CSS px by zoomFactor and clamps to the content bounds", () => {
    assert.strictEqual(toClampedPoints(256, 1.25, 1200), 320);
    assert.strictEqual(toClampedPoints(1500, 1, 1200), 1200);
    assert.isNull(toClampedPoints(0, 1, 1200));
  });

  it("shows, updates width and backing, hides sidebar without clearing draft glass, and gates on darwin", () => {
    const showCalls: Array<readonly [Buffer, SidebarGlassShowOptions]> = [];
    const hideCalls: Array<Buffer> = [];
    const hideDraftCalls: Array<Buffer> = [];
    setSidebarGlassAddonForTests({
      isSupported: () => true,
      show: (handle, options) => {
        showCalls.push([handle, options]);
        return true;
      },
      hide: (handle) => {
        hideCalls.push(handle);
        return true;
      },
      setDraftGlass: () => true,
      hideDraftGlass: (handle) => {
        hideDraftCalls.push(handle);
        return true;
      },
    });

    try {
      assert.isTrue(isForkLiquidGlassSupported("darwin"));
      assert.isFalse(isForkLiquidGlassSupported("linux"));

      const { window, handle } = makeFakeWindow([1200, 800], 1);
      assert.isTrue(applyForkSidebarLiquidGlassFrame(window, { width: 256 }));
      assert.isTrue(applyForkSidebarLiquidGlassFrame(window, { width: 310 }, 0x1f1c1b));
      assert.strictEqual(showCalls.length, 2);
      assert.strictEqual(showCalls[0]?.[0], handle);
      assert.deepStrictEqual(showCalls[0]?.[1], {
        width: 256,
        backing: FORK_LIQUID_GLASS_BACKING_RGB,
      });
      assert.deepStrictEqual(showCalls[1]?.[1], {
        width: 310,
        backing: 0x1f1c1b,
      });
      // Flat Glass's tab row: a band at the top, clamped to the content height.
      assert.isTrue(
        applyForkSidebarLiquidGlassFrame(window, { width: 1100, height: 44 }, 0x1d1d1e),
      );
      assert.isTrue(
        applyForkSidebarLiquidGlassFrame(window, { width: 1100, height: 900 }, 0x1d1d1e),
      );
      assert.deepStrictEqual(showCalls[2]?.[1], { width: 1100, backing: 0x1d1d1e, height: 44 });
      assert.deepStrictEqual(showCalls[3]?.[1], { width: 1100, backing: 0x1d1d1e, height: 800 });

      assert.isTrue(applyForkSidebarLiquidGlassFrame(window, null));
      assert.strictEqual(hideCalls.length, 1);
      assert.strictEqual(hideDraftCalls.length, 0);
      // A band with no height left hides the glass; full height would cover the draft glass.
      assert.isTrue(applyForkSidebarLiquidGlassFrame(window, { width: 1100, height: 0 }));
      assert.strictEqual(showCalls.length, 4);
      assert.strictEqual(hideCalls.length, 2);

      clearForkLiquidGlass(window);
      assert.strictEqual(hideCalls.length, 3);
      assert.strictEqual(hideDraftCalls.length, 1);
    } finally {
      setSidebarGlassAddonForTests(undefined);
    }
  });
});
