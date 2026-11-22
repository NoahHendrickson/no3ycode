// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-storybook`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { BASIC_THEME, FORK_PALETTE_STORAGE_KEY } from "../custom/forkTheme";

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
    for (const call of [
      "applyForkMarker(",
      "initializeForkTheme()",
      "initializeForkGlass3d()",
      "installInletMenuMorph()",
    ]) {
      expect(mainTsx).toContain(call);
      expect(preview).toContain(call);
    }
  });

  it("stores Basic before any app module loads, and moves themes as Settings does", () => {
    const appearance = read(`${storybook}appearance.ts`);
    expect(preview.indexOf('import "./appearance.ts"')).toBe(preview.indexOf("import "));
    expect(appearance).toContain(`"${FORK_PALETTE_STORAGE_KEY}": "${BASIC_THEME}"`);
    expect(preview).toContain("setForkBasicTone(");
    expect(preview).toContain("setForkAppearance(COOL_DARKER_THEME, setTheme)");
    expect(preview).toMatch(
      /setForkInletColor\(theme\.color, setTheme\);\s*setForkAppearance\(INLET_THEME, setTheme\);/u,
    );
    const themes = read(`${storybook}../stories/storyTheme.ts`);
    expect(themes).toContain("BASIC_TONES.map(");
    expect(themes).toContain("INLET_COLORS.map(");
    // Glass is a macOS 26+ window: the bridge reports sidebar Liquid Glass, the stand-in glass
    // paints only once the app stamps that marker, and the sidebar canvas is docked under Glass.
    expect(appearance).toMatch(
      /setSidebarVibrancy: async \(enabled: boolean\) => \(enabled \? "liquid-glass"/u,
    );
    expect(appearance).toContain("sidebarLiquidGlass: { setWidth:");
    const head = read(`${storybook}preview-head.html`);
    expect(head).toMatch(
      /html\[data-fork-sidebar-vibrancy="liquid-glass"\] \{[^}]*--story-liquid-glass:/u,
    );
    expect(head).toContain('[data-fork-liquid-glass-popup="glass"]');
    expect(preview).toContain('glass={storyTheme(context.globals).palette === "glass"}');
  });

  it("resolves modules as the app's Vite config does", () => {
    const viteConfig = read("../../vite.config.ts");
    const main = read(`${storybook}main.ts`);
    for (const piece of [
      "forkOverrides(",
      "forkBrandName()",
      "react({ compiler: true })",
      "custom/icons/lucide-hugeicons.tsx",
      "tsconfigPaths: true",
    ]) {
      expect(viteConfig).toContain(piece);
      expect(main).toContain(piece);
    }
  });

  it("scans the stories with the app's Tailwind entry", () => {
    expect(read("../index.css")).toContain('@import "tailwindcss";');
  });
});
