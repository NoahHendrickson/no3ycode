import { describe, expect, it, vi } from "vite-plus/test";

import { syncForkGlassPopupCutout } from "./forkGlassPopupCutout";

const MARK = "data-fork-sidebar-glass-popup";

/** #root with a docked v2 sidebar 300px wide; `open` portals a menu at `left`. */
function stage() {
  const root = document.createElement("div");
  root.id = "root";
  // The app root fills the window, as #root does.
  root.style.cssText = "position:fixed;inset:0";
  root.innerHTML = `<div data-slot="sidebar-wrapper"><div data-slot="sidebar-container" data-sidebar-version="v2" style="position:fixed;left:0;top:0;width:300px;height:600px"></div></div>`;
  document.body.append(root);
  const portals: Array<HTMLElement> = [];
  return {
    root,
    open(left: number) {
      const portal = document.createElement("div");
      portal.setAttribute("data-base-ui-portal", "");
      const menu = document.createElement("div");
      menu.className = "dropdown-glass";
      menu.setAttribute("data-slot", "menu-popup");
      menu.style.cssText = `position:fixed;left:${left}px;top:100px;width:200px;height:150px`;
      // Base UI portals a positioner, and the popup inside it.
      const positioner = document.createElement("div");
      positioner.append(menu);
      portal.append(positioner);
      document.body.append(portal);
      portals.push(portal);
      return menu;
    },
    [Symbol.dispose]() {
      syncForkGlassPopupCutout(null);
      document.documentElement.removeAttribute("data-fork-sidebar-vibrancy");
      root.remove();
      for (const portal of portals) portal.remove();
    },
  };
}

const liquidGlass = () =>
  document.documentElement.setAttribute("data-fork-sidebar-vibrancy", "liquid-glass");

describe("syncForkGlassPopupCutout, sidebar-only glass", () => {
  it("stamps a menu wholly inside the docked sidebar for its solid fill, cutting nothing", () => {
    using scene = stage();
    liquidGlass();
    const menu = scene.open(40);
    syncForkGlassPopupCutout("sidebar");
    expect(menu.hasAttribute(MARK)).toBe(true);
    expect(scene.root.style.getPropertyValue("mask-image")).toBe("");
  });

  it("leaves a menu reaching past the sidebar unstamped", () => {
    using scene = stage();
    liquidGlass();
    const menu = scene.open(200);
    syncForkGlassPopupCutout("sidebar");
    expect(menu.hasAttribute(MARK)).toBe(false);
  });

  it("stamps a menu opened after Liquid Glass lands, though the cutout started before it", async () => {
    using scene = stage();
    // The palette starts the cutout; the native glass stamps its marker a round trip later.
    syncForkGlassPopupCutout("sidebar");
    liquidGlass();
    const menu = scene.open(40);
    await vi.waitFor(() => expect(menu.hasAttribute(MARK)).toBe(true));
  });
});
