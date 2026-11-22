// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=59-234
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/empty.tsx
// component=Empty
import figma from "figma";

import { code, connected, jsxText, layer, nestedImports, stack } from "./shared";

const empty = figma.selectedInstance;
const media = empty.getBoolean("Media") ? layer(empty, "Media") : null;
const buttons = empty.getBoolean("Actions") ? connected(empty, "button") : [];
const sections = [
  code(`<Empty${empty.getEnum("Size", { sm: ' size="compact"' }) ?? ""}>\n  <EmptyHeader>`),
  ...(media
    ? [code('\n    <EmptyMedia variant="icon">'), ...media.example, code("</EmptyMedia>")]
    : []),
  code(`\n    <EmptyTitle>${jsxText(empty.getString("Title"))}</EmptyTitle>`),
  code(`\n    <EmptyDescription>${jsxText(empty.getString("Description"))}</EmptyDescription>`),
  code("\n  </EmptyHeader>"),
  ...(buttons.length
    ? [code("\n  <EmptyContent>\n    "), ...stack(buttons, "    "), code("\n  </EmptyContent>")]
    : []),
  code("\n</Empty>"),
];
const parts = ["Empty", "EmptyDescription", "EmptyHeader", "EmptyTitle"];
if (media) parts.push("EmptyMedia");
if (buttons.length) parts.push("EmptyContent");

export default {
  example: figma.tsx`${sections}`,
  imports: nestedImports(
    [...(media ? [media] : []), ...buttons],
    [`import { ${parts.join(", ")} } from "~/components/ui/empty";`],
  ),
  id: "empty",
};
