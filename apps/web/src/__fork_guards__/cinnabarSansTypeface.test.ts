// @effect-diagnostics nodeBuiltinImport:off
/* Fork guard, see `.fork/customizations.yaml#cinnabar-sans-typeface`. Cinnabar Sans is the app's
   default interface face: two bundled variable files (upright, italic) declared with @font-face in
   the fork's theme layer and placed first in --fork-font-sans. Lose the files, a face, or the stack
   position and the app silently falls back to Geist with no error anywhere. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { atRuleBodies, cssRules, fontFamilies } from "./cssRules";

function siblingPath(relativePath: string): string {
  return NodeURL.fileURLToPath(new URL(relativePath, import.meta.url));
}
function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(siblingPath(relativePath), "utf8");
}

const css = readSibling("../theme.custom.css");
const cinnabarFaces = atRuleBodies(css, "@font-face").filter((body) =>
  /font-family:\s*"Cinnabar Sans"/u.test(body),
);

describe("fork guard: cinnabar-sans-typeface", () => {
  it("bundles the upright and italic variable files with their license", () => {
    for (const file of ["CinnabarSans-Variable.woff2", "CinnabarSans-Italic-Variable.woff2"]) {
      const bytes = NodeFS.readFileSync(siblingPath(`../custom/fonts/cinnabar-sans/${file}`));
      // WOFF2 signature: a renamed or truncated file would 404 as a font, not as a build error.
      expect(bytes.subarray(0, 4).toString("latin1")).toBe("wOF2");
    }
    expect(readSibling("../custom/fonts/cinnabar-sans/OFL.txt")).toContain(
      "SIL OPEN FONT LICENSE Version 1.1",
    );
  });

  it("declares a normal and an italic face, each spanning weights 100..900", () => {
    expect(cinnabarFaces).toHaveLength(2);
    const byStyle = (style: string) =>
      cinnabarFaces.find((body) => new RegExp(`font-style:\\s*${style};`, "u").test(body));
    const upright = byStyle("normal");
    const italic = byStyle("italic");
    expect(upright).toMatch(/font-weight:\s*100 900;/u);
    expect(italic).toMatch(/font-weight:\s*100 900;/u);
    expect(upright).toContain("cinnabar-sans/CinnabarSans-Variable.woff2");
    expect(italic).toContain("cinnabar-sans/CinnabarSans-Italic-Variable.woff2");
  });

  // The stack's lead and scope are pinned in forkTypographySettings.test.ts.
  it("keeps Geist right behind it as the fallback", () => {
    const fonts = cssRules(css).find((entry) => entry.body.includes("--fork-font-sans:"));
    const stack = fontFamilies(/--fork-font-sans:([^;]*);/u.exec(fonts?.body ?? "")?.[1] ?? "");
    expect(stack[1]).toBe("Geist Variable");
  });
});
