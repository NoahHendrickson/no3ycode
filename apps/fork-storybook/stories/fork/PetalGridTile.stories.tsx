import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps, ReactNode } from "react";

import { BOT_MASCOT_SHAPES, type BotMascotMood } from "~/custom/bots/botMascotArt";
import { botMascotTag } from "~/custom/bots/botMascotTags";
import { SidebarV2BotGridBody } from "~/custom/bots/SidebarV2BotCardBody";
import { type SidebarV2CardStatusKind, sidebarV2CardTopStatus } from "~/custom/sidebarV2CardStatus";
import { threadCardTitleRecedes, threadRowSurfaceClassName } from "~/custom/sidebarV2RowPolicy";

import { forcedStateProps } from "../forcedStates.ts";
import { Matrix } from "../Specimen.tsx";

type BodyProps = ComponentProps<typeof SidebarV2BotGridBody>;

const STATUSES: ReadonlyArray<{
  readonly label: string;
  readonly kind: SidebarV2CardStatusKind | null;
  readonly mood: BotMascotMood;
}> = [
  { label: "Working", kind: "working", mood: "Thinking" },
  { label: "Approval", kind: "approval", mood: "Idle" },
  { label: "Input", kind: "input", mood: "Idle" },
  { label: "Completed", kind: "done", mood: "Happy" },
  { label: "Failed", kind: "failed", mood: "Error" },
  { label: "Idle", kind: null, mood: "Sleeping" },
];

const COLUMNS = ["default", "hover", "selected", "open"] as const;
type Column = (typeof COLUMNS)[number];

const shellFor = (index: number) => {
  const shape = BOT_MASCOT_SHAPES[index % BOT_MASCOT_SHAPES.length]!;
  return { id: `petal-${shape}`, tags: [botMascotTag(shape)] };
};

/** A tile as the Petals grid draws one: the thread row's surface in its tile shape, around the
    grid body. */
function Tile({ column = "default", ...body }: BodyProps & { readonly column?: Column }) {
  const isActive = column === "open";
  const isSelected = column === "selected";
  return (
    <li className="list-none">
      <div
        role="button"
        tabIndex={0}
        aria-label={body.name}
        data-fork-thread-row=""
        className={threadRowSurfaceClassName({
          isActive,
          isSelected,
          recedes: threadCardTitleRecedes({
            isDone: body.status?.mark === "dot" && body.status.tone === "done",
            isIdle: body.status === null,
            isActive,
            isSelected,
          }),
          shape: "tile",
        })}
        {...(column === "hover" ? forcedStateProps("hover") : {})}
      >
        <SidebarV2BotGridBody {...body} />
      </div>
    </li>
  );
}

/** SidebarV2BotsSection's grid: as many 64px cells as the width holds, spread edge to edge. */
function Grid({ children }: { children: ReactNode }) {
  return (
    <ul
      data-fork-petals-grid=""
      className="grid w-64 grid-cols-[repeat(auto-fill,64px)] justify-between gap-x-1 gap-y-1 px-0.5"
    >
      {children}
    </ul>
  );
}

const body = (index: number, status: (typeof STATUSES)[number]): BodyProps => ({
  shell: shellFor(index),
  mood: status.mood,
  status: sidebarV2CardTopStatus(status.kind, { goalActive: false }),
  seed: `${status.label}-${index}`,
  name: status.label,
  renameField: null,
  regenerating: false,
  sweepBadge: null,
});

const meta = {
  title: "Fork/Petal grid tile",
  component: SidebarV2BotGridBody,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: body(0, STATUSES[0]!),
} satisfies Meta<typeof SidebarV2BotGridBody>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Grid>
      <Tile {...args} />
    </Grid>
  ),
};

/** Every status a tile's corner notch holds, at rest, hovered, multi-selected and open. */
export const States: Story = {
  render: () => (
    <Matrix
      rows={STATUSES.map((status) => status.label)}
      columns={COLUMNS}
      cell={(label, column) => {
        const index = STATUSES.findIndex((status) => status.label === label);
        return (
          <ul data-fork-petals-grid="" className="grid w-16">
            <Tile column={column} {...body(index, STATUSES[index]!)} />
          </ul>
        );
      }}
    />
  ),
};

/** The Petals section in its grid layout: one tile per Petal, each its own mascot. */
export const Section: Story = {
  render: () => (
    <Grid>
      {STATUSES.map((status, index) => (
        <Tile key={status.label} {...body(index, status)} />
      ))}
      <Tile {...body(6, STATUSES[3]!)} name="Nightly dependency bumps" column="open" />
    </Grid>
  ),
};
