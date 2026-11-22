import { describe, expect, it } from "vite-plus/test";

import { syncForkGlassPopupCutout } from "./forkGlassPopupCutout";

/** #root with a docked v2 sidebar 300px wide, and one portaled menu at `left`. */
function stage(left: number) {
  const root = document.createElement("div");
  root.id = "root";
  // The app root fills the window, as #root does.
  root.style.cssText = "position:fixed;inset:0";
  root.innerHTML = `<div data-slot="sidebar-wrapper"><div data-slot="sidebar-container" data-sidebar-version="v2" style="position:fixed;left:0;top:0;width:300px;height:600px"></div></div>`;
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
  document.body.append(root, portal);
  return {
    root,
    menu,
    [Symbol.dispose]() {
      syncForkGlassPopupCutout(null);
      root.remove();
      portal.remove();
    },
  };
}

describe("syncForkGlassPopupCutout, sidebar-only glass", () => {
  it("stamps a menu wholly inside the docked sidebar for its solid fill, cutting nothing", () => {
    using scene = stage(40);
    syncForkGlassPopupCutout("sidebar");
    expect(scene.menu.hasAttribute("data-fork-sidebar-glass-popup")).toBe(true);
    expect(scene.root.style.getPropertyValue("mask-image")).toBe("");
  });

  it("leaves a menu reaching past the sidebar unstamped", () => {
    using scene = stage(200);
    syncForkGlassPopupCutout("sidebar");
    expect(scene.menu.hasAttribute("data-fork-sidebar-glass-popup")).toBe(false);
    expect(scene.root.style.getPropertyValue("mask-image")).toBe("");
  });
});
