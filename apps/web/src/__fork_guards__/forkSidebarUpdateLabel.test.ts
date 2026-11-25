// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — `.fork/customizations.yaml#fork-sidebar-update-label`. A sync that
 * resolves the pill or SettingsPanels.tsx to upstream brings back the round icon
 * or the generic install confirm.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const updatePill = NodeFS.readFileSync(
  NodeURL.fileURLToPath(new URL("../components/sidebar/SidebarUpdatePill.tsx", import.meta.url)),
  "utf8",
);

const settingsPanels = NodeFS.readFileSync(
  NodeURL.fileURLToPath(new URL("../components/settings/SettingsPanels.tsx", import.meta.url)),
  "utf8",
);

describe("fork guard: fork-sidebar-update-label", () => {
  it("labels an actionable update as a white Update pill", () => {
    expect(updatePill).toContain('iconStatus === "downloading" ||');
    expect(updatePill).toContain("<ForkUpdateDownloadRing");
    expect(updatePill).toContain('{showUpdateLabel ? "Update" : statusIcon}');
    expect(updatePill).toContain("dark:bg-white dark:text-black");
  });

  it("confirms an install with the fork's restart dialog in the pill and Settings", () => {
    expect(updatePill).toContain("await confirmRestart(");
    expect(settingsPanels).toContain("await confirmRestart(");
    expect(settingsPanels).not.toContain("getDesktopUpdateInstallConfirmationMessage");
  });
});
