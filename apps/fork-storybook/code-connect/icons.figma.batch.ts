import figma from "figma";

// One entry per kit glyph (`icon/<lucide-name>`) in icons.figma.batch.json; the app imports every
// glyph from "lucide-react", which apps/web aliases to its Hugeicons shim. The import rides in
// metadata too, because Figma drops imports nested two levels deep (a glyph in a tab in a strip).
const glyphImport = `import { ${figma.batch.component} } from "lucide-react";`;

export default {
  example: figma.tsx`<${figma.batch.component} />`,
  imports: [glyphImport],
  id: figma.batch.component,
  metadata: { nestable: true, props: { imports: [glyphImport] } },
};
