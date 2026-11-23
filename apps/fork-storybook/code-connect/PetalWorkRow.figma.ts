// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=72-876
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/bots/BotThreadsPanel.tsx
// component=BotThreadsRowView
import figma from "figma";

// One thread in a Petal's work panel (BotThreadsPanel.tsx): status, title, age, pull request and
// checkout come from the thread.
export default {
  example: figma.tsx`<BotThreadsRowView
  status={card.topStatus}
  seed={scopedThreadKey(ref)}
  title={thread.title}
  time={time}
  pullRequest={pullRequest === null ? null : { number: pullRequest.number, state: pullRequestState }}
  branch={thread.branch}
  hasWorktree={thread.worktreePath !== null}
  current={props.current}
  onOpen={onOpen}
/>`,
  imports: ['import { BotThreadsRowView } from "~/custom/bots/BotThreadsPanel";'],
  id: "petal-work-row",
};
