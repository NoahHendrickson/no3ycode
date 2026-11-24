// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=323-1260
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ComposerUsageLimitsReadout.tsx
// component=composerUsageReadout
import figma from "figma";

// The usage ring and the menu it opens (UsageLimitsPooled inside a Popover) come as one readout.
export default {
  example: figma.tsx`{composerUsageReadout({ usageLimits, enabled })}`,
  imports: ['import { composerUsageReadout } from "~/custom/ComposerUsageLimitsReadout";'],
  id: "usage-menu",
};
