// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=318-578
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/chat/ComposerBannerStack.tsx
// component=ComposerBannerStack
import figma from "figma";

// ChatComposer hands its notices (usage limit, branch mismatch, resume with less context, thread
// state) to the stack as items built by their own hooks, so the snippet is the stack itself.
export default {
  example: figma.tsx`<ComposerBannerStack items={items} />`,
  imports: ['import { ComposerBannerStack } from "~/components/chat/ComposerBannerStack";'],
  id: "notice-card",
};
