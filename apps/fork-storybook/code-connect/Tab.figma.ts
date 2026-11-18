// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=40-105
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/Tabs.tsx
// component=Tab
import figma from "figma";

const tab = figma.selectedInstance;
const word = tab.getEnum("Kind", { Word: true });
const label = tab.getString("Label");
const disabled = tab.getEnum("State", { Disabled: true });
const value = label.toLowerCase().replace(/\s+/gu, "-");

// The kit's glyphs are `icon/<lucide-name>`, which the app imports as `<PascalName>Icon`.
const instance = tab.getInstanceSwap("Glyph");
const name =
  instance && instance.type === "INSTANCE" ? instance.name.replace(/^icon\//u, "") : "circle";
const icon = `${name.replace(/(^|-)([a-z0-9])/gu, (_, __, c: string) => c.toUpperCase())}Icon`;
const off = disabled ? " disabled" : "";

export default {
  example: word
    ? figma.tsx`<Tab value="${value}"${off}>${label}</Tab>`
    : figma.tsx`<IconTab value="${value}" aria-label="${label}"${off}>
  <${icon} />
</IconTab>`,
  imports: word
    ? ['import { Tab } from "~/custom/Tabs";']
    : ['import { IconTab } from "~/custom/Tabs";', `import { ${icon} } from "lucide-react";`],
  id: "tab",
  metadata: { nestable: true },
};
