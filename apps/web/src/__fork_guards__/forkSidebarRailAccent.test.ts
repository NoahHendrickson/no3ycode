// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and
 * `.fork/customizations.yaml#fork-sidebar-rail-accent`.
 *
 * The rail's tooltip carries the hook the blue pill keys on, and the theme
 * still paints the line and the pill from one token.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const sidebar = readSibling("../components/ui/sidebar.tsx");
const theme = readSibling("../theme.custom.css");

describe("fork guard: fork-sidebar-rail-accent", () => {
  it("hooks the rail's tooltip", () => {
    expect(sidebar).toMatch(
      /<TooltipPopup\s+side="right"[\s\S]{0,200}data-fork-sidebar-rail-tooltip=""[\s\S]{0,120}\{railTitle\}/u,
    );
  });

  it("paints the line and the tooltip in the texture blue", () => {
    expect(theme).toContain("--fork-texture-blue: #44aaf8;");
    expect(theme).toContain("--fork-sidebar-rail-accent: var(--fork-texture-blue);");
    expect(theme).toMatch(
      /\[data-slot="sidebar-rail"\]:is\(:hover, :active\)::after \{\s*background-color: var\(--fork-sidebar-rail-accent\);/u,
    );
    expect(theme).toContain("--fork-inlet-tooltip: var(--fork-sidebar-rail-accent);");
  });
});
