// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and
 * `.fork/customizations.yaml#fork-interface-size-text-only`.
 *
 * Interface font size is the root font size, so a rem geometry token would shrink controls with
 * it. Each token upstream defines in rem is pinned to its 16px value in px at the fork root.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/** Token → [upstream's rem value in index.css, the fork's px pin]. */
const PINNED: Record<string, readonly [string | null, string]> = {
  "--spacing": [null, "4px"],
  "--radius": ["0.5rem", "8px"],
  "--radius-xs": [null, "2px"],
  "--radius-4xl": [null, "32px"],
  "--control-radius": ["0.5rem", "8px"],
  "--sidebar-content-inset": ["0.5rem", "8px"],
  "--sidebar-control-gap": ["0.5rem", "8px"],
  "--sidebar-row-content-inset": ["0.625rem", "10px"],
  "--command-shell-inset": ["0.5rem", "8px"],
  "--command-content-inset": ["1rem", "16px"],
  "--floating-content-inset": ["0.75rem", "12px"],
  "--workspace-titlebar-control-size": ["1.75rem", "28px"],
  "--workspace-titlebar-control-gap": ["0.75rem", "12px"],
};

describe("fork guard: interface size scales text only", () => {
  const sheet = readSibling("../theme.custom.css");
  const index = readSibling("../index.css");
  const start = sheet.indexOf("Interface font size scales text only");
  const block = sheet.slice(sheet.indexOf("{", start), sheet.indexOf("}", start) + 1);

  it("pins every rem geometry token to its 16px value", () => {
    expect(sheet.slice(start, sheet.indexOf("{", start))).toContain(
      ':root[data-fork="noahhendrickson-t3code"]',
    );
    for (const [token, [upstream, pin]] of Object.entries(PINNED)) {
      expect(block).toContain(`${token}: ${pin};`);
      // A changed upstream default moves the 16px baseline, so the pin must be revisited.
      if (upstream !== null) expect(index).toContain(`${token}: ${upstream};`);
    }
  });

  it("pins the Appearance sliders and the fold threshold", () => {
    expect(index).toContain("--settings-slider-fill-offset: 0.5rem;");
    expect(sheet).toContain(':root[data-fork="noahhendrickson-t3code"] .settings-slider {');
    expect(sheet).toContain("--settings-slider-fill-offset: 8px;");
    const slider = sheet.slice(
      sheet.indexOf(':root[data-fork="noahhendrickson-t3code"] .settings-slider {'),
    );
    expect(slider).toMatch(/^[^}]*height: 24px;/u);
    for (const part of [
      "-webkit-slider-runnable-track",
      "-moz-range-track",
      "-moz-range-progress",
    ]) {
      expect(slider).toMatch(new RegExp(`&::${part} \\{\\s*height: 6px;`, "u"));
    }
    expect(slider).toMatch(
      /&::-webkit-slider-thumb \{\s*width: 16px;\s*height: 16px;\s*margin-top: -5px;/u,
    );
    expect(slider).toMatch(/&::-moz-range-thumb \{\s*width: 16px;\s*height: 16px;/u);
    const fold = readSibling("../components/chat/useTallEnoughToFold.ts");
    expect(fold).toContain("const remPx = 16;");
    const panel = readSibling("../components/settings/AppearanceSettingsPanel.tsx");
    expect(panel.match(/"--settings-slider-fill-offset": `\$\{8 - \w+ \* 16\}px`/gu)).toHaveLength(
      3,
    );
    expect(panel).not.toContain("}rem`");
  });
});
