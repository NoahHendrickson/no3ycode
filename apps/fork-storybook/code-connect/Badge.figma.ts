// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=36-202
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/badge.tsx
// component=Badge
import figma from "figma";

import { attrs, glyphWithImports, jsxText } from "./shared";

const badge = figma.selectedInstance;
const variant = badge.getEnum("Variant", {
  secondary: "secondary",
  outline: "outline",
  destructive: "destructive",
  error: "error",
  info: "info",
  success: "success",
  warning: "warning",
  label: "label",
});
const size = badge.getEnum("Size", { sm: "sm", lg: "lg", control: "control" });
const icon = badge.getBoolean("Icon") ? glyphWithImports(badge, "Glyph") : null;
const label = jsxText(badge.getString("Label"));
const tag = `<Badge${attrs(variant && ` variant="${variant}"`, size && ` size="${size}"`)}>`;
const IMPORT = 'import { Badge } from "~/components/ui/badge";';

export default {
  example: icon
    ? figma.tsx`${tag}
  ${icon.example}
  ${label}
</Badge>`
    : figma.tsx`${tag}${label}</Badge>`,
  imports: [IMPORT],
  id: "badge",
  metadata: { nestable: true, props: { imports: [IMPORT, ...(icon?.imports ?? [])] } },
};
