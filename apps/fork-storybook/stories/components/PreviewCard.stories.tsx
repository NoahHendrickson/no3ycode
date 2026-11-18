import type { Meta, StoryObj } from "@storybook/react-vite";

import { PULL_REQUEST_STATE_PRESENTATION } from "~/components/pullRequest/pullRequestIcons";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "~/components/ui/preview-card";

const OpenState = PULL_REQUEST_STATE_PRESENTATION.open;
const SIDES = ["top", "bottom", "left", "right"] as const;
const ALIGNS = ["start", "center", "end"] as const;

function PullRequestLink() {
  return (
    <p className="max-w-sm text-sm text-muted-foreground">
      Fixed in{" "}
      <PreviewCardTrigger
        href="#"
        className="font-medium text-foreground underline underline-offset-2"
        delay={350}
        closeDelay={120}
      >
        pingdotgg/t3code#4821
      </PreviewCardTrigger>
      , which landed this morning.
    </p>
  );
}

function PullRequestCard() {
  return (
    <div className="p-3">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
          <span className="min-w-0 truncate">pingdotgg/t3code</span>
          <span className="shrink-0">#4821</span>
          <span aria-hidden>·</span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <OpenState.Icon aria-hidden className={`size-3 ${OpenState.toneClassName}`} />
            {OpenState.label}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium leading-snug text-foreground text-pretty">
          fix(web): new threads no longer spike CPU while the sidebar settles
        </p>
        <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-4 shrink-0 rounded-full bg-muted" />
          <span className="min-w-0 truncate">octocat</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">opened 3 hours ago</span>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: "Components/Preview Card",
  component: PreviewCardPopup,
  tags: ["autodocs"],
  args: { side: "top", align: "center", sideOffset: 6 },
  argTypes: {
    side: { control: "select", options: SIDES },
    align: { control: "select", options: ALIGNS },
    sideOffset: { control: "number" },
  },
} satisfies Meta<typeof PreviewCardPopup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <PreviewCard defaultOpen>
      <PullRequestLink />
      <PreviewCardPopup {...args} className="w-80 max-w-[calc(100vw-2rem)]">
        <PullRequestCard />
      </PreviewCardPopup>
    </PreviewCard>
  ),
};

export const Closed: Story = {
  render: () => (
    <PreviewCard>
      <PullRequestLink />
      <PreviewCardPopup align="center" className="w-80 max-w-[calc(100vw-2rem)]">
        <PullRequestCard />
      </PreviewCardPopup>
    </PreviewCard>
  ),
};

export const Open: Story = {
  name: "Open (pull request link)",
  render: () => (
    <PreviewCard defaultOpen>
      <PullRequestLink />
      <PreviewCardPopup align="center" className="w-80 max-w-[calc(100vw-2rem)]">
        <PullRequestCard />
      </PreviewCardPopup>
    </PreviewCard>
  ),
};
