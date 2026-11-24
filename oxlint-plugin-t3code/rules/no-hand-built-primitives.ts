import { defineRule } from "@oxlint/plugins";

const PRIMITIVE_FOR_ROLE: Record<string, string> = {
  menu: "Menu (components/ui/menu)",
  listbox: "Select or Combobox (components/ui/select, components/ui/combobox)",
  dialog: "Dialog, Sheet or Popover (components/ui/dialog, sheet, popover)",
  alertdialog: "AlertDialog (components/ui/alert-dialog)",
  tooltip: "Tooltip (components/ui/tooltip)",
};

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow hand-built interactive primitives in fork code: styled raw buttons and host elements playing menu, listbox, dialog or tooltip.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier" || !/^[a-z]/u.test(node.name.name)) return;
        for (const attribute of node.attributes) {
          if (attribute.type !== "JSXAttribute" || attribute.name.type !== "JSXIdentifier")
            continue;
          if (node.name.name === "button" && attribute.name.name === "className") {
            context.report({
              node,
              message:
                "A styled raw <button> rebuilds Button. Use Button (components/ui/button) with a variant and size, or add the variant there.",
            });
          }
          if (attribute.name.name !== "role" || attribute.value?.type !== "Literal") continue;
          const primitive = PRIMITIVE_FOR_ROLE[String(attribute.value.value)];
          if (primitive) {
            context.report({
              node: attribute,
              message: `role="${String(attribute.value.value)}" on a host element rebuilds a primitive. Use ${primitive}.`,
            });
          }
        }
      },
    };
  },
});
