// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=72-670
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/bots/BotPullRequestMark.tsx
// component=BotPullRequestMark
import figma from "figma";

// A pull request's number in its state's glyph and tone, as a Petal's rows show it.
const number = Number(figma.selectedInstance.getString("Number"));

export default {
  example: figma.tsx`<BotPullRequestMark
  number={${Number.isFinite(number) ? String(number) : "0"}}
  state={resolvePullRequestState({ state: "merged", isDraft: false })}
/>`,
  imports: [
    'import { resolvePullRequestState } from "~/components/pullRequest/pullRequestPresentation";',
    'import { BotPullRequestMark } from "~/custom/bots/BotPullRequestMark";',
  ],
  id: "pr-state-merged",
  metadata: { nestable: true },
};
