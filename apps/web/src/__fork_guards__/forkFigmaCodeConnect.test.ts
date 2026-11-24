// @effect-diagnostics nodeBuiltinImport:off
// Fork guard — see `.fork/customizations.yaml#fork-figma-code-connect`. Each template names a kit
// component and an app component its source still exports, so Dev Mode never shows a snippet for
// code that moved; one that imports nothing may name a private component its source defines.

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

function defines(source: string, name: string): boolean {
  return new RegExp(`(?:const|function)\\s+${name}\\b`, "u").test(source);
}

// Every connected kit component, by node id.
const CONNECTED_NODES = [
  "15-3730",
  "15-3966",
  "21-80",
  "26-76",
  "27-2078",
  "28-30",
  "30-72",
  "36-202",
  "37-27",
  "39-122",
  "39-492",
  "40-105",
  "40-191",
  "44-188",
  "44-191",
  "44-208",
  "44-256",
  "45-171",
  "45-213",
  "45-227",
  "46-3",
  "49-79",
  "50-147",
  "51-71",
  "51-84",
  "51-86",
  "51-92",
  "51-115",
  "52-2",
  "52-75",
  "52-81",
  "54-1391",
  "56-429",
  "58-2",
  "58-25",
  "58-26",
  "59-86",
  "59-93",
  "59-234",
  "59-247",
  "59-297",
  "61-15",
  "61-25",
  "61-72",
  "61-100",
  "61-112",
  "61-113",
  "61-128",
  "62-32",
  "62-42",
  "62-43",
  "62-88",
  "62-122",
  "62-148",
  "63-10",
  "63-33",
  "63-77",
  "63-87",
  "65-24",
  "65-51",
  "65-121",
  "65-164",
  "66-25",
  "66-136",
  "67-8",
  "68-51",
  "68-54",
  "72-651",
  "72-657",
  "72-670",
  "72-702",
  "72-711",
  "72-876",
  "72-955",
  "72-1068",
  "72-1081",
  "91-738",
  "99-768",
  "99-774",
  "99-1032",
  "124-949",
  "242-178",
  "242-1016",
  "244-382",
  "245-510",
  "245-569",
];

describe("fork guard: fork-figma-code-connect", () => {
  it("connects each kit component set once", () => {
    const nodes = templates.map(({ text }) => /node-id=(\d+-\d+)/u.exec(text)?.[1]).toSorted();
    expect(nodes).toEqual(CONNECTED_NODES.toSorted());
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
      const sourceText = NodeFS.readFileSync(sourcePath, "utf8");
      const found = /^\s*imports: \[\],$/mu.test(text)
        ? defines(sourceText, component)
        : exports(sourceText, component);
      expect(found, component).toBe(true);
    },
  );
});
