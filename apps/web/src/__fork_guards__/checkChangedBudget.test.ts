// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#check-changed-budget`. */
import { describe, expect, it } from "vite-plus/test";

import { decide, readWorkspace } from "../../../../.github/scripts/ci-changes.cjs";

describe("fork guard: check:changed budget", () => {
  const manifest = ".fork/customizations.yaml";
  const packages = readWorkspace();

  it("routes the manifest to its web guards and keeps the usual web dependents", () => {
    const result = decide([manifest], packages, false);
    expect(result.affected).toEqual(["@t3tools/scripts", "@t3tools/web"]);
    expect(result.outputs).toEqual({
      typecheck: true,
      build: true,
      desktop_launch: false,
      test: true,
      test_packages: "@t3tools/scripts",
      test_web: true,
      test_server: false,
      rust: false,
      release_smoke: false,
      mobile_native: false,
    });
    expect(decide([manifest, "apps/web/src/components/ChatView.tsx"], packages, false)).toEqual(
      result,
    );
  });

  it("preserves mixed package changes and global fail-open routing", () => {
    const mixed = decide([manifest, "apps/mobile/src/App.tsx"], packages, false);
    expect(mixed.affected).toContain("@t3tools/web");
    expect(mixed.affected).toContain("@t3tools/mobile");
    expect(mixed.outputs.test_server).toBe(false);
    for (const file of ["pnpm-lock.yaml", "vite.config.ts", "package.json", ".fork/unknown.yaml"]) {
      expect(decide([manifest, file], packages, false)).toEqual(decide([file], packages, false));
    }
    expect(decide([manifest], packages, true)).toEqual(decide([], packages, true));
    expect(decide(null, packages, false).outputs.mobile_native).toBe(true);
  });
});
