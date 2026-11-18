import figma from "figma";

// The kit's provider marks; a card that swaps one in reads the driver from this connection's id.
export default {
  example: figma.tsx`<ForkProviderMark driver={ProviderDriverKind.make("${figma.batch.driver}")} />`,
  imports: [
    'import { ProviderDriverKind } from "@t3tools/contracts";',
    'import { ForkProviderMark } from "~/custom/icons/ModelPickerProviderGlyph";',
  ],
  id: `provider-${figma.batch.driver}`,
  metadata: { nestable: true },
};
