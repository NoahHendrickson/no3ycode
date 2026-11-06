// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and
 * `.fork/customizations.yaml#fork-sidebar-update-label`.
 *
 * A sync that resolves SidebarUpdatePill.tsx to upstream's side drops the
 * white "Update" pill and puts the round icon back.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const updatePill = NodeFS.readFileSync(
  NodeURL.fileURLToPath(new URL("../components/sidebar/SidebarUpdatePill.tsx", import.meta.url)),
  "utf8",
);

describe("fork guard: fork-sidebar-update-label", () => {
  it("labels an actionable update as a white Update pill", () => {
    expect(updatePill).toContain(
      'iconStatus === "available" || iconStatus === "downloaded" || iconStatus === "everything"',
    );
    expect(updatePill).toContain('{showUpdateLabel ? "Update" : statusIcon}');
    expect(updatePill).toContain("bg-white px-3 py-2 font-medium text-black text-xs");
  });
});
