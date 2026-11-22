// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#no3y-push`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readRepoFile(relativePath: string): string {
  return NodeFS.readFileSync(
    NodeURL.fileURLToPath(new URL(`../../../../${relativePath}`, import.meta.url)),
    "utf8",
  );
}

describe("fork guard: no3y-push", () => {
  it("installs the phone's push registration with the app's services", () => {
    const app = readRepoFile("apps/mobile/src/App.tsx");
    expect(app).toContain(
      'import { installNo3yPushRegistration } from "../fork/pushRegistration";',
    );
    expect(app).toMatch(/appServiceDisposers = \[[\s\S]*installNo3yPushRegistration\(\),/u);
  });

  it("registers at the path the Mac push service is mounted on", () => {
    const registration = readRepoFile("apps/mobile/fork/pushRegistration.ts");
    const service = readRepoFile("apps/mobile/fork/push-service/no3yPush.mts");
    expect(registration).toContain('NO3Y_PUSH_REGISTER_PATH = "/no3y-push/register"');
    expect(service).toContain('const MOUNT_PATH = "/no3y-push"');
    expect(service).toContain('path !== "/register"');
  });
});
