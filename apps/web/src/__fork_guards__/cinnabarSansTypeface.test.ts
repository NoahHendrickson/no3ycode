// @effect-diagnostics nodeBuiltinImport:off
/* Fork guard, see `.fork/customizations.yaml#cinnabar-sans-typeface`. Cinnabar Sans is the app's
   default interface face: two bundled variable files (upright, italic) declared with @font-face in
   the fork's theme layer and placed first in --fork-font-sans. Lose the files, a face, or the stack
   position and the app silently falls back to Geist with no error anywhere. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { FORK_DEFAULT_SANS_FAMILY, forkInterfaceFontPreset } from "../custom/forkTypographyScale";
import { cssRules } from "./cssRules";

function siblingPath(relativePath: string): string {
  return NodeURL.fileURLToPath(new URL(relativePath, import.meta.url));
}
function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(siblingPath(relativePath), "utf8");
}

const normalize = (value: string) => value.replace(/\s+/gu, " ").trim();
const MARKER = ':root[data-fork="noahhendrickson-t3code"]';
const css = readSibling("../theme.custom.css");
const theme = cssRules(css);
// cssRules treats an `@…` header as a wrapper and returns only the rules inside it, so an
// @font-face (a leaf at-rule) never comes back from it. Its body cannot hold braces, so a plain
// match over the comment-stripped sheet reads it exactly.
const faces = [...css.replace(/\/\*[\s\S]*?\*\//gu, "").matchAll(/@font-face\s*\{([^}]*)\}/gu)].map(
  (match) => ({ body: match[1] ?? "" }),
);
const cinnabarFaces = faces.filter((entry) => /font-family:\s*"Cinnabar Sans"/u.test(entry.body));

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
      cinnabarFaces.find((entry) => new RegExp(`font-style:\\s*${style};`, "u").test(entry.body));
    const upright = byStyle("normal");
    const italic = byStyle("italic");
    expect(upright?.body).toMatch(/font-weight:\s*100 900;/u);
    expect(italic?.body).toMatch(/font-weight:\s*100 900;/u);
    expect(upright?.body).toContain("cinnabar-sans/CinnabarSans-Variable.woff2");
    expect(italic?.body).toContain("cinnabar-sans/CinnabarSans-Italic-Variable.woff2");
  });

  it("leads the marker-scoped sans stack, with Geist next as the fallback", () => {
    const fonts = theme.find((entry) => entry.body.includes("--fork-font-sans:"));
    expect(normalize(fonts?.selector ?? "")).toBe(MARKER);
    expect(fonts?.body).toMatch(/--fork-font-sans:\s*"Cinnabar Sans",\s*"Geist Variable",/u);
    expect(FORK_DEFAULT_SANS_FAMILY).toBe("Cinnabar Sans");
  });

  it("labels the empty preference Cinnabar Sans and keeps Geist as a preset", () => {
    expect(forkInterfaceFontPreset("")?.label).toBe("Cinnabar Sans");
    expect(forkInterfaceFontPreset("Geist Variable")?.label).toBe("Geist");
  });
});
