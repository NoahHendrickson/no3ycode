// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-figma-code-connect`.
 *
 * Every Code Connect template must name a kit component and an app component that still exists
 * under that name; a source that moved, or a component renamed inside its file, would publish a
 * snippet Dev Mode shows against code that no longer compiles.
 */

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const storybook = NodeURL.fileURLToPath(new URL("../../../fork-storybook/", import.meta.url));
const repoRoot = NodePath.resolve(storybook, "../..");
const templatesDir = NodePath.join(storybook, "code-connect");
const KIT_URL = "https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/";
const SOURCE_PREFIX = "https://github.com/NoahHendrickson/no3ycode/blob/custom/";

const templates = NodeFS.readdirSync(templatesDir)
  .filter((name) => name.endsWith(".figma.ts"))
  .map((name) => ({ name, text: NodeFS.readFileSync(NodePath.join(templatesDir, name), "utf8") }));

function exports(source: string, name: string): boolean {
  return new RegExp(
    `export\\s+(?:const|function|class)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`,
    "u",
  ).test(source);
}

describe("fork guard: fork-figma-code-connect", () => {
  it("connects each kit component set once", () => {
    const nodes = templates.map(({ text }) => /node-id=(\d+-\d+)/u.exec(text)?.[1]).toSorted();
    expect(nodes).toEqual(["15-3730", "15-3966", "30-72", "40-105", "40-191", "99-1032"]);
  });

  it("connects every kit glyph to an export of the app's icon shim", () => {
    const batch = JSON.parse(
      NodeFS.readFileSync(NodePath.join(templatesDir, "icons.figma.batch.json"), "utf8"),
    ) as { templateFile: string; components: ReadonlyArray<{ url: string; component: string }> };
    expect(NodeFS.existsSync(NodePath.join(templatesDir, batch.templateFile))).toBe(true);
    const shim = NodeFS.readFileSync(
      NodePath.join(repoRoot, "apps/web/src/custom/icons/lucide-hugeicons.tsx"),
      "utf8",
    );
    // Every glyph on the kit's Icons page, each node once.
    expect(batch.components).toHaveLength(274);
    expect(new Set(batch.components.map((icon) => icon.url)).size).toBe(274);
    for (const icon of batch.components) {
      expect(icon.url.startsWith(KIT_URL), icon.component).toBe(true);
      expect(exports(shim, icon.component), icon.component).toBe(true);
    }
  });

  it.each(templates.map((template) => [template.name, template.text] as const))(
    "%s names a kit component and an app component its source still exports",
    (_name, text) => {
      expect(/^\/\/ url=(\S+)$/mu.exec(text)?.[1]?.startsWith(KIT_URL)).toBe(true);
      const source = /^\/\/ source=(\S+)$/mu.exec(text)?.[1] ?? "";
      expect(source.startsWith(SOURCE_PREFIX)).toBe(true);
      const sourcePath = NodePath.join(repoRoot, source.slice(SOURCE_PREFIX.length));
      expect(NodeFS.existsSync(sourcePath)).toBe(true);
      const component = /^\/\/ component=(\w+)$/mu.exec(text)?.[1] ?? "";
      expect(exports(NodeFS.readFileSync(sourcePath, "utf8"), component), component).toBe(true);
    },
  );
});
