import { describe, expect, it, vi } from "vite-plus/test";

import { syncForkGlassPopupCutout } from "./forkGlassPopupCutout";

const MARK = "data-fork-liquid-glass-popup";

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
  it("cuts the page from under a menu wholly inside the docked sidebar, down to its glass", () => {
    using scene = stage();
    liquidGlass();
    const menu = scene.open(40);
    syncForkGlassPopupCutout("sidebar");
    expect(menu.getAttribute(MARK)).toBe("glass");
    expect(scene.root.style.getPropertyValue("mask-image")).toContain("svg");
  });

  it("paints a menu reaching past the sidebar solid, uncut, and leaves one clear of it alone", () => {
    using scene = stage();
    liquidGlass();
    const straddling = scene.open(200);
    const clear = scene.open(400);
    syncForkGlassPopupCutout("sidebar");
    expect(straddling.getAttribute(MARK)).toBe("solid");
    expect(clear.hasAttribute(MARK)).toBe(false);
    expect(scene.root.style.getPropertyValue("mask-image")).toBe("");
  });

  it("treats a plain tooltip over the sidebar as it does a menu, but never a row hover card", () => {
    using scene = stage();
    liquidGlass();
    const plain = (popup: HTMLElement) => {
      popup.className = "";
      popup.setAttribute("data-slot", "tooltip-popup");
      return popup;
    };
    const inside = plain(scene.open(40));
    const straddling = plain(scene.open(200));
    const hoverCard = plain(scene.open(60));
    hoverCard.setAttribute("data-fork-row-hover-card", "");
    syncForkGlassPopupCutout("sidebar");
    expect(inside.getAttribute(MARK)).toBe("glass");
    expect(straddling.getAttribute(MARK)).toBe("solid");
    expect(hoverCard.hasAttribute(MARK)).toBe(false);
  });

  it("cuts the page from under a menu the draft's native glass took, wherever it sits", () => {
    using scene = stage();
    liquidGlass();
    const menu = scene.open(400);
    menu.setAttribute("data-fork-draft-glass-popup", "true");
    syncForkGlassPopupCutout("sidebar");
    expect(menu.getAttribute(MARK)).toBe("glass");
    expect(scene.root.style.getPropertyValue("mask-image")).toContain("svg");
  });

  it("stamps a menu opened after Liquid Glass lands, though the cutout started before it", async () => {
    using scene = stage();
    // The palette starts the cutout; the native glass stamps its marker a round trip later.
    syncForkGlassPopupCutout("sidebar");
    liquidGlass();
    const menu = scene.open(40);
    await vi.waitFor(() => expect(menu.getAttribute(MARK)).toBe("glass"));
  });
});
