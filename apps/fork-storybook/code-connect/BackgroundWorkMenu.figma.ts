// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=323-1154
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ComposerBackgroundWork.tsx
// component=ComposerBackgroundWorkChip
import figma from "figma";

// The list is the chip's own hover popover; the chip renders it from its items.
export default {
  example: figma.tsx`<ComposerBackgroundWorkChip
  items={items}
  stopping={stopping}
  canStop={canStop}
  onStop={onStop}
  onOpenThread={onOpenThread}
  environmentId={environmentId}
/>`,
  imports: ['import { ComposerBackgroundWorkChip } from "~/custom/ComposerBackgroundWork";'],
  id: "background-work-menu",
};
