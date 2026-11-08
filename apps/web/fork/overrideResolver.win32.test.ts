// @effect-diagnostics nodeBuiltinImport:off
import { describe, expect, it, vi } from "vite-plus/test";

// Windows path semantics on any host: the resolver builds paths with node:path.
vi.mock("node:path", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:path")>();
  return { ...actual.win32, default: actual.win32 };
});

const { resolveForkOverride } = await import("./overrideResolver");

const SRC = "C:\\repo\\apps\\web\\src";

describe("resolveForkOverride on Windows", () => {
  it("returns forward-slash module ids, matching the ids Vite gives relative imports", () => {
    // A backslash id here and Vite's forward-slash id for the same file's relative
    // imports bundle the module twice, splitting any React context it creates.
    const options = {
      srcDir: SRC,
      overridesDir: `${SRC}\\overrides`,
      fileExists: (path: string) =>
        path === `${SRC}\\components\\ui\\sidebar.tsx` ||
        path === `${SRC}\\overrides\\components\\ui\\button.tsx`,
    };
    const importer = "C:/repo/apps/web/src/custom/UsagePopover.tsx";
    expect(resolveForkOverride("~/components/ui/sidebar", importer, options)).toBe(
      "C:/repo/apps/web/src/components/ui/sidebar.tsx",
    );
    expect(resolveForkOverride("../components/ui/button", importer, options)).toBe(
      "C:/repo/apps/web/src/overrides/components/ui/button.tsx",
    );
  });
});
