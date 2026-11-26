// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=299-6887
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/icons/ModelPickerProviderGlyph.tsx
// component=ForkProviderMark
import figma from "figma";

// Codex and Claude are the fork's own marks (model picker, subagent cards); Claude AI, OpenAI and
// Antigravity are the logos ProviderInstanceIcon draws, as in a subagent link chip.
const mark = figma.selectedInstance.getEnum("Property 1", {
  Codex: { fork: true, driver: "codex" },
  Claude: { fork: true, driver: "claudeAgent" },
  "Claude AI": { fork: false, driver: "claudeAgent" },
  OpenAI: { fork: false, driver: "codex" },
  Antigravity: { fork: false, driver: "antigravity" },
}) ?? { fork: true, driver: "codex" };
const driver = `ProviderDriverKind.make("${mark.driver}")`;
const CONTRACTS = 'import { ProviderDriverKind } from "@t3tools/contracts";';

export default {
  example: mark.fork
    ? figma.tsx`<ForkProviderMark driver={${driver}} />`
    : figma.tsx`<ProviderInstanceIcon driverKind={${driver}} displayName={displayName} />`,
  imports: [
    CONTRACTS,
    mark.fork
      ? 'import { ForkProviderMark } from "~/custom/icons/ModelPickerProviderGlyph";'
      : 'import { ProviderInstanceIcon } from "~/components/chat/ProviderInstanceIcon";',
  ],
  id: "provider-mark",
  metadata: { nestable: true },
};
