// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and `.fork/customizations.yaml#fork-settings-nav`.
 *
 * The Settings nav's calmer ink: foreground labels at regular weight with 65% icons, 65% group
 * headings, and a hairline between groups. The label rule keys on upstream's
 * `data-settings-section` stamp, so a sync that renames it turns the nav back to upstream's.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const nav = readSibling("../components/settings/SettingsSidebarNav.tsx");
const sheet = readSibling("../theme.custom.css");

describe("fork guard: settings nav", () => {
  it("draws each section in the foreground at regular weight with a 65% icon", () => {
    expect(nav).toContain("data-settings-section={to}");
    const rule = sheet.slice(
      sheet.indexOf(':root[data-fork="noahhendrickson-t3code"] [data-settings-section] {'),
    );
    expect(rule).toMatch(/^[^}]*font-weight: 400;\s*color: var\(--contrast-sidebar-foreground\);/u);
    expect(rule).toMatch(
      /& > svg \{\s*color: color-mix\(in srgb, var\(--contrast-sidebar-foreground\) 65%, transparent\);/u,
    );
  });

  it("keeps headings at 65%, the search an outlined field, and rules off each group", () => {
    expect(nav).toContain('"px-2 text-xs font-medium text-sidebar-foreground/65"');
    expect(nav).toContain(
      '<InputGroup role="none" className={cn(!compactSearchOpen && "max-md:hidden")}>',
    );
    expect(nav).toContain('<SearchIcon aria-hidden className="opacity-65" />');
    expect(nav).toContain("border-t border-sidebar-border");
    expect(nav).toContain("first:border-t-0 first:pt-0");
  });
});
