// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#check-changed-budget`. */
import { describe, expect, it } from "vite-plus/test";

import { decide, readWorkspace } from "../../../../.github/scripts/ci-changes.cjs";

describe("fork guard: check:changed budget", () => {
  const manifest = ".fork/customizations.yaml";
  const packages = readWorkspace();

  it("routes the manifest to its web guards and keeps the usual web dependents", () => {
    const result = decide([manifest], packages, false);
    expect(result).toEqual(decide(["apps/web/src/components/ChatView.tsx"], packages, false));
    expect(result.affected).toContain("@t3tools/web");
    expect(result.outputs).toMatchObject({
      test_web: true,
      test_server: false,
      mobile_native: false,
    });
    expect(decide([manifest, "apps/web/src/components/ChatView.tsx"], packages, false)).toEqual(
      result,
    );
  });

  it("preserves other packages in mixed changes", () => {
    const mixed = decide([manifest, "apps/mobile/src/App.tsx"], packages, false);
    expect(mixed.affected).toContain("@t3tools/web");
    expect(mixed.affected).toContain("@t3tools/mobile");
    expect(mixed.outputs.test_server).toBe(false);
  });
});
