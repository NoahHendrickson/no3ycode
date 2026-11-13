// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and
 * `.fork/customizations.yaml#fork-separate-provider-updates`.
 *
 * A sync that resolves useUpdateEverything.ts or SidebarChrome.tsx to upstream's
 * side folds provider updates back into the app's Update pill.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("fork guard: fork-separate-provider-updates", () => {
  it("keeps providers out of the app's update run", () => {
    const hook = read("../components/sidebar/useUpdateEverything.ts");
    expect(hook).not.toContain(": providerUpdates;");
    expect(hook).toContain("const providers: ReturnType<typeof useProviderUpdates> = {");
  });

  it("gives providers their own button beside the app's Update pill", () => {
    const chrome = read("../components/sidebar/SidebarChrome.tsx");
    expect(chrome).toMatch(/<SidebarProviderUpdatesButton \/>[\s\S]*?<SidebarUpdatePill \/>/);
  });
});
