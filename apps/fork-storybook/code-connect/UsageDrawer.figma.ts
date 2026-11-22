// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=242-874
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ComposerUsageLimitsReadout.tsx
// component=ComposerUsageLimitsDrawer
import figma from "figma";

// The composer opens the drawer from its usage ring; each provider's windows come from the
// usage limits the tray reads (ComposerUsageLimitsReadout.tsx).
export default {
  example: figma.tsx`<ComposerUsageLimitsDrawer open={open} onClose={() => close(true)}>
  <ComposerLimitsTray now={openedAt ?? 0} onClose={() => close(true)} />
</ComposerUsageLimitsDrawer>`,
  imports: ['import { ComposerUsageLimitsDrawer } from "~/custom/ComposerUsageLimitsReadout";'],
  id: "usage-drawer",
};
