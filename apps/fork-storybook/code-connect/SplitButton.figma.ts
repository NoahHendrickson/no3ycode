// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=61-128
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/group.tsx
// component=Group
import figma from "figma";

import { indent, jsxText, layer, nestedImports } from "./shared";

// The Open in editor split: the editor's button, then the menu trigger that picks another.
const split = figma.selectedInstance;
const icon = layer(split, "Icon");
const chevron = layer(split, "Chevron");

export default {
  example: figma.tsx`<Group aria-label="Open in editor">
  <Button variant="outline" size="sm">
    ${indent(icon?.example ?? [], "    ")}
    ${jsxText(split.getString("Label"))}
  </Button>
  <GroupSeparator />
  <Button variant="outline" size="icon-sm" aria-label="Choose editor">
    ${chevron?.example ?? []}
  </Button>
</Group>`,
  imports: nestedImports(
    [...(icon ? [icon] : []), ...(chevron ? [chevron] : [])],
    [
      'import { Button } from "~/components/ui/button";',
      'import { Group, GroupSeparator } from "~/components/ui/group";',
    ],
  ),
  id: "split-button",
};
