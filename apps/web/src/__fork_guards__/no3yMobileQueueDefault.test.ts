// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#no3y-mobile-queue-default`.
 *
 * Upstream's iPhone follow-ups steer the running turn by default; the fork queues them.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const followUpBehavior = NodeFS.readFileSync(
  NodeURL.fileURLToPath(new URL("../../../mobile/src/lib/followUpBehavior.ts", import.meta.url)),
  "utf8",
);

describe("no3y-mobile-queue-default", () => {
  it("queues follow-ups sent during a running turn unless the phone chose otherwise", () => {
    expect(followUpBehavior).toContain(
      'export const DEFAULT_FOLLOW_UP_BEHAVIOR: FollowUpBehavior = "queue";',
    );
  });
});
