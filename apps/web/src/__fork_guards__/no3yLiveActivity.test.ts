// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#no3y-live-activity`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readRepoFile(relativePath: string): string {
  return NodeFS.readFileSync(
    NodeURL.fileURLToPath(new URL(`../../../../${relativePath}`, import.meta.url)),
    "utf8",
  );
}

describe("fork guard: no3y-live-activity", () => {
  it("arms the no3y card from upstream's send hook before the relay path", () => {
    const registration = readRepoFile(
      "apps/mobile/src/features/agent-awareness/remoteRegistration.ts",
    );
    expect(registration).toMatch(
      /export function armAgentAwarenessLiveActivityForLocalWork[\s\S]{0,400}if \(armNo3yLiveActivityOnSend\(input\)\) return;\s+\/\* fork:end no3y-live-activity \*\/\s+if \(!canRegisterRemoteLiveActivities\(\)/u,
    );
  });

  it("hands the card's token to the path the Mac push service serves", () => {
    const client = readRepoFile("apps/mobile/fork/no3yLiveActivityClient.ts");
    const service = readRepoFile("apps/mobile/fork/push-service/no3yPush.mts");
    expect(client).toContain("`${origin}${NO3Y_PUSH_MOUNT_PATH}/live-activity`");
    expect(service).toContain('path === "/live-activity"');
  });

  it("pushes content the app's factory renders", () => {
    // Both sides name the card through NO3Y_LIVE_ACTIVITY_NAME; a literal on either side drifts.
    const card = readRepoFile("apps/mobile/fork/No3yAgentActivity.tsx");
    const service = readRepoFile("apps/mobile/fork/push-service/no3yPush.mts");
    expect(card).toMatch(/createLiveActivity<No3yLiveActivityProps>\(\s*NO3Y_LIVE_ACTIVITY_NAME,/u);
    expect(service).toMatch(/name: NO3Y_LIVE_ACTIVITY_NAME/u);
  });
});
