// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=40-105
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/Tabs.tsx
// component=Tab
import figma from "figma";

const tab = figma.selectedInstance;
const word = tab.getEnum("Kind", { Word: true });
const label = tab.getString("Label");
const disabled = tab.getEnum("State", { Disabled: true });
const value = label.toLowerCase().replace(/\s+/gu, "-");
const off = disabled ? " disabled" : "";

// The glyph renders through its own connection (icons.figma.batch.ts), imports included.
const swapped = tab.getInstanceSwap("Glyph");
const icon = swapped && swapped.type === "INSTANCE" ? swapped.executeTemplate().example : null;

export default {
  example: word
    ? figma.tsx`<Tab value="${value}"${off}>${label}</Tab>`
    : figma.tsx`<IconTab value="${value}" aria-label="${label}"${off}>${icon}</IconTab>`,
  imports: word
    ? ['import { Tab } from "~/custom/Tabs";']
    : ['import { IconTab } from "~/custom/Tabs";'],
  id: "tab",
  metadata: { nestable: true },
};
