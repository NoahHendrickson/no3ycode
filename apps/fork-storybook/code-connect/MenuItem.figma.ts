// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=44-208
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/menu.tsx
// component=MenuItem
import figma from "figma";

import { attrs, glyphWithImports, jsxText, slug } from "./shared";

const item = figma.selectedInstance;
const label = item.getString("Label");
const type = item.getEnum("Type", {
  Default: "item",
  Destructive: "destructive",
  "Checkbox on": "checked",
  "Checkbox off": "checkbox",
  "Radio selected": "radio",
  Radio: "radio",
  Submenu: "submenu",
});
const disabled = item.getEnum("State", { Disabled: " disabled" });
const icon = item.getBoolean("Icon") ? glyphWithImports(item, "Glyph") : null;
const shortcut = item.getBoolean("Shortcut")
  ? `<MenuShortcut>${jsxText(item.getString("Keys"))}</MenuShortcut>`
  : null;

// Checkbox and radio rows draw their own indicator; a radio's pick comes from its MenuRadioGroup.
const [tag, close, parts] =
  type === "checked" || type === "checkbox"
    ? [
        `<MenuCheckboxItem${attrs(type === "checked" && " defaultChecked", disabled)}>`,
        "</MenuCheckboxItem>",
        ["MenuCheckboxItem"],
      ]
    : type === "radio"
      ? [
          `<MenuRadioItem value="${slug(label)}"${disabled ?? ""}>`,
          "</MenuRadioItem>",
          ["MenuRadioItem"],
        ]
      : type === "submenu"
        ? [`<MenuSubTrigger${disabled ?? ""}>`, "</MenuSubTrigger>", ["MenuSubTrigger"]]
        : [
            `<MenuItem${attrs(type === "destructive" && ' variant="destructive"', disabled)}>`,
            "</MenuItem>",
            ["MenuItem"],
          ];
const imports = [
  `import { ${[...parts, ...(shortcut ? ["MenuShortcut"] : [])].join(", ")} } from "~/components/ui/menu";`,
];
const withIcon = icon && (type === "item" || type === "destructive" || type === "submenu");

export default {
  example: withIcon
    ? figma.tsx`${tag}
  ${icon.example}
  ${jsxText(label)}${shortcut ? `\n  ${shortcut}` : ""}
${close}`
    : shortcut
      ? figma.tsx`${tag}
  ${jsxText(label)}
  ${shortcut}
${close}`
      : figma.tsx`${tag}${jsxText(label)}${close}`,
  imports,
  id: "menu-item",
  metadata: { nestable: true, props: { imports: [...imports, ...(withIcon ? icon.imports : [])] } },
};
