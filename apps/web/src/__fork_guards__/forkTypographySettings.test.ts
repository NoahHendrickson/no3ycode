// @effect-diagnostics nodeBuiltinImport:off
/* Fork guard, see `.fork/customizations.yaml#fork-typography-settings`. The sizes apply through
   root attributes and CSS keyed on upstream DOM hooks; lose either side and the setting saves but
   changes nothing. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import {
  FORK_DEFAULT_SANS_FAMILY,
  FORK_SIDEBAR_ZOOM_ATTRIBUTE,
  forkInterfaceFontPreset,
  forkSidebarSortableTranslate,
} from "../custom/forkTypographyScale";
import { cssRules } from "./cssRules";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

// Collapses rather than deletes, so a descendant combinator still tells two selectors apart.
const normalize = (value: string) => value.replace(/\s+/gu, " ").trim();
const MARKER = ':root[data-fork="noahhendrickson-t3code"]';
const TIMELINE = `${MARKER} [data-timeline-root]`;
const theme = cssRules(readSibling("../theme.custom.css"));
const rule = (selector: string) => theme.find((entry) => normalize(entry.selector) === selector);

describe("fork guard: fork-typography-settings", () => {
  it("stamps both sizes on the root before first render", () => {
    const main = readSibling("../main.tsx");
    expect(main).toContain("initializeForkSidebarZoom();");
    expect(main).toContain("initializeForkChatTextScale();");
  });

  it("zooms the sidebar's content and footer, never the header, only while the size is set", () => {
    // The header holds the macOS traffic-light inset and must match the workspace top bar. The
    // descendant match covers the narrow-web sheet, whose content has no sidebar-inner around it.
    const zoom = rule(
      `${MARKER}[${FORK_SIDEBAR_ZOOM_ATTRIBUTE}] [data-sidebar-version="v2"] :is([data-slot="sidebar-content"], [data-slot="sidebar-footer"])`,
    );
    expect(zoom?.body).toContain("zoom: var(--fork-sidebar-zoom, 1)");
    const primitives = readSibling("../components/ui/sidebar.tsx");
    expect(primitives).toContain('data-slot="sidebar-content"');
    expect(primitives).toContain('data-slot="sidebar-footer"');
  });

  it("keeps sidebar drags on the pointer while zoomed", () => {
    expect(forkSidebarSortableTranslate(null)).toBeUndefined();
    expect(forkSidebarSortableTranslate({ x: 0, y: 30.4 })).toBe(
      "translate3d(calc(0px / var(--fork-sidebar-zoom, 1)), calc(30px / var(--fork-sidebar-zoom, 1)), 0)",
    );
    for (const path of [
      "../components/Sidebar.tsx",
      "../components/sidebar/SidebarListMarkers.tsx",
      "../components/sidebar/SidebarThreadRow.tsx",
      "../custom/SidebarV2ProjectGroupHeader.tsx",
    ]) {
      const source = readSibling(path);
      expect(source, path).toContain("transform: forkSidebarSortableTranslate(");
      expect(source, path).not.toContain("CSS.Translate.toString(");
    }
    expect(readSibling("../components/Sidebar.motion.ts")).toContain(
      "(node.getBoundingClientRect().top - origin) / zoom",
    );
  });

  it("scales every chat stream size from one always-on block", () => {
    const tokens = rule(TIMELINE);
    expect(tokens?.body).toContain("--text-sm: calc(1rem * var(--fork-chat-text-scale, 1))");
    for (const token of ["xs", "base", "lg", "xl", "2xl"]) {
      expect(tokens?.body).toMatch(
        new RegExp(`--text-${token}: calc\\([\\d.]+rem \\* var\\(--fork-chat-text-scale, 1\\)\\)`),
      );
    }
    // 2xs and 3xs are @theme inline, so their utilities need rules that copy index.css's sizes.
    const index = readSibling("../index.css");
    for (const token of ["2xs", "3xs"]) {
      const size = new RegExp(`--text-${token}: ([\\d.]+rem);`).exec(index)?.[1];
      expect(size, `index.css --text-${token}`).toBeDefined();
      expect(rule(`${TIMELINE} .text-${token}`)?.body).toContain(
        `calc(${size} * var(--fork-chat-text-scale, 1))`,
      );
    }
    for (const [heading, token] of [
      ["h1", "xl"],
      ["h2", "lg"],
      ["h3", "base"],
      [":is(h4, h5, h6)", "sm"],
    ]) {
      expect(rule(`${TIMELINE} .chat-markdown ${heading}`)?.body).toContain(
        `font-size: var(--text-${token})`,
      );
    }
    expect(rule(`${TIMELINE} .chat-markdown table`)?.body).toContain("var(--fork-chat-text-scale");
    expect(readSibling("../components/chat/MessagesTimeline.tsx")).toContain(
      'data-timeline-root="true"',
    );
  });

  it("mounts the fork controls from the Typography shadow", () => {
    const shadow = readSibling("../overrides/components/settings/TypographySettings.tsx");
    expect(shadow).toContain("renderFamilyField={(familyField) => (");
    expect(shadow).toContain("<ForkTypographyScaleRows />");
    expect(shadow).toContain("const sans = FORK_DEFAULT_SANS_FAMILY;");
  });

  it("maps the fork default to Geist and keeps Inter loaded", () => {
    expect(forkInterfaceFontPreset("")?.label).toBe("Geist");
    expect(forkInterfaceFontPreset(" Inter Variable ")?.label).toBe("Inter");
    expect(forkInterfaceFontPreset("Comic Sans MS")).toBeNull();
    expect(readSibling("../main.tsx")).toContain('import "@fontsource-variable/inter";');
    const fonts = theme.find((entry) => entry.body.includes("--fork-font-sans:"));
    expect(normalize(fonts?.selector ?? "")).toBe(MARKER);
    expect(fonts?.body).toMatch(new RegExp(`--fork-font-sans:\\s*"${FORK_DEFAULT_SANS_FAMILY}",`));
  });
});
