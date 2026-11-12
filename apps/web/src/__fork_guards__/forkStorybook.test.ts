// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-storybook`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { FORK_PALETTE_STORAGE_KEY, INLET_THEME } from "../custom/forkTheme";
import { THEME_APPEARANCE_MODE_STORAGE_KEY } from "../themePalette";

function read(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const storybook = "../../../fork-storybook/.storybook/";
const mainTsx = read("../main.tsx");
const preview = read(`${storybook}preview.tsx`);

// Side-effect imports that style the page: stylesheets and font packages.
function styleImports(source: string): string[] {
  return [...source.matchAll(/^import "([^"]+)";$/gm)]
    .map(([, path]) => path!)
    .filter((path) => path.endsWith(".css") || path.startsWith("@fontsource"));
}

describe("fork-storybook", () => {
  it("loads exactly the app's stylesheets, in main.tsx's order", () => {
    const appStyles = styleImports(mainTsx).map((path) => path.replace(/^\.\//, "~/"));
    expect(appStyles.length).toBeGreaterThan(0);
    expect(styleImports(preview)).toEqual(appStyles);
  });

  it("runs main.tsx's theme startup", () => {
    for (const call of ["applyForkMarker(", "initializeForkTheme()", "installInletMenuMorph()"]) {
      expect(mainTsx).toContain(call);
      expect(preview).toContain(call);
    }
  });

  it("stores the preferences forkTheme.ts and useTheme read", () => {
    const appearance = read(`${storybook}appearance.ts`);
    expect(preview.indexOf('import "./appearance.ts"')).toBe(preview.indexOf("import "));
    expect(appearance).toContain(`"${FORK_PALETTE_STORAGE_KEY}": "${INLET_THEME}"`);
    expect(appearance).toContain(`"${THEME_APPEARANCE_MODE_STORAGE_KEY}": "dark"`);
  });

  it("resolves modules as the app's Vite config does", () => {
    const viteConfig = read("../../vite.config.ts");
    const main = read(`${storybook}main.ts`);
    for (const piece of [
      "forkOverrides(",
      "forkBrandName()",
      "react({ compiler: true })",
      "custom/icons/lucide-phosphor.tsx",
      "tsconfigPaths: true",
    ]) {
      expect(viteConfig).toContain(piece);
      expect(main).toContain(piece);
    }
  });
});
