// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=242-874
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ComposerUsageLimitsReadout.tsx
// component=ComposerUsageLimitsDrawer
import figma from "figma";

// The hook owns the drawer and the usage ring that opens it, as ChatComposer uses them.
export default {
  example: figma.tsx`const usageDrawer = useComposerUsageDrawer({
  usageLimits: selectedProviderStatus?.usageLimits,
  enabled: true,
});

<ComposerShell usageControls={usageDrawer.readout} topVessel={usageDrawer.drawer} />`,
  imports: [
    'import { ComposerShell } from "~/custom/ComposerShell";',
    'import { useComposerUsageDrawer } from "~/custom/ComposerUsageLimitsReadout";',
  ],
  id: "usage-drawer",
};
