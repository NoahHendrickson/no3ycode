// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-design-variants`.
 *
 * The sidebar chrome's sort menus and row groups take their look from these variants rather
 * than restyling the primitive (.fork/DESIGN-RULES.md B1). A sync that resolves menu.tsx or
 * sidebar.tsx to upstream's side drops the props, and the callers stop typechecking.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("fork guard: fork-design-variants", () => {
  it("sizes menu radio and checkbox items", () => {
    const menu = read("../components/ui/menu.tsx");
    expect(menu).toContain('sm: "sm:text-xs"');
    expect(menu).toContain('chrome: "py-0 text-sm font-medium"');
    expect(menu.match(/forkMenuItemSizeClassName\[size\]/gu)).toHaveLength(2);
  });

  it("insets sidebar groups as chrome rows", () => {
    const sidebar = read("../components/ui/sidebar.tsx");
    expect(sidebar).toContain('chrome: "px-2 pt-0 pb-0"');
    expect(sidebar).toContain('"chrome-stack": "gap-0.5 px-2 pt-0 pb-0"');
    expect(sidebar).toContain("forkSidebarGroupInsetClassName[inset]");
  });
});
