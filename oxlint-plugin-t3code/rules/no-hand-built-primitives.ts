import { defineRule, type ESTree } from "@oxlint/plugins";

const PRIMITIVE_FOR_ROLE: Record<string, string> = {
  menu: "Menu (components/ui/menu)",
  listbox: "Select or Combobox (components/ui/select, components/ui/combobox)",
  dialog: "Dialog, Sheet or Popover (components/ui/dialog, sheet, popover)",
  alertdialog: "AlertDialog (components/ui/alert-dialog)",
  tooltip: "Tooltip (components/ui/tooltip)",
};

/** A role written as "x", {"x"} or {`x`}; null when it is computed. */
function staticString(value: ESTree.JSXAttribute["value"]): string | null {
  const node = value?.type === "JSXExpressionContainer" ? value.expression : value;
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0]?.value.cooked ?? null;
  return null;
}

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow host elements playing menu, listbox, dialog or tooltip in fork code: each rebuilds a primitive's focus and keyboard model.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier" || !/^[a-z]/u.test(node.name.name)) return;
        for (const attribute of node.attributes) {
          if (attribute.type !== "JSXAttribute" || attribute.name.type !== "JSXIdentifier")
            continue;
          if (attribute.name.name !== "role") continue;
          const role = staticString(attribute.value);
          const primitive = role === null ? undefined : PRIMITIVE_FOR_ROLE[role];
          if (primitive) {
            context.report({
              node: attribute,
              message: `role="${role}" on a host element rebuilds a primitive. Use ${primitive}.`,
            });
          }
        }
      },
    };
  },
});
