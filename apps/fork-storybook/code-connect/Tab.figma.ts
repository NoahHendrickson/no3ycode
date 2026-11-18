// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=40-105
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/Tabs.tsx
// component=Tab
import figma from "figma";

import { glyph, jsxAttr, jsxText } from "./shared";

const tab = figma.selectedInstance;
const word = tab.getEnum("Kind", { Word: true });
const label = tab.getString("Label");
const disabled = tab.getEnum("State", { Disabled: true });
const selected = tab.getEnum("State", { Selected: true }) ?? false;
const value =
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "") || "tab";
const off = disabled ? " disabled" : "";
const icon = word ? null : glyph(tab, "Glyph");
const glyphImports = (icon?.metadata?.props?.["imports"] as string[] | undefined) ?? [];

// The strip reads value, selection and the glyph's import from here (Tabs.figma.ts).
export default {
  example: word
    ? figma.tsx`<Tab value="${value}"${off}>${jsxText(label)}</Tab>`
    : figma.tsx`<IconTab value="${value}" aria-label=${jsxAttr(label)}${off}>${icon?.example ?? []}</IconTab>`,
  imports: word
    ? ['import { Tab } from "~/custom/Tabs";']
    : ['import { IconTab } from "~/custom/Tabs";'],
  id: "tab",
  metadata: { nestable: true, props: { value, selected, imports: glyphImports } },
};
