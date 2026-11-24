// @effect-diagnostics nodeBuiltinImport:off
/* Fork guard, see `.fork/customizations.yaml#fork-dev-house-look`. Dev desktop launches open on
   the maintainer's look, so it must be written before the initializers that paint it. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const main = NodeFS.readFileSync(
  NodeURL.fileURLToPath(new URL("../main.tsx", import.meta.url)),
  "utf8",
);

describe("fork guard: fork-dev-house-look", () => {
  it("applies the look before the theme paints", () => {
    const call = main.indexOf("applyDevHouseLook();");
    expect(call).toBeGreaterThan(-1);
    expect(call).toBeLessThan(main.indexOf("initializeForkTheme();"));
    expect(call).toBeLessThan(main.indexOf("initializeForkGlass3d();"));
  });
});
