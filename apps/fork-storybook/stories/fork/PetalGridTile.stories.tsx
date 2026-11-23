import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps, ReactNode } from "react";

import type { SidebarThreadStatus } from "~/components/Sidebar.logic";
import { BOT_MASCOT_SHAPES } from "~/custom/bots/botMascotArt";
import { botMascotMood, botMascotTag } from "~/custom/bots/botMascotTags";
import { SidebarV2BotGridBody } from "~/custom/bots/SidebarV2BotCardBody";
import { PETALS_GRID_CLASS_NAME } from "~/custom/bots/SidebarV2BotsSection";
import {
  resolveSidebarV2CardStatusKind,
  sidebarV2CardTopStatus,
} from "~/custom/sidebarV2CardStatus";
import {
  threadCardRecedeStatus,
  threadCardTitleRecedes,
  threadRowSurfaceClassName,
} from "~/custom/sidebarV2RowPolicy";
import { cn } from "~/lib/utils";

import { forcedStateProps } from "../forcedStates.ts";
import { Matrix } from "../Specimen.tsx";

type BodyProps = ComponentProps<typeof SidebarV2BotGridBody>;

/** Each status as the row reads it from its thread, so the mark and the face come from the same
    ladder and mood rule the sidebar runs. */
interface StatusSpecimen {
  readonly label: string;
  readonly status: SidebarThreadStatus;
  readonly isUnread?: boolean;
  readonly isWoke?: boolean;
  readonly hasPendingBackgroundTasks?: boolean;
}

const STATUSES: ReadonlyArray<StatusSpecimen> = [
  { label: "Working", status: "working" },
  { label: "Approval", status: "approval" },
  { label: "Input", status: "input" },
  { label: "Completed", status: "ready", isUnread: true },
  { label: "Failed", status: "failed" },
  { label: "Woke", status: "ready", isWoke: true },
  { label: "Waiting", status: "waiting" },
  { label: "Monitoring", status: "ready", hasPendingBackgroundTasks: true },
  { label: "Idle", status: "ready" },
];

const COLUMNS = ["default", "hover", "selected", "open"] as const;
type Column = (typeof COLUMNS)[number];

const shellFor = (index: number) => {
  const shape = BOT_MASCOT_SHAPES[index % BOT_MASCOT_SHAPES.length]!;
  return { id: `petal-${shape}`, tags: [botMascotTag(shape)] };
};

const topStatusOf = (specimen: StatusSpecimen) =>
  sidebarV2CardTopStatus(
    resolveSidebarV2CardStatusKind({
      status: specimen.status,
      isUnread: specimen.isUnread === true,
      isWoke: specimen.isWoke === true,
      hasPendingBackgroundTasks: specimen.hasPendingBackgroundTasks === true,
    }),
    { goalActive: false },
  );

/** A tile as the Petals grid draws one: the thread row's surface in its tile shape, around the
    grid body. The row itself lives in upstream Sidebar.tsx; both read sidebarV2RowPolicy. */
function Tile({
  column = "default",
  specimen,
  index,
  name = specimen.label,
}: {
  readonly column?: Column;
  readonly specimen: StatusSpecimen;
  readonly index: number;
  readonly name?: string;
}) {
  const isActive = column === "open";
  const isSelected = column === "selected";
  const topStatus = topStatusOf(specimen);
  const body: BodyProps = {
    shell: shellFor(index),
    mood: botMascotMood({
      status: specimen.status,
      isUnread: specimen.isUnread === true,
      resting: !isActive,
    }),
    status: topStatus,
    seed: `${specimen.label}-${index}`,
    name,
    renameField: null,
    regenerating: false,
    sweepBadge: null,
  };
  return (
    <li className="list-none">
      <div
        role="button"
        tabIndex={0}
        aria-label={name}
        aria-current={isActive ? "page" : undefined}
        data-fork-thread-row=""
        className={threadRowSurfaceClassName({
          isActive,
          isSelected,
          recedes: threadCardTitleRecedes({
            ...threadCardRecedeStatus(topStatus),
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

/** The Petals grid, at the sidebar's width or one cell wide. */
function Grid({ children, oneCell = false }: { children: ReactNode; oneCell?: boolean }) {
  return (
    <ul
      data-fork-petals-grid=""
      className={cn(PETALS_GRID_CLASS_NAME, oneCell ? "w-[71px]" : "w-[308px]")}
    >
      {children}
    </ul>
  );
}

const meta = {
  title: "Fork/Petal grid tile",
  component: Tile,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: { specimen: STATUSES[0]!, index: 0, column: "default" },
  argTypes: {
    specimen: {
      control: "select",
      options: STATUSES.map((specimen) => specimen.label),
      mapping: Object.fromEntries(STATUSES.map((specimen) => [specimen.label, specimen])),
    },
    column: { control: "inline-radio", options: COLUMNS },
  },
} satisfies Meta<typeof Tile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Grid>
      <Tile {...args} />
    </Grid>
  ),
};

/** Every status a tile's corner mark shows, at rest, hovered, multi-selected and open. The open
    column wears the face the app gives the Petal on screen, never Sleeping. */
export const States: Story = {
  render: () => (
    <Matrix
      rows={STATUSES.map((specimen) => specimen.label)}
      columns={COLUMNS}
      cell={(label, column) => {
        const index = STATUSES.findIndex((specimen) => specimen.label === label);
        return (
          <Grid oneCell>
            <Tile column={column} specimen={STATUSES[index]!} index={index} />
          </Grid>
        );
      }}
    />
  ),
};

/** The Petals section in its grid layout: one tile per Petal, each its own mascot. The open
    Petal has been read, as opening it does. */
export const Section: Story = {
  render: () => (
    <Grid>
      {STATUSES.map((specimen, index) => (
        <Tile key={specimen.label} specimen={specimen} index={index} />
      ))}
      <Tile
        specimen={{ label: "Read", status: "ready" }}
        index={STATUSES.length}
        name="Nightly dependency bumps"
        column="open"
      />
    </Grid>
  ),
};
