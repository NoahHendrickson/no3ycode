import { useRef } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../../test/render";
import { useForkDraftLiquidGlass } from "./forkDraftLiquidGlass";

// 1x1 transparent PNG; the hook fetches it to upload the backdrop.
const IMAGE_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const CELLS = { width: 10, height: 10 };
const layoutFor = () => ({ cell: 10, left: 0, top: 0 });

function DraftStage() {
  const ref = useRef<HTMLDivElement>(null);
  useForkDraftLiquidGlass({ ref, url: IMAGE_URL, cells: CELLS, layoutFor });
  return (
    <div
      data-chat-column-maximized-away=""
      style={{ position: "relative", width: 800, height: 600 }}
    >
      <div ref={ref} style={{ position: "absolute", inset: 0 }} />
      <div data-chat-composer-overlay="true" data-draft-hero="">
        <div
          data-fork-composer-vessel=""
          data-testid="vessel"
          style={{ width: 400, height: 120 }}
        />
      </div>
    </div>
  );
}

/** Marks the window as Flat Glass with native sidebar glass, and installs `setDraftGlass`. */
function stubLiquidGlassWindow(setDraftGlass: (state: unknown) => Promise<boolean>) {
  const root = document.documentElement;
  root.setAttribute("data-fork-sidebar-vibrancy", "liquid-glass");
  root.setAttribute("data-fork-glass-3d", "off");
  const globals = globalThis as { forkDesktopBridge?: unknown };
  globals.forkDesktopBridge = { sidebarLiquidGlass: { setDraftGlass } };
  return {
    [Symbol.dispose]() {
      root.removeAttribute("data-fork-sidebar-vibrancy");
      root.removeAttribute("data-fork-glass-3d");
      delete globals.forkDesktopBridge;
    },
  };
}

describe("useForkDraftLiquidGlass", () => {
  it("hides the native layer on unmount even after a refused update", async () => {
    // The first payload lands; every later one is refused, leaving that first layer mounted.
    const answers = [true];
    let answered = 0;
    const setDraftGlass = vi.fn((_state: unknown) =>
      Promise.resolve(answers.shift() ?? false).finally(() => {
        answered += 1;
      }),
    );
    using _window = stubLiquidGlassWindow(setDraftGlass);
    await using screen = await render(<DraftStage />);

    await vi.waitFor(() => expect(answered).toBe(1));
    const vessel = screen.container.querySelector<HTMLElement>("[data-fork-composer-vessel]")!;
    vessel.style.height = "160px";
    // The refused update, then its one retry.
    await vi.waitFor(() => expect(answered).toBe(3));

    await screen.unmount();
    expect(setDraftGlass).toHaveBeenLastCalledWith(null);
  });
});
