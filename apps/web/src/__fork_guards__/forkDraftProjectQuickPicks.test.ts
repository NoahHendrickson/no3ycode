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
    expect(pill).toContain('"updated_at"');
  });

  it("opens a picked pill into the project chip from where it was", () => {
    const pill = read("../custom/DraftProjectPill.tsx");
    expect(pill).toContain("transform: `translateX(${pick.from.left - to.left}px)`");
    expect(pill).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
  });
});
