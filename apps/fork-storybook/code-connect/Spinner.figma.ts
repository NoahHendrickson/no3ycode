// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=59-297
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/spinner.tsx
// component=Spinner
import figma from "figma";

import { attrs } from "./shared";

const spinner = figma.selectedInstance;
const IMPORT = 'import { Spinner } from "~/components/ui/spinner";';

export default {
  example: figma.tsx`<Spinner${attrs(
    spinner.getEnum("Size", {
      "12": ' size="xs"',
      "14": ' size="sm"',
      "16": ' size="md"',
      "20": ' size="lg"',
    }),
    spinner.getEnum("Tone", { muted: ' tone="muted"' }),
  )} />`,
  imports: [IMPORT],
  id: "spinner",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
