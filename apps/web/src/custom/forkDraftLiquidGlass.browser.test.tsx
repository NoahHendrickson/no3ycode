import { useRef } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { fakeTimers, render } from "../../test/render";
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
    await vi.waitFor(() => expect(setDraftGlass).toHaveBeenLastCalledWith(null));
  });

  it("hides the native layer only after the page has painted its own stage over it", async () => {
    const root = document.documentElement;
    const setDraftGlass = vi.fn((_state: unknown) => Promise.resolve(true));
    using _window = stubLiquidGlassWindow(setDraftGlass);
    await using screen = await render(<DraftStage />);
    await vi.waitFor(() => expect(root.hasAttribute("data-fork-draft-liquid-glass")).toBe(true));
    using _timers = fakeTimers();

    await screen.unmount();
    // Hiding first shows the window's black base through the still-transparent stage.
    expect(root.hasAttribute("data-fork-draft-liquid-glass")).toBe(false);
    expect(setDraftGlass).not.toHaveBeenCalledWith(null);
    vi.advanceTimersToNextFrame();
    expect(setDraftGlass).not.toHaveBeenCalledWith(null);
    vi.advanceTimersToNextFrame();
    expect(setDraftGlass).toHaveBeenLastCalledWith(null);
  });

  it("keeps the native layer for a draft that opens before the last one's hide lands", async () => {
    const calls: Array<"show" | "hide"> = [];
    const setDraftGlass = vi.fn((state: unknown) => {
      calls.push(state === null ? "hide" : "show");
      return Promise.resolve(true);
    });
    using _window = stubLiquidGlassWindow(setDraftGlass);
    await using first = await render(<DraftStage />);
    await vi.waitFor(() => expect(calls).toEqual(["show"]));
    using _timers = fakeTimers();

    await first.unmount();
    await using second = await render(<DraftStage />);
    expect(calls).toEqual(["show", "show"]);
    vi.advanceTimersToNextFrame();
    vi.advanceTimersToNextFrame();
    expect(calls).toEqual(["show", "show"]);

    // Lands the second draft's hide under these fake timers, so no fake frame id outlives them.
    await second.unmount();
    vi.advanceTimersToNextFrame();
    vi.advanceTimersToNextFrame();
    expect(calls).toEqual(["show", "show", "hide"]);
  });

  it("puts native glass under a popup wholly inside the stage, not one reaching past it", async () => {
    const setDraftGlass = vi.fn((_state: unknown) => Promise.resolve(true));
    using _window = stubLiquidGlassWindow(setDraftGlass);
    await using screen = await render(<DraftStage />);
    await vi.waitFor(() => expect(setDraftGlass).toHaveBeenCalled());

    const stageBox = screen.container
      .querySelector("[data-chat-column-maximized-away]")!
      .getBoundingClientRect();
    const portal = document.createElement("div");
    portal.setAttribute("data-base-ui-portal", "");
    const menu = (left: number) => {
      const popup = document.createElement("div");
      popup.className = "dropdown-glass";
      popup.setAttribute("data-slot", "menu-popup");
      popup.style.cssText = `position:fixed;left:${left}px;top:${stageBox.top + 40}px;width:160px;height:120px`;
      portal.append(popup);
      return popup;
    };
    const inside = menu(stageBox.left + 40);
    // Over the sidebar on its left, where the sidebar's solid fill must hold.
    const straddling = menu(stageBox.left - 80);
    using _portal = { [Symbol.dispose]: () => portal.remove() };
    document.body.append(portal);

    await vi.waitFor(() => expect(inside.hasAttribute("data-fork-draft-glass-popup")).toBe(true));
    expect(straddling.hasAttribute("data-fork-draft-glass-popup")).toBe(false);
  });
});
