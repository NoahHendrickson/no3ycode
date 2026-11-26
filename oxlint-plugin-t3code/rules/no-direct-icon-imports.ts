import { defineRule } from "@oxlint/plugins";

// lucide-react resolves to the shim through an alias, so upstream files keep their imports; fork
// files name the shim, which owns the stroke and fill policy.
const ICON_SOURCE =
  /^(?:lucide(?:-react)?|@hugeicons\/.+|@phosphor-icons\/.+|@tabler\/icons(?:-react)?(?:\/.*)?|@heroicons\/.+|@radix-ui\/react-icons|react-icons(?:\/.*)?)$/u;

const MESSAGE =
  "Import icons from the fork's Hugeicons shim (~/custom/icons/lucide-hugeicons), not an icon package. The shim owns each glyph's stroke and fill policy.";

const isIconSource = (value: unknown) => typeof value === "string" && ICON_SOURCE.test(value);

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require fork code to take icons from the Hugeicons shim.",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (isIconSource(node.source.value))
          context.report({ node: node.source, message: MESSAGE });
      },
      ExportNamedDeclaration(node) {
        if (node.source && isIconSource(node.source.value)) {
          context.report({ node: node.source, message: MESSAGE });
        }
      },
      ExportAllDeclaration(node) {
        if (isIconSource(node.source.value))
          context.report({ node: node.source, message: MESSAGE });
      },
      ImportExpression(node) {
        if (node.source.type === "Literal" && isIconSource(node.source.value)) {
          context.report({ node: node.source, message: MESSAGE });
        }
      },
    };
  },
});
