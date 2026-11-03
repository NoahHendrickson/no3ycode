// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-sidebar-peek`.
 *
 * The peek is three loose ends that each fail silently: the inert gate inside
 * upstream's Sidebar (lose it and the card shows but swallows every click), the
 * wrapper attribute the stylesheet keys off, and the card rules themselves.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { cssRules } from "./cssRules";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("fork-sidebar-peek", () => {
  it("keeps the collapsed panel interactive while it peeks", () => {
    const sidebar = readSibling("../components/ui/sidebar.tsx");
    expect(sidebar).toMatch(/state === "collapsed" && !peek;/u);
    expect(sidebar).toContain("inert={offcanvasCollapsed}");
  });

  it("wires the store into the trigger, the panel and the wrapper", () => {
    const layout = readSibling("../components/AppSidebarLayout.tsx");
    expect(layout).toContain("{...peekTriggerProps}");
    expect(layout).toContain('peek={sidebarPeek === "open"}');
    expect(layout).toContain(
      'data-fork-sidebar-peek={sidebarPeek === "off" ? undefined : sidebarPeek}',
    );
    expect(layout).toMatch(/useSidebarPeekTrigger\(\{\s+enabled: !isMobile && !isSidebarVisible/u);
    expect(readSibling("../components/sidebar/SidebarChrome.tsx")).toContain(
      'data-fork-sidebar-header=""',
    );
  });

  it("floats the open card and hides the panel header inside it", () => {
    const rules = cssRules(readSibling("../theme.custom.css"));
    const card = rules.find(
      (rule) =>
        rule.selector.includes('[data-fork-sidebar-peek="open"]') &&
        rule.selector.endsWith('[data-slot="sidebar-container"]') &&
        rule.body.includes("translate: 0 0"),
    );
    expect(card?.selector).toContain('[data-sidebar-state="collapsed"]');
    expect(
      rules.some(
        (rule) =>
          rule.selector.includes('[data-fork-sidebar-overlay="true"]') &&
          rule.selector.includes('[data-fork-sidebar-peek="open"]') &&
          rule.body.includes("z-index: 45"),
      ),
    ).toBe(true);
    expect(card?.body).not.toContain("backdrop-filter");

    expect(
      rules.some(
        (rule) =>
          rule.selector.includes('[data-fork-sidebar-peek="dismissed"]') &&
          rule.body.includes("transition: none"),
      ),
    ).toBe(true);
    expect(
      rules.some(
        (rule) =>
          rule.selector.includes('[data-fork-sidebar-peek="open"]') &&
          rule.selector.endsWith("[data-fork-sidebar-header]") &&
          rule.body.includes("display: none"),
      ),
    ).toBe(true);
  });

  it("gives the card the docked Glass tint over a hole cut in the stage", () => {
    const peekSelector = '[data-sidebar-state="collapsed"][data-fork-sidebar-peek="open"]';
    const palettes = cssRules(readSibling("../theme.custom.palettes.css"));
    const docked = palettes.find((rule) =>
      rule.body.includes("--sidebar: var(--fork-glass-panel)"),
    );
    // narrowChatOverlay flags a collapsed wrapper too, so the peek needs its own arm.
    expect(docked?.selector.replace(/\s+/gu, "")).toContain(
      `[data-slot="sidebar-wrapper"]${peekSelector}[data-sidebar-version="v2"]`,
    );
    const floating = palettes.find((rule) => rule.body.includes("--sidebar: #262626"));
    expect(floating?.selector).not.toContain("data-fork-sidebar-peek");

    // Without the hole the translucent card shows the transcript through its rows.
    const hole = cssRules(readSibling("../theme.custom.css")).find(
      (rule) =>
        rule.selector.includes('[data-fork-sidebar-vibrancy="true"]') &&
        rule.selector.includes(peekSelector) &&
        rule.selector.endsWith('[data-slot="sidebar-inset"]'),
    );
    expect(hole?.body).toContain("mask-composite: subtract");
  });
});
