// @effect-diagnostics nodeBuiltinImport:off
/* Fork guard, see `.fork/customizations.yaml#fork-dev-house-look`. Dev desktop launches open on
   the maintainer's look, ahead of the initializers that paint it. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { DEV_HOUSE_LOOK } from "../custom/devHouseLook";

const main = NodeFS.readFileSync(
  NodeURL.fileURLToPath(new URL("../main.tsx", import.meta.url)),
  "utf8",
);

describe("fork guard: fork-dev-house-look", () => {
  it("is Flat Glass, Jolly Petal, the bead ring and Inter 15 with a 14px sidebar", () => {
    expect(DEV_HOUSE_LOOK).toEqual({
      palette: "cool-darker",
      glass3d: "off",
      newAgentBackdrop: "jollyPetal",
      workingMark: "bead",
      sidebarFontSize: 14,
      fontFamilySans: "Inter Variable",
      fontSizeInterface: 15,
    });
  });

  it("runs only in the dev Electron main window, before the theme paints", () => {
    const call = main.indexOf(
      "if (import.meta.env.DEV && isElectron && !isSideChatSurface) applyDevHouseLook();",
    );
    expect(call).toBeGreaterThan(-1);
    expect(call).toBeLessThan(main.indexOf("initializeForkTheme();"));
    expect(call).toBeLessThan(main.indexOf("initializeForkGlass3d();"));
  });
});
