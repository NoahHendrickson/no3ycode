import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import type { ComponentProps } from "react";

import type { SidebarThreadStatus } from "~/components/Sidebar.logic";
import { BotCardStatusLine } from "~/custom/bots/BotCardStatusLine";
import { BotMascot, BotMascotLead, BotMascotTile } from "~/custom/bots/BotMascot";
import { BOT_MASCOT_MOODS, BOT_MASCOT_SHAPES } from "~/custom/bots/botMascotArt";
import { botMascotMood, botMascotTag } from "~/custom/bots/botMascotTags";
import { SidebarV2BotCardBody } from "~/custom/bots/SidebarV2BotCardBody";
import { SidebarV2NewBotRow } from "~/custom/bots/SidebarV2BotsSection";
import {
  resolveSidebarV2CardStatusKind,
  sidebarV2CardTopStatus,
} from "~/custom/sidebarV2CardStatus";
import { SidebarV2StatusMark } from "~/custom/SidebarV2StatusIndicator";
import { threadRowSurfaceClassName } from "~/custom/sidebarV2RowPolicy";

import { Matrix, Row, Stack } from "../Specimen.tsx";

const environmentId = EnvironmentId.make("story");
const noop = () => {};

type BodyProps = ComponentProps<typeof SidebarV2BotCardBody>;

const shellFor = (index: number) => {
  const shape = BOT_MASCOT_SHAPES[index % BOT_MASCOT_SHAPES.length]!;
  return { id: `petal-${shape}`, tags: [botMascotTag(shape)], latestVisibleMessage: null };
};

/** Each card status as the row reads it, with the work its threads need when that outranks it. */
const CARDS: ReadonlyArray<{
  readonly label: string;
  readonly status: SidebarThreadStatus;
  readonly isUnread?: boolean;
  readonly work?: BodyProps["work"];
}> = [
  { label: "Working", status: "working" },
  { label: "Approval", status: "approval" },
  { label: "Input", status: "input" },
  { label: "Failed", status: "failed" },
  { label: "Limited", status: "limited" },
  { label: "Idle", status: "ready" },
  { label: "Its threads", status: "ready", work: { status: "approval", count: 2 } },
];

/** A full Petal card as the sidebar draws one: the row's surface around the card body. */
function Card({ index }: { index: number }) {
  const card = CARDS[index]!;
  const status = sidebarV2CardTopStatus(
    resolveSidebarV2CardStatusKind({
      status: card.status,
      isUnread: card.isUnread === true,
      isWoke: false,
      hasPendingBackgroundTasks: false,
    }),
    { goalActive: false },
  );
  return (
    <li className="list-none">
      <div
        data-fork-thread-row=""
        className={threadRowSurfaceClassName({
          isActive: false,
          isSelected: false,
          recedes: false,
          shape: "card",
        })}
      >
        <SidebarV2BotCardBody
          environmentId={environmentId}
          threadId={ThreadId.make(`petal-${index}`)}
          shell={shellFor(index)}
          status={card.status}
          isUnread={card.isUnread === true}
          work={card.work ?? null}
          mood={botMascotMood({ status: card.status, isUnread: false, resting: true })}
          title={<span className="truncate text-sm">{`${card.label} petal`}</span>}
          trailing={<SidebarV2StatusMark status={status} seed={`petal-${index}`} idle="dot" />}
        />
      </div>
    </li>
  );
}

const meta = {
  title: "Fork/Petal card",
  component: BotMascot,
  subcomponents: { BotMascotTile, BotMascotLead, SidebarV2BotCardBody },
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: { shape: BOT_MASCOT_SHAPES[0]!, mood: "Idle", cell: 4 },
  argTypes: {
    shape: { control: "select", options: BOT_MASCOT_SHAPES },
    mood: { control: "select", options: BOT_MASCOT_MOODS },
  },
} satisfies Meta<typeof BotMascot>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A Petal's mascot, as crisp pixels: one CSS pixel per cell unless told otherwise. */
export const Playground: Story = {};

/** Every mascot in every mood, at four pixels a cell. */
export const Mascots: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Matrix
      rows={BOT_MASCOT_SHAPES}
      columns={BOT_MASCOT_MOODS}
      cell={(shape, mood) => <BotMascot shape={shape} mood={mood} cell={3} />}
    />
  ),
};

/** The mascot as a full card's 32px tile and as a compact card's lead. */
export const TileAndLead: Story = {
  name: "Tile and lead",
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      <Row label="Tile">
        {BOT_MASCOT_SHAPES.map((shape) => (
          <BotMascotTile key={shape} shape={shape} mood="Idle" />
        ))}
      </Row>
      <Row label="Lead">
        {BOT_MASCOT_SHAPES.map((shape) => (
          <BotMascotLead key={shape} shape={shape} mood="Idle" />
        ))}
      </Row>
    </Stack>
  ),
};

/** The full card: the tile beside both lines, the status in words on the second. */
export const Cards: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <ul className="flex w-[272px] flex-col gap-1">
      {CARDS.map((card, index) => (
        <Card key={card.label} index={index} />
      ))}
    </ul>
  ),
};

/** The second line alone, for each status a Petal reports. */
export const StatusLine: Story = {
  name: "Status line",
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={2}>
      {CARDS.map((card, index) => (
        <Row key={card.label} label={card.label}>
          <div className="w-48">
            <BotCardStatusLine
              environmentId={environmentId}
              threadId={ThreadId.make(`petal-line-${index}`)}
              shell={shellFor(index)}
              status={card.status}
              isUnread={false}
              work={card.work ?? null}
            />
          </div>
        </Row>
      ))}
    </Stack>
  ),
};

/** Naming a new Petal in place, drawn as the card it becomes: full, then compact. The mascot
    button steps through the shapes. */
export const Naming: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <ul className="flex w-[272px] flex-col gap-2">
      {(["card", "compact"] as const).map((view) => (
        <SidebarV2NewBotRow
          key={view}
          view={view}
          initialMascot={BOT_MASCOT_SHAPES[1]!}
          onCreate={async () => null}
          onDone={noop}
        />
      ))}
    </ul>
  ),
};
