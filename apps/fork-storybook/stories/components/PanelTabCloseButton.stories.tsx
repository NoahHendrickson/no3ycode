import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileDiffIcon, Globe, TerminalSquare } from "lucide-react";

import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";

import { PanelTabCloseButton } from "~/components/ui/panel-tab-close-button";

import { forcedStateProps } from "../forcedStates.ts";
import { Matrix } from "../Specimen.tsx";

const noop = () => {};

const TABS = [
  { title: "Diff", Icon: FileDiffIcon },
  { title: "localhost:5173", Icon: Globe },
  { title: "#2841 Sidebar shelves", Icon: PullRequestGlyph.pullRequest },
] as const;

// The tab row is the `group/tab` the close button reads its hover from.
function Tab({
  title,
  Icon,
  active,
  hovered = false,
  pending = false,
}: {
  title: string;
  Icon: typeof Globe;
  active: boolean;
  hovered?: boolean;
  pending?: boolean;
}) {
  return (
    <div
      data-active-tab={active}
      {...(hovered ? forcedStateProps("hover") : {})}
      className={`group/tab flex h-6 max-w-36 shrink-0 cursor-pointer items-center gap-0.5 rounded-md pr-2 pl-1.5 text-xs ${
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      <PanelTabCloseButton label={`Close ${title}`} onClick={noop}>
        <Icon className="size-3" />
        {pending ? (
          <span
            className="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full bg-current"
            aria-hidden
          />
        ) : null}
      </PanelTabCloseButton>
      <button type="button" className="flex min-w-0 cursor-pointer items-center">
        <span className="truncate">{title}</span>
      </button>
    </div>
  );
}

const meta = {
  title: "Components/Panel Tab Close Button",
  component: PanelTabCloseButton,
  tags: ["autodocs"],
  args: { label: "Close Diff", onClick: noop, children: <FileDiffIcon className="size-3" /> },
  render: (args) => (
    <div className="group/tab flex h-6 items-center gap-0.5 rounded-md bg-accent pr-2 pl-1.5 text-xs">
      <PanelTabCloseButton {...args} />
      <span>Diff</span>
    </div>
  ),
} satisfies Meta<typeof PanelTabCloseButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <Matrix
      rows={["active", "inactive"]}
      columns={["default", "tab hover", "pending"]}
      cell={(row, column) => (
        <div className="flex">
          <Tab
            title="Diff"
            Icon={FileDiffIcon}
            active={row === "active"}
            hovered={column === "tab hover"}
            pending={column === "pending"}
          />
        </div>
      )}
    />
  ),
};

export const RightPanelTabs: Story = {
  name: "Right panel tab strip",
  render: () => (
    <div className="flex h-9 w-[30rem] items-center gap-1 rounded-lg border px-1.5">
      <Tab {...TABS[0]} active />
      <Tab {...TABS[1]} active={false} hovered />
      <Tab {...TABS[2]} active={false} pending />
    </div>
  ),
};

export const TerminalList: Story = {
  name: "Terminal list",
  render: () => (
    <div className="flex w-48 flex-col gap-0.5 rounded-lg border p-1">
      {["Terminal", "dev server", "tests"].map((label, index) => (
        <div
          key={label}
          data-active-tab={index === 0}
          {...(index === 1 ? forcedStateProps("hover") : {})}
          className={`group/tab flex h-6 w-full items-center gap-0.5 rounded-md pr-2 pl-1.5 text-xs ${
            index === 0
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          }`}
        >
          <PanelTabCloseButton label={`Close ${label}`} onClick={noop} tooltip={`Close ${label}`}>
            <TerminalSquare className="size-3 shrink-0" />
          </PanelTabCloseButton>
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-left"
          >
            <span className="truncate">{label}</span>
          </button>
        </div>
      ))}
    </div>
  ),
};
