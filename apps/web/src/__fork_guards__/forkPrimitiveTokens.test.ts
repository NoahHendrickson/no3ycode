// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and
 * `.fork/customizations.yaml#fork-primitive-tokens`.
 *
 * Theme CSS sets the popups', rows', tooltips' and sidebar groups' geometry through tokens these
 * primitives read (DESIGN-RULES C1). A sync that resolves one to upstream's side puts the literal
 * class back, and every theme's token for it silently stops applying.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (name: string) =>
  NodeFS.readFileSync(
    NodeURL.fileURLToPath(new URL(`../components/ui/${name}`, import.meta.url)),
    "utf8",
  );

const POPUP = "rounded-(--fork-menu-radius,var(--radius-lg))";
const ROW = "rounded-(--fork-menu-row-radius,var(--radius-sm))";
const count = (text: string, needle: string) => text.split(needle).length - 1;

describe("fork guard: fork-primitive-tokens", () => {
  it("rounds popups and their rows from the menu tokens", () => {
    expect(count(read("menu.tsx"), POPUP)).toBe(1);
    expect(count(read("menu.tsx"), ROW)).toBe(4);
    expect(count(read("select.tsx"), POPUP)).toBe(2);
    expect(count(read("select.tsx"), ROW)).toBe(1);
    expect(count(read("combobox.tsx"), POPUP)).toBe(1);
    expect(count(read("combobox.tsx"), ROW)).toBe(1);
    expect(count(read("autocomplete.tsx"), POPUP)).toBe(1);
    expect(count(read("autocomplete.tsx"), ROW)).toBe(1);
    expect(count(read("popover.tsx"), POPUP)).toBe(1);
    expect(count(read("preview-card.tsx"), POPUP)).toBe(1);
  });

  it("sizes tooltips and sidebar groups from their tokens", () => {
    const tooltip = read("tooltip.tsx");
    expect(tooltip).toContain("rounded-(--fork-tooltip-radius,var(--radius-md))");
    expect(tooltip).toContain("text-(length:--fork-tooltip-font-size,var(--text-xs))");
    expect(tooltip).toContain("leading-(--fork-tooltip-line-height,var(--leading-snug))");
    expect(tooltip).toContain(
      "px-(--fork-tooltip-padding-inline,calc(var(--spacing)*2)) py-(--fork-tooltip-padding-block,var(--spacing))",
    );
    expect(read("sidebar.tsx")).toContain(
      "pe-(--fork-sidebar-group-padding-end,var(--sidebar-content-inset))",
    );
  });
});
