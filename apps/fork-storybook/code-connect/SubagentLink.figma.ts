// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=327-732
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ForkSubagentLinkChip.tsx
// component=ForkSubagentLinkChip
import figma from "figma";

// A link in an assistant reply to a subagent's thread; the chip reads the child's live status.
// Thread is an ordinary thread link, which the same capsule draws (ThreadContextChip).
const thread = figma.selectedInstance.getEnum("Status", { Thread: true }) === true;
const title = thread
  ? figma.selectedInstance.getString("Thread title")
  : figma.selectedInstance.getString("Title");

export default {
  example: thread
    ? figma.tsx`<ThreadContextChip record={{ environmentId, threadId, title: ${JSON.stringify(title)} }} shape="capsule" />`
    : figma.tsx`<ForkSubagentLinkChip threadRef={threadRef} title={${JSON.stringify(title)}}>
  {children}
</ForkSubagentLinkChip>`,
  imports: thread
    ? ['import { ThreadContextChip } from "~/components/ThreadContextChip";']
    : ['import { ForkSubagentLinkChip } from "~/custom/ForkSubagentLinkChip";'],
  id: "subagent-link",
  metadata: { nestable: true },
};
