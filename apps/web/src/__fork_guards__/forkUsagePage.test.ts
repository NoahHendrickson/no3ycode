// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-usage-page`. Usage is a page in the main
    panel like Automations; an upstream sync that restores the modal shell or the modal route
    kind would put it back over the thread. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { isAppModalPage, isSidebarUtilityPage } from "../components/sidebar/mainAppLocation";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("fork guard: fork-usage-page", () => {
  it("routes /usage as a utility page, leaving Settings the only modal", () => {
    expect(isAppModalPage("/usage")).toBe(false);
    expect(isSidebarUtilityPage("/usage")).toBe(true);
    expect(isAppModalPage("/settings/general")).toBe(true);
  });

  it("renders Usage in the page shell, opened from the sidebar's Usage row", () => {
    const page = readSibling("../components/usage/UsagePage.tsx");
    expect(page).not.toContain("<AppRouteModal");
    expect(page).toContain('<SidebarInset className="h-dvh min-h-0 overflow-hidden');
    expect(page).toContain('data-fork-stage-card=""');
    const rows = readSibling("../custom/SidebarV2ChromeRows.tsx");
    expect(rows).toContain('void navigate({ to: "/usage" });');
  });
});
