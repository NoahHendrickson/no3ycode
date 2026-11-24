import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvironmentId } from "@t3tools/contracts";
import type { ComponentProps } from "react";

import type { ProjectFaviconProject } from "~/components/ProjectFavicon";
import { ProjectFavicon } from "~/components/ProjectFavicon";
import { resolvePullRequestState } from "~/components/pullRequest/pullRequestPresentation";
import { BotPullRequestMark } from "~/custom/bots/BotPullRequestMark";
import { TerminalIcon } from "~/custom/icons/lucide-hugeicons";
import {
  SidebarV2CompactCardLead,
  SidebarV2ThreadCardCompactMarks,
} from "~/custom/SidebarV2ThreadCardCompactMarks";
import { SidebarV2CheckoutMark, SidebarV2ThreadCardMeta } from "~/custom/SidebarV2ThreadCardMeta";

import { Row, Stack } from "../Specimen.tsx";

type MetaProps = ComponentProps<typeof SidebarV2ThreadCardMeta>;

const PROJECT: ProjectFaviconProject = {
  environmentId: EnvironmentId.make("story"),
  workspaceRoot: "/Users/story/no3ycode",
  title: "no3ycode",
  faviconPath: null,
  projectIcon: { kind: "monogram", text: "N", color: "violet" },
};

const pullRequest = (number: number, state: "open" | "merged" | "closed", isDraft = false) => (
  <BotPullRequestMark number={number} state={resolvePullRequestState({ state, isDraft })} />
);

const terminal = <TerminalIcon aria-label="Terminal running" className="size-3 shrink-0" />;

const BASE: MetaProps = {
  projectTitle: "no3ycode",
  projectIconSlot: <ProjectFavicon project={PROJECT} className="size-4 shrink-0" />,
  branch: "t3/design-lint-stories",
  hasWorktree: true,
  terminalSlot: null,
  prSlot: null,
  modelLabel: "Opus 5.5",
  isRemote: false,
};

/** A full card's second line, at the sidebar's width. */
function Line(props: MetaProps) {
  return (
    <div className="w-[264px]">
      <SidebarV2ThreadCardMeta {...props} />
    </div>
  );
}

const meta = {
  title: "Fork/Thread card meta",
  component: Line,
  subcomponents: { SidebarV2CheckoutMark, SidebarV2ThreadCardCompactMarks },
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: BASE,
} satisfies Meta<typeof Line>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Where the agent runs, then the project, the checkout, the pull request and the model. */
export const Playground: Story = {};

/** The line's states: on a branch or a worktree, remote, with a running server's pulse, a
    terminal and a pull request, and without a project or a branch. */
export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      <Row label="Worktree">
        <Line {...BASE} />
      </Row>
      <Row label="Branch">
        <Line {...BASE} hasWorktree={false} branch="main" />
      </Row>
      <Row label="Remote">
        <Line {...BASE} isRemote />
      </Row>
      <Row label="Server live">
        <Line {...BASE} devServerPort={5173} />
      </Row>
      <Row label="Terminal + PR">
        <Line {...BASE} terminalSlot={terminal} prSlot={pullRequest(452, "open")} />
      </Row>
      <Row label="Draft PR">
        <Line {...BASE} prSlot={pullRequest(453, "open", true)} />
      </Row>
      <Row label="No project icon">
        <Line {...BASE} projectIconSlot={null} />
      </Row>
      <Row label="No checkout">
        <Line {...BASE} hasWorktree={false} branch={null} />
      </Row>
      <Row label="Long names">
        <Line
          {...BASE}
          projectTitle="a-very-long-project-name-that-truncates"
          branch="feature/an-even-longer-branch-name-that-also-truncates"
          modelLabel="Claude Opus 5.5 (1M context)"
        />
      </Row>
    </Stack>
  ),
};

/** The checkout alone: the worktree mark replaces the branch mark, and a running server pulses it. */
export const Checkout: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div data-fork-thread-card-meta="" className="text-sidebar-meta text-muted-foreground">
      <Stack gap={3}>
        {(
          [
            ["Branch", { branch: "main", hasWorktree: false, devServerPort: null }],
            ["Worktree", { branch: "t3/stories", hasWorktree: true, devServerPort: null }],
            ["No branch", { branch: null, hasWorktree: true, devServerPort: null }],
            ["Server live", { branch: "main", hasWorktree: false, devServerPort: 5173 }],
          ] as const
        ).map(([label, props]) => (
          <Row key={label} label={label}>
            <SidebarV2CheckoutMark {...props} className="flex min-w-0 items-center gap-0.5" />
          </Row>
        ))}
      </Stack>
    </div>
  ),
};

/** A compact card's one line: the project leads as its favicon (or the folder before the record
    lands), and the marks ride ahead of the trailing group. */
export const Compact: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      <Row label="Lead">
        <SidebarV2CompactCardLead project={PROJECT} />
        <SidebarV2CompactCardLead project={null} />
      </Row>
      <Row label="Marks">
        <SidebarV2ThreadCardCompactMarks isRemote={false} terminalSlot={null} prSlot={null} />
        <SidebarV2ThreadCardCompactMarks
          isRemote
          terminalSlot={terminal}
          prSlot={pullRequest(452, "open")}
        />
        <SidebarV2ThreadCardCompactMarks
          isRemote={false}
          terminalSlot={null}
          prSlot={pullRequest(449, "merged")}
        />
      </Row>
    </Stack>
  ),
};
