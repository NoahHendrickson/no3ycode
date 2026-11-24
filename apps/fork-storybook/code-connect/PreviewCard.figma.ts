// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=58-26
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/pullRequest/PullRequestLinkPreview.tsx
// component=PullRequestLinkPreview
import figma from "figma";

// ChatMarkdown.tsx renders a pull request link through this; the card's repository, number,
// state, title and author all come from `target`, so the snippet is that call.
export default {
  example: figma.tsx`<PullRequestLinkPreview
  link={link}
  originalUrl={href}
  target={pullRequestPreviewTarget}
  confirmBeforeOpen={confirmBeforeOpen}
  onOpenPullRequest={onOpenPullRequest}
/>`,
  imports: [
    'import { PullRequestLinkPreview } from "~/components/pullRequest/PullRequestLinkPreview";',
  ],
  id: "preview-card",
};
