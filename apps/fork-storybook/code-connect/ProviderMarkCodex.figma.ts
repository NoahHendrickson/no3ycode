// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=99-768
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/icons/ModelPickerProviderGlyph.tsx
// component=ForkProviderMark
import figma from "figma";

export default {
  example: figma.tsx`<ForkProviderMark driver={ProviderDriverKind.make("codex")} />`,
  imports: [
    'import { ProviderDriverKind } from "@t3tools/contracts";',
    'import { ForkProviderMark } from "~/custom/icons/ModelPickerProviderGlyph";',
  ],
  id: "provider-mark-codex",
  metadata: { nestable: true },
};
