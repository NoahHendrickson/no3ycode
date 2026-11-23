// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=62-148
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/panel-tab-close-button.tsx
// component=PanelTabCloseButton
import figma from "figma";

import { jsxAttr } from "./shared";

// A panel tab's leading slot: its glyph, which turns into the close X while the tab is hovered.
// The tab row around it (label, active fill) is each panel's own markup.
const label = figma.selectedInstance.getString("Label");

export default {
  example: figma.tsx`<PanelTabCloseButton label=${jsxAttr(`Close ${label}`)} onClick={onClose}>
  <FileDiffIcon className="size-3" />
</PanelTabCloseButton>`,
  imports: [
    'import { PanelTabCloseButton } from "~/components/ui/panel-tab-close-button";',
    'import { FileDiffIcon } from "lucide-react";',
  ],
  id: "panel-tab",
};
