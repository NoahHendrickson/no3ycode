// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-dev-electron-no-startup-relaunch`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const source = NodeFS.readFileSync(
  NodeURL.fileURLToPath(new URL("../../../desktop/scripts/dev-electron.mjs", import.meta.url)),
  "utf8",
);

describe("fork-dev-electron-no-startup-relaunch", () => {
  it("leaves an app that died during startup down instead of relaunching it", () => {
    const exitHandler = source.slice(source.indexOf('app.once("exit"'));
    expect(source).toMatch(/const launchedAt = Date\.now\(\);/u);
    expect(exitHandler).toMatch(
      /if \(Date\.now\(\) - launchedAt < startupFailureWindowMs\) \{[\s\S]*?return;\s*\}[\s\S]*?scheduleRestart\(\);/u,
    );
  });
});
