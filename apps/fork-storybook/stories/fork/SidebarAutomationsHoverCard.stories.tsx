import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvironmentId } from "@t3tools/contracts";
import type { ComponentProps } from "react";

import { Tooltip, TooltipTrigger } from "~/components/ui/tooltip";
import {
  SidebarV2AutomationsHoverCardView,
  SidebarV2AutomationsRunView,
} from "~/custom/SidebarV2AutomationsHoverCard";

import { POPUP_ANCHOR } from "../Specimen.tsx";

type Run = ComponentProps<typeof SidebarV2AutomationsRunView>;

const environmentId = EnvironmentId.make("story");

const project = (title: string, color: "violet" | "emerald"): NonNullable<Run["project"]> => ({
  environmentId,
  workspaceRoot: `/Users/story/${title}`,
  title,
  faviconPath: null,
  projectIcon: { kind: "monogram", text: title.slice(0, 1).toUpperCase(), color },
});

const RUNS: ReadonlyArray<Run> = [
  {
    kind: "working",
    seed: "run-1",
    taskTitle: "Nightly dependency bumps",
    threadTitle: "Bump vite-plus and the Effect packages",
    project: project("no3ycode", "violet"),
    pullRequestNumber: 512,
  },
  {
    kind: "needsYou",
    seed: "run-2",
    taskTitle: "PR review",
    threadTitle: "Review #515: the composer's next step",
    project: project("no3ycode", "violet"),
    pullRequestNumber: 515,
  },
  {
    kind: "failed",
    seed: "run-3",
    taskTitle: undefined,
    threadTitle: "Weekly upstream sync",
    project: project("marketing-site", "emerald"),
    pullRequestNumber: null,
  },
];

/** The card open beside the Automations row it hangs from. */
function HoverCard(props: { readonly runs: ReadonlyArray<Run>; readonly overflow: number }) {
  return (
    <div style={POPUP_ANCHOR}>
      <Tooltip open>
        <TooltipTrigger render={<span className="block h-8 w-48 rounded-lg bg-sidebar-accent" />} />
        <SidebarV2AutomationsHoverCardView title="3 automations running" overflow={props.overflow}>
          {props.runs.map((run) => (
            <SidebarV2AutomationsRunView key={run.seed} {...run} />
          ))}
        </SidebarV2AutomationsHoverCardView>
      </Tooltip>
    </div>
  );
}

const meta = {
  title: "Fork/Automations hover card",
  component: HoverCard,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: { runs: RUNS, overflow: 0 },
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What the sidebar's Automations row shows on hover: each counted run with its mark, the
    automation's name over the thread's title, and its project and PR. The rows read tasks and run
    history from the server, so the story hands each row what it would show. */
export const Playground: Story = {};

/** A run whose automation is unknown leads with the thread's title, and one with no PR
    shows only its project. */
export const OneRun: Story = {
  name: "One run",
  args: { runs: [RUNS[2]!] },
};

/** Past the card's six rows, the footer counts the rest. */
export const Overflow: Story = {
  args: { overflow: 4 },
};
