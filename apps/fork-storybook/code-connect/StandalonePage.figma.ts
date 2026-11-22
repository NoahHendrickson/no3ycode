// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=67-8
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/standalone-page.tsx
// component=StandalonePage
import figma from "figma";

import { connected, nestedImports, stack } from "./shared";

// The pairing page's card: the header, then the form and actions the page passes in.
const card = figma.selectedInstance;
const alerts = card.getBoolean("Error") ? connected(card, "alert") : [];
const buttons = connected(card, "button");
const body = [...alerts, ...buttons];

export default {
  example: figma.tsx`<StandalonePage>
  <StandalonePageHeader
    title=${JSON.stringify(card.getString("Title"))}
    description=${JSON.stringify(card.getString("Lead"))}
  />
  ${stack(body)}
</StandalonePage>`,
  imports: nestedImports(body, [
    'import { StandalonePage, StandalonePageHeader } from "~/components/ui/standalone-page";',
  ]),
  id: "standalone-page",
};
