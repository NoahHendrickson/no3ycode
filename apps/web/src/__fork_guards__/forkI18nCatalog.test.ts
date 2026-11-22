// @effect-diagnostics nodeBuiltinImport:off
// Fork guard: `.fork/customizations.yaml#fork-i18n-catalog`. The catalog check keeps
// en.json keys for upstream copy the fork removed, and still fails on keys missing from it.

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const repoRoot = NodePath.resolve(
  NodeURL.fileURLToPath(new URL(".", import.meta.url)),
  "../../../..",
);
const check = NodeFS.readFileSync(NodePath.join(repoRoot, "scripts/i18n-check.ts"), "utf8");

describe("fork guard: fork-i18n-catalog", () => {
  it("keeps stale catalog keys out of the failures, but not missing ones", () => {
    const staleLoop = check.slice(
      check.indexOf("for (const key of missingFrom(source, generated))"),
    );
    const staleBody = staleLoop.slice(0, staleLoop.indexOf("\n    }"));
    expect(staleBody).toContain("forkRemovedKeys.push(");
    expect(staleBody).not.toContain("problems.push(");
    expect(check).toMatch(/is missing from en\.json`\);/u);
  });
});
