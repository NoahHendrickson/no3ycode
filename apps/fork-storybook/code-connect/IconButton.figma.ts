// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=15-3966
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
const size =
  button.getEnum("Size", {
    "icon-xs": "icon-xs",
    "icon-sm": "icon-sm",
    "icon-sm-pill": "icon-sm-pill",
    "icon-lg": "icon-lg",
  }) ?? "icon";
const disabled = button.getEnum("State", { Disabled: true });

// The glyph renders through its own connection (icons.figma.batch.ts), imports included.
const swapped = button.getInstanceSwap("Glyph");
const icon = swapped && swapped.type === "INSTANCE" ? swapped.executeTemplate().example : null;

const attrs = [
  variant ? ` variant="${variant}"` : "",
  ` size="${size}"`,
  disabled ? " disabled" : "",
].join("");

export default {
  example: figma.tsx`<Button${attrs} aria-label="…">
  ${icon}
</Button>`,
  imports: ['import { Button } from "~/components/ui/button";'],
  id: "icon-button",
  metadata: { nestable: true },
};
