// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — `.fork/customizations.yaml#fork-update-install-hide`. A sync that
 * resolves DesktopUpdates.ts to upstream keeps the window open, showing the Mac as
 * disconnected, while backends stop and the installer stages the update.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

const desktopUpdates = read("../../../desktop/src/updates/DesktopUpdates.ts");
const electronWindow = read("../../../desktop/src/electron/ElectronWindow.ts");

describe("fork guard: fork-update-install-hide", () => {
  it("hides the windows before an install stops the backends", () => {
    expect(electronWindow).toContain("hideAll: listWindows.pipe(");
    const hide = desktopUpdates.indexOf("yield* electronWindow.hideAll");
    expect(hide).toBeGreaterThan(-1);
    expect(hide).toBeLessThan(desktopUpdates.indexOf("instance.stop({ timeout:"));
  });

  it("reveals them again when the install fails or is interrupted", () => {
    expect(desktopUpdates).toContain("Effect.andThen(revealInstallHiddenWindows,");
    expect(desktopUpdates).toMatch(
      /resetInstallAction = Effect\.all\(\s*\[[^\]]*revealInstallHiddenWindows/,
    );
  });
});
