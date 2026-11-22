// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=245-569
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/bots/SidebarV2BotsSection.tsx
// component=PetalViewOptionsMenu
import figma from "figma";

// The Petals row's View options popup; List keeps the Compact cards toggle, Grid has none.
export default {
  example: figma.tsx`<PetalViewOptionsMenu
  layout={props.layout}
  onLayoutChange={props.onLayoutChange}
  compactCards={props.compactCards}
  onCompactCardsChange={props.onCompactCardsChange}
/>`,
  imports: ['import { PetalViewOptionsMenu } from "~/custom/bots/SidebarV2BotsSection";'],
  id: "petals-view-menu",
};
