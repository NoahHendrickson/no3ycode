// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=321-781
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ForkQueuedRunsBanner.tsx
// component=ForkQueuedRunsBanner
import figma from "figma";

// The card reads the thread's queued runs itself; folding it shows the Queued status chip.
export default {
  example: figma.tsx`<ForkQueuedRunsBanner
  environmentId={environmentId}
  threadId={threadId}
  optimisticMessages={optimisticMessages}
  editingRunId={editingRunId}
  editBlockedReason={editBlockedReason}
  onEditQueuedRun={onEditQueuedRun}
  onCancelEdit={onCancelEdit}
  expanded={expanded}
  onExpandedChange={onExpandedChange}
/>`,
  imports: ['import { ForkQueuedRunsBanner } from "~/custom/ForkQueuedRunsBanner";'],
  id: "queued-card",
};
