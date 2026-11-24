// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=323-1154
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ComposerBackgroundWork.tsx
// component=ComposerBackgroundWorkChip
import figma from "figma";

// The menu is the chip's own popup (the shared Menu); the chip renders it from the presentation.
export default {
  example: figma.tsx`<ComposerBackgroundWorkChip
  seed={seed}
  presentation={presentation}
  stopping={stopping}
  canStop={canStop}
  onStop={onStop}
  onOpenThread={onOpenThread}
  environmentId={environmentId}
/>`,
  imports: ['import { ComposerBackgroundWorkChip } from "~/custom/ComposerBackgroundWork";'],
  id: "background-work-menu",
};
