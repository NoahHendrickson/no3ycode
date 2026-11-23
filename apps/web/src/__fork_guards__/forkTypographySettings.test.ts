// @effect-diagnostics nodeBuiltinImport:off
/* Fork guard, see `.fork/customizations.yaml#fork-typography-settings`. The sizes apply through
   root attributes and CSS keyed on upstream DOM hooks; lose either side and the setting saves but
   changes nothing. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import {
  FORK_CHAT_TEXT_SCALE_ATTRIBUTE,
  FORK_SIDEBAR_ZOOM_ATTRIBUTE,
  forkInterfaceFontPreset,
} from "../custom/forkTypographyScale";
import { cssRules } from "./cssRules";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const compact = (value: string) => value.replace(/\s+/gu, "");

describe("fork guard: fork-typography-settings", () => {
  it("stamps both sizes on the root before first render", () => {
    const main = readSibling("../main.tsx");
    expect(main).toContain("initializeForkSidebarZoom();");
    expect(main).toContain("initializeForkChatTextScale();");
  });

  it("zooms the sidebar's content and footer, never the header, only while the size is set", () => {
    // The header holds the macOS traffic-light inset and must match the workspace top bar.
    const rules = cssRules(readSibling("../theme.custom.css"));
    const zoom = rules.find((rule) => rule.body.includes("zoom: var(--fork-sidebar-zoom"));
    const selector = compact(zoom?.selector ?? "");
    expect(selector).toContain(`[${FORK_SIDEBAR_ZOOM_ATTRIBUTE}]`);
    expect(selector).toContain(':is([data-slot="sidebar-content"],[data-slot="sidebar-footer"])');
    expect(selector).not.toContain("sidebar-header");
    const primitives = readSibling("../components/ui/sidebar.tsx");
    expect(primitives).toContain('data-slot="sidebar-content"');
    expect(primitives).toContain('data-slot="sidebar-footer"');
  });

  it("scales the chat stream's type tokens only while the size is set", () => {
    const rules = cssRules(readSibling("../theme.custom.css"));
    // Message and tool-row text defaults to the composer's 1rem, so this one is always on.
    const body = rules.find((rule) => rule.body.includes("--text-sm: calc(1rem"));
    expect(compact(body?.selector ?? "")).toBe(
      compact(':root[data-fork="noahhendrickson-t3code"] [data-timeline-root]'),
    );
    const tokens = rules.find((rule) => rule.body.includes("--text-xs: calc(0.75rem"));
    expect(compact(tokens?.selector ?? "")).toContain(
      `[${FORK_CHAT_TEXT_SCALE_ATTRIBUTE}][data-timeline-root]`,
    );
    // 2xs is @theme inline, so its utility needs its own rule rather than a token remap.
    const twoXs = rules.find((rule) =>
      compact(rule.selector).endsWith("[data-timeline-root].text-2xs"),
    );
    expect(twoXs?.body).toContain("calc(0.6875rem * var(--fork-chat-text-scale");
    expect(readSibling("../components/chat/MessagesTimeline.tsx")).toContain(
      'data-timeline-root="true"',
    );
  });

  it("offers the presets and both size rows from the Typography shadow", () => {
    const shadow = readSibling("../overrides/components/settings/TypographySettings.tsx");
    expect(shadow).toContain("presets={FORK_INTERFACE_FONT_PRESETS}");
    expect(shadow).toContain('title="Sidebar size"');
    expect(shadow).toContain('title="Chat stream size"');
  });

  it("maps the fork default to Geist and keeps Inter loaded", () => {
    expect(forkInterfaceFontPreset("")?.label).toBe("Geist");
    expect(forkInterfaceFontPreset(" Inter Variable ")?.label).toBe("Inter");
    expect(forkInterfaceFontPreset("Comic Sans MS")).toBeNull();
    expect(readSibling("../main.tsx")).toContain('import "@fontsource-variable/inter";');
  });
});
