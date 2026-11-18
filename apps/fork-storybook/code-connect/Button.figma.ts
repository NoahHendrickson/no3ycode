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

// The glyph renders through its own connection (icons.figma.batch.ts), imports included.
const swapped =
  iconSide === "left"
    ? button.getInstanceSwap("Leading glyph")
    : iconSide === "right"
      ? button.getInstanceSwap("Trailing glyph")
      : undefined;
const icon = swapped && swapped.type === "INSTANCE" ? swapped.executeTemplate().example : null;

const attrs = [
  variant ? ` variant="${variant}"` : "",
  size ? ` size="${size}"` : "",
  disabled ? " disabled" : "",
].join("");

export default {
  example:
    icon === null
      ? figma.tsx`<Button${attrs}>${label}</Button>`
      : iconSide === "left"
        ? figma.tsx`<Button${attrs}>
  ${icon}
  ${label}
</Button>`
        : figma.tsx`<Button${attrs}>
  ${label}
  ${icon}
</Button>`,
  imports: ['import { Button } from "~/components/ui/button";'],
  id: "button",
  metadata: { nestable: true },
};
