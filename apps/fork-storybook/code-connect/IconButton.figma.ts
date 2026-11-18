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
const size = button.getEnum("Size", {
  "icon-xs": "icon-xs",
  "icon-sm": "icon-sm",
  "icon-sm-pill": "icon-sm-pill",
  icon: "icon",
  "icon-lg": "icon-lg",
});
const disabled = button.getEnum("State", { Disabled: true });

// The kit's glyphs are `icon/<lucide-name>`, which the app imports as `<PascalName>Icon`.
const instance = button.getInstanceSwap("Glyph");
const name =
  instance && instance.type === "INSTANCE" ? instance.name.replace(/^icon\//u, "") : "circle";
const icon = `${name.replace(/(^|-)([a-z0-9])/gu, (_, __, c: string) => c.toUpperCase())}Icon`;

const attrs = [
  variant ? ` variant="${variant}"` : "",
  ` size="${size ?? "icon"}"`,
  disabled ? " disabled" : "",
].join("");

export default {
  example: figma.tsx`<Button${attrs} aria-label="${name.replace(/-/gu, " ")}">
  <${icon} />
</Button>`,
  imports: [
    'import { Button } from "~/components/ui/button";',
    `import { ${icon} } from "lucide-react";`,
  ],
  id: "icon-button",
  metadata: { nestable: true },
};
