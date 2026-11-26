import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { type ReactNode, useState } from "react";

import { Toggle } from "~/components/ui/toggle";
import { AutomationRunBackButton } from "~/custom/scheduled/AutomationRunBackButton";
import { PanelRightIcon } from "~/custom/icons/lucide-hugeicons";
import { SplitAgentToggle } from "~/custom/splitThreads/SplitAgentToggle";
import { SplitPaneHeaderControls } from "~/custom/splitThreads/SplitPaneHeaderControls";
import {
  SINGLE_PANE,
  SplitPaneContext,
  type SplitPaneState,
} from "~/custom/splitThreads/splitPaneContext";
import { StageHeaderBackButton } from "~/custom/stageColumns/StageHeaderBackButton";
import { StageHeaderControls } from "~/custom/stageColumns/StageHeaderControls";
import { StagePanelCloseButton } from "~/custom/stageColumns/StagePanelCloseButton";
import { DraftId } from "~/composerDraftStore";

import { Row, Stack } from "../Specimen.tsx";

const environmentId = EnvironmentId.make("story");
const threadRef = { environmentId, threadId: ThreadId.make("thread-stage") };
const projectRef = { environmentId, projectId: ProjectId.make("project-stage") };
const noop = () => {};

/** A conversation header's right end, at the header's height. */
function Header({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-12 w-[560px] max-w-full items-center border-b border-border px-3">
      <span className="truncate text-sm font-medium">Audit the composer cards</span>
      <StageHeaderControls>{children}</StageHeaderControls>
    </div>
  );
}

function PanelToggle() {
  const [pressed, setPressed] = useState(false);
  return (
    <Toggle
      aria-label="Toggle diff panel"
      variant="ghost"
      size="sm"
      pressed={pressed}
      onPressedChange={setPressed}
    >
      <PanelRightIcon className="size-4" />
    </Toggle>
  );
}

const PANES: ReadonlyArray<readonly [string, SplitPaneState]> = [
  ["Can split", { ...SINGLE_PANE, canSplit: true }],
  ["Split", { ...SINGLE_PANE, canSplit: true, split: true }],
  [
    "Float, dock",
    {
      ...SINGLE_PANE,
      canSplit: true,
      windowAction: { kind: "float", run: noop },
      dockAction: { kind: "dock", run: noop },
    },
  ],
  ["Docked", { ...SINGLE_PANE, dockAction: { kind: "undock", run: noop } }],
];

function PaneControls({ pane, draft = false }: { pane: SplitPaneState; draft?: boolean }) {
  return (
    <SplitPaneContext value={pane}>
      <Header>
        <SplitPaneHeaderControls
          panelToggleControls={<PanelToggle />}
          splitAgentToggle={
            pane.canSplit ? (
              <SplitAgentToggle
                threadRef={threadRef}
                projectRef={projectRef}
                branch="main"
                worktreePath={null}
              />
            ) : null
          }
          draftId={draft ? DraftId.make("draft-stage") : null}
          threadRef={threadRef}
        />
      </Header>
    </SplitPaneContext>
  );
}

const meta = {
  title: "Fork/Stage header controls",
  component: PaneControls,
  tags: ["autodocs"],
  parameters: { surface: "stage", router: true },
  args: { pane: PANES[0]![1] },
} satisfies Meta<typeof PaneControls>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The header's cluster: a split pane's actions, then Split agent, then the panel toggles. */
export const Playground: Story = {};

/** The pane's states: room to split, split (Split agent reads Unsplit), a window that can
    float or dock, a docked thread, and a split's unsent new agent with its close. */
export const PaneStates: Story = {
  name: "Pane states",
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      {PANES.map(([label, pane]) => (
        <Row key={label} label={label}>
          <PaneControls pane={pane} />
        </Row>
      ))}
      <Row label="New agent">
        <PaneControls pane={PANES[1]![1]} draft />
      </Row>
    </Stack>
  ),
};

/** A stage panel's own close, and the way back to a thread's parent (drawn under Inlet only;
    the other palettes keep the breadcrumb's parent crumb). */
export const PanelButtons: Story = {
  name: "Panel buttons",
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      <Row label="Close panel">
        <StagePanelCloseButton label="Close diff" onClose={noop} />
      </Row>
      <Row label="Back (Inlet)">
        <StageHeaderBackButton
          parent={{ threadId: ThreadId.make("thread-parent"), title: "Plan the release" }}
          onOpen={noop}
        />
      </Row>
    </Stack>
  ),
};

/** Opened from Automations: a run's thread offers the way back to the list it came from. The
    marker rides the history entry, so the router here starts on one. */
function OpenedFromAutomations() {
  const [router] = useState(() => {
    const history = createMemoryHistory({ initialEntries: ["/"] });
    history.replace("/", { forkOpenedFromAutomations: true });
    return createRouter({
      routeTree: createRootRoute({ component: AutomationRunBackButton }),
      history,
    });
  });
  return <RouterProvider router={router} />;
}

export const AutomationRunBack: Story = {
  name: "Automation run back",
  parameters: { router: false, controls: { disable: true } },
  render: () => <OpenedFromAutomations />,
};
