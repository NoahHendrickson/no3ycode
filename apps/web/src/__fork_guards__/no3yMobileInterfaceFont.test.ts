// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#no3y-mobile-interface-font`.
 *
 * The iPhone can draw Cinnabar Sans: the faces are bundled, the pick persists, and every surface
 * that names a font family follows it.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const mobile = (path: string) =>
  NodeURL.fileURLToPath(new URL(`../../../mobile/${path}`, import.meta.url));
const read = (path: string) => NodeFS.readFileSync(mobile(path), "utf8");

const FACES = ["Regular", "Italic", "Medium", "MediumItalic", "SemiBold", "Bold"];

describe("no3y-mobile-interface-font", () => {
  it("bundles every Cinnabar Interface face the PostScript names point at", () => {
    const config = read("app.config.ts");
    expect(config).toContain("...cinnabarInterfaceFonts");
    for (const face of FACES) {
      expect(config).toContain(`"${face}"`);
      expect(
        NodeFS.existsSync(
          mobile(`fork/assets/fonts/cinnabar-interface/CinnabarInterface-${face}.ttf`),
        ),
      ).toBe(true);
    }
    const font = read("fork/no3yInterfaceFont.ts");
    for (const name of ["Regular", "Medium", "Bold"]) {
      expect(font).toContain(`"CinnabarInterface-${name}"`);
    }
  });

  it("keeps the pick in preferences and applies it on launch", () => {
    expect(read("src/persistence/mobile-preferences.ts")).toContain(
      'parsed.interfaceFont === "cinnabar"',
    );
    const provider = read("src/features/settings/appearance/AppearancePreferencesProvider.tsx");
    expect(provider).toContain("applyNo3yInterfaceFont(");
    expect(provider).toContain("?.interfaceFont");
    expect(read("src/features/settings/SettingsAppearanceRouteScreen.tsx")).toContain(
      "<No3yInterfaceFontSection />",
    );
  });

  it("routes native-styled text through the picked families", () => {
    for (const path of [
      "src/features/threads/ThreadFeed.tsx",
      "src/features/files/FileMarkdownPreview.tsx",
      "src/native/useEnrichedLinkVariants.ts",
      "src/native/T3ComposerEditor.ios.tsx",
    ]) {
      const source = read(path);
      expect(source, path).toContain("useFontFamilies()");
      expect(source, path).not.toContain("FONT_FAMILIES.");
    }
  });
});
