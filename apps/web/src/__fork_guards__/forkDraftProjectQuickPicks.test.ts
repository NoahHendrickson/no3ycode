// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-draft-project-quick-picks`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("fork guard: fork-draft-project-quick-picks", () => {
  it("offers recent projects as pills above an unassigned draft's composer", () => {
    const pill = read("../custom/DraftProjectPill.tsx");
    expect(pill).toContain("const QUICK_PICK_LIMIT = 5;");
    expect(pill).toContain('selection.kind === "unassigned" && props.draftId !== null');
    expect(pill).toContain('data-fork-project-quick-pick=""');
    expect(pill).toContain(
      "rankRecentProjectEntries(projectPickerEntries, threads, QUICK_PICK_LIMIT)",
    );
  });

  it("opens a picked pill into the project chip from where it was", () => {
    const pill = read("../custom/DraftProjectPill.tsx");
    // The pill records the pick and every chip that mounts plays it, so the
    // slide survives ChatView swapping the fallback strip for BranchToolbar.
    expect(pill).toContain("rememberDraftProjectPick(");
    expect(pill).toContain("playDraftProjectPick(");
    const motion = read("../custom/draftProjectPickMotion.ts");
    expect(motion).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
  });
});
