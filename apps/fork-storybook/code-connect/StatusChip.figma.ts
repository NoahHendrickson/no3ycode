// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=321-869
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ComposerPullRequestChip.tsx
// component=ComposerPullRequestChip
import figma from "figma";

// Each chip above the composer is its own component; the PR chip reads the thread's PR itself.
const kind = figma.selectedInstance.getEnum("Kind", {
  "PR · Open": "pr",
  "PR · Draft": "pr",
  "PR · Merged": "pr",
  "PR · Closed": "pr",
  "Background work": "work",
  "Background work · Solo": "work",
  Queued: "queued",
});
const count = Number(figma.selectedInstance.getString("Queued count"));

export default {
  example:
    kind === "queued"
      ? figma.tsx`<ComposerQueuedChip count={${Number.isFinite(count) ? String(count) : "0"}} onExpand={onExpand} />`
      : kind === "work"
        ? figma.tsx`<ComposerBackgroundWorkChip {...backgroundWork} />`
        : figma.tsx`<ComposerPullRequestChip threadRef={threadRef} branch={branch} cwd={cwd} />`,
  imports:
    kind === "queued"
      ? ['import { ComposerQueuedChip } from "~/custom/ComposerQueuedChip";']
      : kind === "work"
        ? ['import { ComposerBackgroundWorkChip } from "~/custom/ComposerBackgroundWork";']
        : ['import { ComposerPullRequestChip } from "~/custom/ComposerPullRequestChip";'],
  id: "status-chip",
};
