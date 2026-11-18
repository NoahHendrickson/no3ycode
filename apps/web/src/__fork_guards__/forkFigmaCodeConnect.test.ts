// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-figma-code-connect`.
 *
 * Every Code Connect template must name a component in the Basic UI kit and the
 * app file it maps to; a template pointed at another file, or at a source that
 * moved, publishes a snippet Dev Mode shows against the wrong component.
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

describe("fork guard: fork-figma-code-connect", () => {
  it("publishes the code-connect templates as React", () => {
    const config = JSON.parse(
      NodeFS.readFileSync(NodePath.join(storybook, "figma.config.json"), "utf8"),
    );
    expect(config.codeConnect).toMatchObject({
      include: ["code-connect/**/*.figma.ts", "code-connect/**/*.figma.batch.json"],
      label: "React",
    });
    expect(templates.length).toBeGreaterThan(0);
  });

  it("connects every kit glyph to an export of the app's icon shim", () => {
    const batch = JSON.parse(
      NodeFS.readFileSync(NodePath.join(templatesDir, "icons.figma.batch.json"), "utf8"),
    ) as { templateFile: string; components: ReadonlyArray<{ url: string; name: string }> };
    expect(NodeFS.existsSync(NodePath.join(templatesDir, batch.templateFile))).toBe(true);
    const shim = NodeFS.readFileSync(
      NodePath.join(repoRoot, "apps/web/src/custom/icons/lucide-hugeicons.tsx"),
      "utf8",
    );
    const exported = new Set([...shim.matchAll(/export const (\w+)\b/gu)].map((match) => match[1]));
    expect(batch.components.length).toBeGreaterThan(0);
    for (const icon of batch.components) {
      expect(icon.url.startsWith(KIT_URL), icon.name).toBe(true);
      expect(exported.has(icon.name), icon.name).toBe(true);
    }
  });

  it.each(templates.map((template) => [template.name, template.text] as const))(
    "%s names a kit component and an app source that exists",
    (_name, text) => {
      const url = /^\/\/ url=(\S+)$/mu.exec(text)?.[1];
      expect(url?.startsWith(KIT_URL)).toBe(true);
      expect(url).toMatch(/[?&]node-id=\d+-\d+/u);
      const source = /^\/\/ source=(\S+)$/mu.exec(text)?.[1] ?? "";
      expect(source.startsWith(SOURCE_PREFIX)).toBe(true);
      expect(NodeFS.existsSync(NodePath.join(repoRoot, source.slice(SOURCE_PREFIX.length)))).toBe(
        true,
      );
      expect(text).toContain('import figma from "figma";');
    },
  );
});
