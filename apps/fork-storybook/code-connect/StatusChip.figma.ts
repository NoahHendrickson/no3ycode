// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=321-869
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/ComposerPullRequestChip.tsx
// component=ComposerPullRequestChip
import figma from "figma";

// The PR chip reads CI from the thread's PR. Its render control takes the resolved checks state.
const kind = figma.selectedInstance.getEnum("Kind", {
  "PR · Open": "open",
  "PR · Draft": "draft",
  "PR · Merged": "pr",
  "PR · Closed": "pr",
  "Background work": "work",
  "Background work · Solo": "work",
  Queued: "queued",
});
const count = Number(figma.selectedInstance.getString("Queued count"));
const checks = figma.selectedInstance.getEnum("Checks", {
  None: "none",
  Pending: "pending",
  Passing: "passing",
  Failing: "failing",
});
const showChecks = (kind === "open" || kind === "draft") && checks && checks !== "none";

export default {
  example:
    kind === "queued"
      ? figma.tsx`<ComposerQueuedChip count={${Number.isFinite(count) ? String(count) : "0"}} onExpand={onExpand} />`
      : kind === "work"
        ? figma.tsx`<ComposerBackgroundWorkChip {...backgroundWork} />`
        : showChecks
          ? figma.tsx`<PullRequestChipControl
  checks="${checks}"
  size="xs"
  data-fork-composer-status-chip="pull-request"
  data-fork-pr-chip
  data-pr-state="${kind}"
>
  {badgeContent}
</PullRequestChipControl>`
          : figma.tsx`<ComposerPullRequestChip threadRef={threadRef} branch={branch} cwd={cwd} />`,
  imports:
    kind === "queued"
      ? ['import { ComposerQueuedChip } from "~/custom/ComposerQueuedChip";']
      : kind === "work"
        ? ['import { ComposerBackgroundWorkChip } from "~/custom/ComposerBackgroundWork";']
        : showChecks
          ? ['import { PullRequestChipControl } from "~/custom/ComposerPullRequestChip";']
          : ['import { ComposerPullRequestChip } from "~/custom/ComposerPullRequestChip";'],
  id: "status-chip",
};
