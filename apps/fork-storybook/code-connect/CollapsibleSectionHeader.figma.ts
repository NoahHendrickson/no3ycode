// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=62-122
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/collapsible-section-header.tsx
// component=CollapsibleSectionHeader
import figma from "figma";

import { jsxText } from "./shared";

// The count accessory is the sidebar's own (SidebarListMarkers.tsx). The kit has a Count variant and a
// Count text property, so the text is read from its layer rather than by property name.
const header = figma.selectedInstance;
const expanded = header.getEnum("Expanded", { Yes: "true", No: "false" }) ?? "true";
const countLayer = header.getEnum("Count", { Yes: true }) ? header.findText("Count") : null;
const count =
  countLayer?.type === "TEXT"
    ? `\n  accessory={<span className="font-normal tabular-nums">${jsxText(countLayer.textContent)}</span>}`
    : "";
const IMPORT =
  'import { CollapsibleSectionHeader } from "~/components/ui/collapsible-section-header";';

export default {
  example: figma.tsx`<CollapsibleSectionHeader
  expanded={${expanded}}
  onClick={onToggle}${count}
>
  ${jsxText(header.getString("Label"))}
</CollapsibleSectionHeader>`,
  imports: [IMPORT],
  id: "collapsible-section-header",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
