// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=242-178
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/UsageMeter.tsx
// component=UsageCircleMeter
import figma from "figma";

// The tone follows the share left: green from 50%, amber from 20%, red under it.
export default {
  example: figma.tsx`<UsageCircleMeter remaining={remaining} />`,
  imports: ['import { UsageCircleMeter } from "~/custom/UsageMeter";'],
  id: "usage-ring",
  metadata: { nestable: true },
};
