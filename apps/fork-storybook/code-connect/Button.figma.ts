// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=15-3730
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/button.tsx
// component=Button
import figma from "figma";

const button = figma.selectedInstance;
const variant = button.getEnum("Variant", {
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  "ghost-muted": "ghost-muted",
  "ghost-destructive": "ghost-destructive",
  destructive: "destructive",
  "destructive-outline": "destructive-outline",
  "warning-outline": "warning-outline",
  link: "link",
});
const size = button.getEnum("Size", { xs: "xs", sm: "sm", "sm-pill": "sm-pill", lg: "lg" });
const disabled = button.getEnum("State", { Disabled: true });
const iconSide = button.getEnum("Icon", { Left: "left", Right: "right" });
const label = button.getString("Label");

// The kit's glyphs are `icon/<lucide-name>`, which the app imports as `<PascalName>Icon`.
function glyph(prop: string): string | null {
  const instance = button.getInstanceSwap(prop);
  if (!instance || instance.type !== "INSTANCE") return null;
  const name = instance.name.replace(/^icon\//u, "");
  return `${name.replace(/(^|-)([a-z0-9])/gu, (_, __, c: string) => c.toUpperCase())}Icon`;
}
const icon =
  iconSide === "left"
    ? glyph("Leading glyph")
    : iconSide === "right"
      ? glyph("Trailing glyph")
      : null;

const attrs = [
  variant ? ` variant="${variant}"` : "",
  size ? ` size="${size}"` : "",
  disabled ? " disabled" : "",
].join("");
const body =
  icon === null
    ? label
    : iconSide === "left"
      ? `\n  <${icon} />\n  ${label}\n`
      : `\n  ${label}\n  <${icon} />\n`;

export default {
  example: figma.tsx`<Button${attrs}>${body}</Button>`,
  imports: [
    'import { Button } from "~/components/ui/button";',
    ...(icon ? [`import { ${icon} } from "lucide-react";`] : []),
  ],
  id: "button",
  metadata: { nestable: true },
};
