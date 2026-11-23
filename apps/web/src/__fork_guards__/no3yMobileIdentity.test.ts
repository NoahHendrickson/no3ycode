// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#no3y-mobile-identity`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readRepoFile(relativePath: string): string {
  return NodeFS.readFileSync(
    NodeURL.fileURLToPath(new URL(`../../../../${relativePath}`, import.meta.url)),
    "utf8",
  );
}

describe("fork guard: no3y-mobile-identity", () => {
  it("builds the mobile app as no3y Code unless explicitly opted out", () => {
    expect(readRepoFile("apps/mobile/fork/identity.ts")).toContain(
      'return env.NO3Y_MOBILE_IDENTITY !== "0";',
    );
  });

  it("routes upstream's variant and final config through the fork identity", () => {
    // The variant hook must run before upstream derives widget, share and
    // app-group IDs from it; the final hook swaps Ping's team and Expo project.
    const appConfig = readRepoFile("apps/mobile/app.config.ts");
    expect(appConfig).toContain(
      "const variant = no3yVariant(APP_VARIANT, VARIANT_CONFIG[APP_VARIANT], repoEnv);",
    );
    expect(appConfig).toContain("export default no3yNativeConfig(config, repoEnv);");
    expect(appConfig.indexOf("no3yVariant(APP_VARIANT")).toBeLessThan(
      appConfig.indexOf("bundleIdentifier: `${iosBundleIdentifier}.widgets`"),
    );
  });
});
