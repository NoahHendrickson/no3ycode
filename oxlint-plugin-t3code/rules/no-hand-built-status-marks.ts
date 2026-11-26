import { defineRule, type ESTree } from "@oxlint/plugins";

const STATUS_GLYPH = /^CircleHalf(?:Icon)?$/u;
const DOT_SIZE = /^(?:size-(?:0\.5|1|1\.5|2|2\.5|3)|size-\[\d+(?:\.\d+)?px\])$/u;
const STATUS_COLOR =
  /^(?:bg|border|text)-(?:sidebar-v2-status-[a-z]+|success|warning|destructive|info|(?:emerald|green|lime|amber|yellow|orange|red|rose|sky|blue)-\d{2,3})(?:\/\d+)?$/u;

const MESSAGE =
  "Status marks come from custom/SidebarV2StatusIndicator.tsx (SidebarV2StatusMark and friends). Render one of those instead of drawing a status dot or glyph.";

function classTokens(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) classTokens(child, out);
    return out;
  }
  if (typeof node !== "object" || node === null || !("type" in node)) return out;
  const current = node as ESTree.Node;
  if (current.type === "Literal" && typeof current.value === "string") {
    out.push(...current.value.split(/\s+/u));
  } else if (current.type === "TemplateElement") {
    out.push(...(current.value.cooked ?? current.value.raw).split(/\s+/u));
  }
  for (const [key, value] of Object.entries(current)) {
    if (key !== "parent") classTokens(value, out);
  }
  return out;
}

const utility = (token: string) => token.slice(token.lastIndexOf(":") + 1);

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require status marks to come from SidebarV2StatusIndicator: no CircleHalf glyphs or hand-drawn status dots elsewhere.",
    },
  },
  create(context) {
    return {
      ImportSpecifier(node) {
        const imported =
          node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
        if (STATUS_GLYPH.test(imported)) context.report({ node, message: MESSAGE });
      },
      JSXElement(node) {
        const opening = node.openingElement;
        if (opening.name.type !== "JSXIdentifier" || !/^[a-z]/u.test(opening.name.name)) return;
        if (node.children.some((child) => child.type !== "JSXText" || child.value.trim() !== "")) {
          return;
        }
        const className = opening.attributes.find(
          (attribute) =>
            attribute.type === "JSXAttribute" &&
            attribute.name.type === "JSXIdentifier" &&
            attribute.name.name === "className",
        );
        if (!className || className.type !== "JSXAttribute") return;
        const utilities = classTokens(className.value).filter(Boolean).map(utility);
        if (
          utilities.includes("rounded-full") &&
          utilities.some((token) => DOT_SIZE.test(token)) &&
          utilities.some((token) => STATUS_COLOR.test(token))
        ) {
          context.report({ node: opening, message: MESSAGE });
        }
      },
    };
  },
});
