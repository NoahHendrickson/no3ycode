// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=318-654
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/forkApprovalNotice.tsx
// component=forkApprovalNoticeItem
import figma from "figma";

const state = figma.selectedInstance.getEnum("State", {
  Default: "default",
  Responding: "responding",
  Gone: "gone",
});

// A pending approval is one notice item; Gone comes from the approval's own responseCapability.
export default {
  example: figma.tsx`<ComposerBannerStack
  items={[
    forkApprovalNoticeItem({
      approval,
      pendingCount,
      disabled: false,
      isResponding: ${state === "responding" ? "true" : "false"},
      onRespondToApproval,
    }),
  ]}
/>`,
  imports: [
    'import { ComposerBannerStack } from "~/components/chat/ComposerBannerStack";',
    'import { forkApprovalNoticeItem } from "~/custom/forkApprovalNotice";',
  ],
  id: "approval-card",
};
