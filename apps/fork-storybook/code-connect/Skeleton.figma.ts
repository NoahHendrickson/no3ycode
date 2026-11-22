// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=59-247
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/skeleton.tsx
// component=Skeleton
import figma from "figma";

// The kit draws each shape at a sample size; the app sizes a skeleton with layout classes.
const IMPORT = 'import { Skeleton } from "~/components/ui/skeleton";';
const props = figma.selectedInstance.getEnum("Shape", {
  Line: ' className="h-4 w-40"',
  Square: ' className="size-5"',
  Card: ' shape="card" className="h-16 w-56"',
  Pill: ' shape="pill" className="h-2.5 w-24"',
  Dot: ' shape="pill" className="size-2"',
});

export default {
  example: figma.tsx`<Skeleton${props ?? ""} />`,
  imports: [IMPORT],
  id: "skeleton",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
