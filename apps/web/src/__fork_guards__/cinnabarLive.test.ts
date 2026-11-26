// @effect-diagnostics nodeBuiltinImport:off
/* Fork guard, see `.fork/customizations.yaml#fork-cinnabar-live`. Dev builds can follow Cinnabar
   Studio's live font. It must stay opt-in and dev-only, start from main.tsx, and keep loading the
   font from fetched bytes, which the desktop CSP allows, instead of a URL, which it blocks. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { cinnabarLiveStudioUrl } from "../custom/cinnabarLive";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const source = readSibling("../custom/cinnabarLive.ts");

describe("fork guard: fork-cinnabar-live", () => {
  it("starts from main.tsx", () => {
    const main = readSibling("../main.tsx");
    expect(main).toContain('import { startCinnabarLive } from "./custom/cinnabarLive";');
    expect(main).toContain("startCinnabarLive();");
  });

  it("stays dev-only and opt-in", () => {
    expect(source).toContain("if (!import.meta.env.DEV) return;");
    expect(source).toContain("VITE_CINNABAR_LIVE");
    expect(cinnabarLiveStudioUrl(undefined)).toBeNull();
    expect(cinnabarLiveStudioUrl("")).toBeNull();
    expect(cinnabarLiveStudioUrl("0")).toBeNull();
    expect(cinnabarLiveStudioUrl("1")).toBe("http://127.0.0.1:8765");
    expect(cinnabarLiveStudioUrl("http://127.0.0.1:9000/")).toBe("http://127.0.0.1:9000");
  });

  it("builds the faces from fetched bytes, not a URL", () => {
    // The desktop CSP allows http: for connect-src but not font-src.
    expect(source).toContain("await response.arrayBuffer()");
    expect(source).toMatch(
      /new FontFace\(FORK_DEFAULT_SANS_FAMILY, await response\.arrayBuffer\(\)/u,
    );
    expect(source).not.toMatch(/new FontFace\([^)]*url\(/u);
  });
});
