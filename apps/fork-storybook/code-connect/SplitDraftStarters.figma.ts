// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=507-12656
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/splitThreads/SplitDraftStarters.tsx
// component=SplitDraftStarters
import figma from "figma";

// ChatView shows it on an empty split draft; a row hands its prompt back to be added to the composer.
export default {
  example: figma.tsx`<SplitDraftStarters bottomInset={composerReservedHeight} onPick={insertStarter} />`,
  imports: ['import { SplitDraftStarters } from "~/custom/splitThreads/SplitDraftStarters";'],
  id: "split-draft-starters",
};
