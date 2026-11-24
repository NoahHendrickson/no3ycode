// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#no3y-launch-sparkle`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function read(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("no3y-launch-sparkle", () => {
  it("mounts the sparkle overlay and ends it where the native splash used to hide", () => {
    const app = read("../../../mobile/src/App.tsx");
    const identity = read("../../../mobile/fork/identity.ts");
    expect(app).toContain("<No3yLaunchSparkle />");
    expect(app).toContain("markNo3yLaunchReady();");
    expect(identity).toContain(
      'const NO3Y_SPLASH_IMAGE = "./fork/assets/no3y-splash-sparkle.png";',
    );
    expect(
      NodeFS.existsSync(
        NodeURL.fileURLToPath(
          new URL("../../../mobile/fork/assets/no3y-splash-sparkle.png", import.meta.url),
        ),
      ),
    ).toBe(true);
  });
});
