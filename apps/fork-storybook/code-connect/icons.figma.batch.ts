import figma from "figma";

// One entry per kit glyph (`icon/<lucide-name>`) in icons.figma.batch.json; the app imports every
// glyph from "lucide-react", which apps/web aliases to its Hugeicons shim.
export default {
  example: figma.tsx`<${figma.batch.name} />`,
  imports: [`import { ${figma.batch.name} } from "lucide-react";`],
  id: figma.batch.name,
  metadata: { nestable: true },
};
