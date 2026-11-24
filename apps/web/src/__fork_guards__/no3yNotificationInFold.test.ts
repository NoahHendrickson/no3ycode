// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#no3y-notification-in-fold`.
 *
 * Pins mobile's fold rule for notifications, which an upstream sync could silently revert: a
 * notification folds into its turn's "Worked for" row unless it failed.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const threadActivity = NodeFS.readFileSync(
  NodeURL.fileURLToPath(new URL("../../../mobile/src/lib/threadActivity.ts", import.meta.url)),
  "utf8",
);
const staysOutOfFold = /function staysOutOfFold\([^)]*\)[^{]*\{([\s\S]*?)\n\}/u.exec(
  threadActivity,
)?.[1];

describe("no3y-notification-in-fold", () => {
  it("keeps only failed notifications out of the fold", () => {
    expect(staysOutOfFold).toBeDefined();
    expect(staysOutOfFold).toMatch(
      /\(activity\.projectedItem\.item\.type === "notification" &&\s*activity\.projectedItem\.item\.outcome === "failed"\)/u,
    );
    expect(staysOutOfFold?.match(/item\.type === "notification"/gu)).toHaveLength(1);
  });
});
