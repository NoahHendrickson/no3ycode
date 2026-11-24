// @effect-diagnostics nodeBuiltinImport:off
/* Fork guard, see `.fork/customizations.yaml#fork-typography-settings`. The sizes apply through
   root attributes and CSS keyed on upstream DOM hooks; lose either side and the setting saves but
   changes nothing. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { FORK_DEFAULT_SANS_FAMILY, forkInterfaceFontPreset } from "../custom/forkTypographyScale";
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
    expect(main).toContain("initializeForkSidebarFontSize();");
    expect(main).toContain("initializeForkChatTextScale();");
  });

  it("sizes the sidebar's type and line boxes from Sidebar font size", () => {
    // One px variable, so the rows grow with the text instead of clipping it.
    expect(readSibling("../custom/forkTypographyScale.ts")).toContain(
      'cssVariable: "--fork-sidebar-font-size",',
    );
    const index = readSibling("../index.css");
    for (const token of ["title", "row", "chrome", "meta", "caption", "status"]) {
      expect(index).toMatch(
        new RegExp(`--text-sidebar-${token}: calc\\(var\\(--fork-sidebar-px, 1px\\) \\* \\d+\\);`),
      );
      expect(index).toMatch(
        new RegExp(`--text-sidebar-${token}--line-height: calc\\(\\d+ / \\d+\\);`),
      );
    }
    const panel = rule(`${MARKER} [data-sidebar-version="v2"]`);
    const unit = theme.find(
      (entry) => normalize(entry.selector) === MARKER && entry.body.includes("--fork-sidebar-px:"),
    );
    expect(unit?.body).toContain(
      "--fork-sidebar-px: calc(var(--fork-sidebar-font-size, 14px) / 14)",
    );
    expect(panel?.body).toContain("--text-sm: calc(var(--fork-sidebar-px) * 13)");
    expect(panel?.body).toContain("--text-xs: calc(var(--fork-sidebar-px) * 13)");
    // Spacing is px as well, so rows keep their drawn heights at any Interface font size.
    const rows = rule(
      `${MARKER} [data-sidebar-version="v2"] :is([data-slot="sidebar-content"], [data-slot="sidebar-footer"])`,
    );
    expect(rows?.body).toContain("--spacing: 4px");
    // Every rem inset upstream gives the sidebar is pinned at its 16px-root size, so a new or
    // retuned one fails here instead of leaving the panel half px and half rem.
    for (const [, name, rem] of index.matchAll(/(--sidebar-[a-z-]+): ([\d.]+)rem;/gu)) {
      expect(rows?.body, name).toContain(`${name}: ${Number(rem) * 16}px`);
    }
    const primitives = readSibling("../components/ui/sidebar.tsx");
    expect(primitives).toContain('data-slot="sidebar-content"');
    expect(primitives).toContain('data-slot="sidebar-footer"');
    const sidebarZoom = theme.filter(
      (entry) => entry.selector.includes("data-sidebar-version") && entry.body.includes("zoom:"),
    );
    expect(sidebarZoom).toEqual([]);
  });

  it("scales every chat stream size from one always-on block", () => {
    const tokens = rule(TIMELINE);
    expect(tokens?.body).toContain(
      "--text-sm: calc(1rem * var(--fork-chat-text-scale, 1) * var(--fork-interface-text-scale, 1))",
    );
    for (const token of ["xs", "base", "lg", "xl", "2xl"]) {
      expect(tokens?.body).toMatch(
        new RegExp(
          `--text-${token}: calc\\([\\d.]+rem \\* var\\(--fork-chat-text-scale, 1\\) \\* var\\(--fork-interface-text-scale, 1\\)\\)`,
        ),
      );
    }
    // 2xs and 3xs are @theme inline, so their utilities need rules that copy index.css's sizes.
    const index = readSibling("../index.css");
    for (const token of ["2xs", "3xs"]) {
      const size = new RegExp(`--text-${token}: ([\\d.]+rem);`).exec(index)?.[1];
      expect(size, `index.css --text-${token}`).toBeDefined();
      // The formatter may wrap the calc's operands onto their own lines.
      expect(rule(`${TIMELINE} .text-${token}`)?.body).toMatch(
        new RegExp(
          `calc\\(\\s*${size?.replace(".", "\\.")} \\* var\\(--fork-chat-text-scale, 1\\) \\* var\\(--fork-interface-text-scale, 1\\)\\s*\\)`,
          "u",
        ),
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
    expect(shadow).toMatch(
      /<InterfaceFontRow \/>\s*\{\/\* fork:begin[^\n]*\*\/\}\s*<ForkSidebarFontSizeRow \/>/u,
    );
    expect(shadow).toMatch(
      /<InterfaceFontRow preview=\{<PromptFontPreview \/>\} \/>\s*\{\/\* fork:begin[^\n]*\*\/\}\s*<ForkSidebarFontSizeRow \/>/u,
    );
    expect(shadow).toContain("<ForkChatStreamSizeRow />");
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
