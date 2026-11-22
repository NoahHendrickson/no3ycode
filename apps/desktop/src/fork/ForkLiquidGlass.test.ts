import { assert, describe, it } from "@effect/vitest";
import { vi } from "vite-plus/test";

vi.mock("electron", () => ({
  app: { isPackaged: false, getAppPath: () => "" },
}));

import type * as Electron from "electron";

import {
  applyForkLiquidGlassRect,
  buildLiquidGlassOptions,
  clearForkLiquidGlass,
  FORK_LIQUID_GLASS_BACKING_RGB,
  isForkLiquidGlassSupported,
  setSidebarGlassAddonForTests,
  type SidebarGlassShowOptions,
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
  it("scales CSS width by zoomFactor and clamps to content bounds", () => {
    const options = buildLiquidGlassOptions(
      { x: 0, y: 0, width: 256, height: 700, cornerRadius: 0, docked: true },
      1.25,
      [1200, 800],
    );

    assert.deepStrictEqual(options, {
      width: 320,
      backing: FORK_LIQUID_GLASS_BACKING_RGB,
    });

    assert.isNull(
      buildLiquidGlassOptions({ x: 0, y: 0, width: 0, height: 800, docked: true }, 1, [1200, 800]),
    );
  });

  it("shows, updates width, hides sidebar without clearing draft glass, and gates on darwin", async () => {
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
      hideDraftGlass: (handle) => {
        hideDraftCalls.push(handle);
        return true;
      },
    });

    try {
      assert.isTrue(await isForkLiquidGlassSupported("darwin"));
      assert.isFalse(await isForkLiquidGlassSupported("linux"));

      const { window, handle } = makeFakeWindow([1200, 800], 1);
      assert.isTrue(
        await applyForkLiquidGlassRect(window, { x: 0, y: 0, width: 256, height: 800 }),
      );
      assert.isTrue(
        await applyForkLiquidGlassRect(window, { x: 0, y: 0, width: 310, height: 800 }),
      );
      assert.strictEqual(showCalls.length, 2);
      assert.strictEqual(showCalls[0]?.[0], handle);
      assert.strictEqual(showCalls[0]?.[1].width, 256);
      assert.strictEqual(showCalls[1]?.[1].width, 310);

      assert.isTrue(await applyForkLiquidGlassRect(window, null));
      assert.strictEqual(hideCalls.length, 1);
      assert.strictEqual(hideDraftCalls.length, 0);

      clearForkLiquidGlass(window);
      assert.strictEqual(hideCalls.length, 2);
      assert.strictEqual(hideDraftCalls.length, 1);
    } finally {
      setSidebarGlassAddonForTests(undefined);
    }
  });
});
