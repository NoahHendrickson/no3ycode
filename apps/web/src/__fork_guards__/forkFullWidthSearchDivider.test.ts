// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and
 * `.fork/customizations.yaml#fork-full-width-search-divider`.
 *
 * A sync that resolves combobox.tsx to upstream's side puts the search field's
 * underline back inside the row's 12px padding.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const combobox = NodeFS.readFileSync(
  NodeURL.fileURLToPath(new URL("../components/ui/combobox.tsx", import.meta.url)),
  "utf8",
);

const menu = NodeFS.readFileSync(
  NodeURL.fileURLToPath(new URL("../components/ui/menu.tsx", import.meta.url)),
  "utf8",
);

describe("fork guard: fork-full-width-search-divider", () => {
  it("pads the search field inside its underline", () => {
    expect(combobox).toContain('<label className="block min-w-0 shrink-0 cursor-text pt-2.5">');
    expect(combobox).toMatch(/border-b border-border\/70 px-3 pb-1\.5/u);
    expect(combobox).toContain("absolute top-1.5 left-3 size-4");
  });

  it("keeps the underline divider-coloured on focus and offers an end control", () => {
    expect(combobox).not.toMatch(
      /border-b border-border\/70 px-3 pb-1\.5[^"]*focus-within:border-ring/u,
    );
    expect(combobox).toContain("endAddon?: React.ReactNode;");
    expect(menu).toContain('"relative -translate-y-px border-b border-border/70 pb-1.5",');
  });
});
