// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-tabs`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { IconTab, Tab, Tabs } from "../custom/Tabs";

function read(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

function strip(size?: "sm" | "md" | "lg"): string {
  return renderToStaticMarkup(
    createElement(
      Tabs,
      { "aria-label": "Mode", value: ["code"], ...(size ? { size } : {}) },
      createElement(IconTab, { value: "code", "aria-label": "Code" }),
      createElement(Tab, { value: "chat" }, "Chat"),
    ),
  );
}

describe("fork-tabs", () => {
  it("stamps the markers Basic's tabs rule keys on", () => {
    const html = strip();
    expect(html).toContain("data-fork-segmented-tabs");
    expect(html).toContain('data-fork-tab="icon"');
    expect(html).toContain('data-fork-tab="word"');
  });

  it("sizes the track in every theme and lets its tabs fill it", () => {
    expect(strip()).toMatch(/data-fork-segmented-tabs="true"[^>]*class="[^"]*\bh-7\b/u);
    expect(strip("md")).toMatch(/data-fork-segmented-tabs="true"[^>]*class="[^"]*\bh-8\b/u);
    expect(strip("lg")).toMatch(/data-fork-segmented-tabs="true"[^>]*class="[^"]*\bh-9\b/u);
    expect(strip()).toMatch(
      /data-fork-tab="icon"[^>]*class="[^"]*\baspect-square\b[^"]*\bh-full\b/u,
    );
  });

  it("builds the sidebar's Code / Chat switch from it", () => {
    const switcher = read("../custom/SidebarModeTabs.tsx");
    expect(switcher).toContain('from "./Tabs"');
    expect(switcher).toMatch(/<Tabs\b/u);
    expect(switcher).toMatch(/<IconTab\b/u);
  });

  it("draws every tab strip as the Figma tabs under Basic, menu and upstream ones included", () => {
    const basic = read("../theme.custom.basic.css");
    const strips =
      ':is([data-fork-segmented-tabs], [data-slot="toggle-group"][data-variant="segmented"])';
    const at = basic.indexOf(`[data-fork-theme="basic"]\n  ${strips} {`);
    expect(at).toBeGreaterThan(-1);
    expect(basic.slice(at)).toMatch(
      /\{\s*gap: 2px;\s*padding: 2px;\s*border-radius: 8px;\s*background-color: var\(--basic-wash-2\);\s*&\s*>\s*\*\s*\{[^}]*?font-size:\s*0\.75rem;/u,
    );
    // The model menu's option strips are Tabs, so this rule draws them too.
    expect(read("../custom/ComposerModelPicker.tsx")).toMatch(
      /<Tabs\s+data-fork-segmented-trait=""/u,
    );
    // No strip keeps an older Basic look of its own.
    expect(basic).not.toMatch(/\[data-slot="sidebar-inset"\]\s*\[data-fork-segmented-tabs\]/u);
  });

  it("draws the scheduled-task weekday pickers as tab strips", () => {
    // Upstream's outline group marks a picked day with a faint fill; a strip marks it like a tab.
    for (const path of [
      "../custom/scheduled/ScheduledTaskEditor.tsx",
      "../components/settings/ScheduledTasksSettings.tsx",
    ]) {
      const source = read(path);
      const label = source.indexOf('aria-label="Days to run"');
      const tag = source.slice(
        source.lastIndexOf("<ToggleGroup", label),
        source.indexOf(">", label),
      );
      expect(tag, path).toContain("multiple");
      // ToggleGroup is a segmented strip at its own size unless a variant or size says otherwise.
      expect(tag, path).not.toMatch(/variant="(?!segmented")|size=/u);
    }
  });
});
