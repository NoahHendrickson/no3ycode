import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CircleSlashIcon,
  CodeIcon,
  FolderIcon,
  Grid2x2Icon,
  MessageSquareTextIcon,
  Rows3Icon,
  ZapIcon,
} from "lucide-react";
import { type ComponentType, type ReactNode, type SVGProps, useState } from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import type { ForkSidebarMode } from "~/custom/chatMode";
import { SidebarModeTabs } from "~/custom/SidebarModeTabs";
import { IconTab, Tab, Tabs, type TabsSize } from "~/custom/Tabs";

import { Dimension, measureWithin, Specimen } from "../Anatomy.tsx";
import { type ForcedState, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

function WordTabs({ labels, initial = 0 }: { labels: ReadonlyArray<string>; initial?: number }) {
  const [value, setValue] = useState(labels[initial]!);
  return (
    <Tabs
      aria-label="Example"
      size="md"
      value={[value]}
      onValueChange={(next) => next[0] && setValue(next[0])}
    >
      {labels.map((label) => (
        <Tab key={label} value={label}>
          {label}
        </Tab>
      ))}
    </Tabs>
  );
}

function IconTabs({
  tabs,
  tooltips = false,
  size = "sm",
}: {
  tabs: ReadonlyArray<{ label: string; Icon: Glyph }>;
  tooltips?: boolean;
  size?: TabsSize;
}) {
  const [value, setValue] = useState(tabs[0]!.label);
  return (
    <Tabs
      aria-label="Example"
      size={size}
      value={[value]}
      onValueChange={(next) => next[0] && setValue(next[0])}
    >
      {tabs.map(({ label, Icon }) => {
        const tab = (
          <IconTab key={label} value={label} aria-label={label}>
            <Icon className="size-4" />
          </IconTab>
        );
        if (!tooltips) return tab;
        return (
          <Tooltip key={label}>
            <TooltipTrigger render={tab} />
            <TooltipPopup side="bottom">{label}</TooltipPopup>
          </Tooltip>
        );
      })}
    </Tabs>
  );
}

const MODES = [
  { label: "Code", Icon: CodeIcon },
  { label: "Chat", Icon: MessageSquareTextIcon },
] as const;

const GROUPING = [
  { label: "No grouping", Icon: CircleSlashIcon },
  { label: "Project", Icon: FolderIcon },
  { label: "Status", Icon: ZapIcon },
] as const;

const VIEWS = [
  { label: "List", Icon: Rows3Icon },
  { label: "Grid", Icon: Grid2x2Icon },
  { label: "Code", Icon: CodeIcon },
  { label: "Chat", Icon: MessageSquareTextIcon },
] as const;

const STATES = ["default", "hover", "selected", "focus", "disabled"] as const;

/** The first tab carries the state; the second stays plain, so each cell reads against a neighbour. */
const KINDS = ["icon sm", "icon md", "icon lg", "word"] as const;

function StateCell({
  kind,
  state,
}: {
  kind: (typeof KINDS)[number];
  state: (typeof STATES)[number];
}) {
  const forced = state === "selected" ? {} : forcedStateProps(state as ForcedState);
  const value = state === "selected" ? ["a"] : ["b"];
  return (
    <Tabs
      aria-label={`${kind} ${state}`}
      value={value}
      size={kind === "icon lg" ? "lg" : kind === "icon sm" ? "sm" : "md"}
    >
      {kind !== "word" ? (
        <>
          <IconTab value="a" aria-label="Code" {...forced}>
            <CodeIcon className="size-4" />
          </IconTab>
          <IconTab value="b" aria-label="Chat">
            <MessageSquareTextIcon className="size-4" />
          </IconTab>
        </>
      ) : (
        <>
          <Tab value="a" {...forced}>
            Code
          </Tab>
          <Tab value="b">Chat</Tab>
        </>
      )}
    </Tabs>
  );
}

const SCALE = 3;
const px = (value: string) => value.replace(/px$/u, "");

/** Redlines for a two-tab strip: the track's outer size, the picked tab's size, then the spec. */
function annotateStrip(kind: "icon" | "word") {
  return (frame: HTMLElement) => {
    const trackElement = frame.querySelector<HTMLElement>("[data-fork-segmented-tabs]");
    const tabElement = frame.querySelector<HTMLElement>("[data-fork-tab][data-pressed]");
    if (!trackElement || !tabElement) return null;
    const track = measureWithin(frame, trackElement);
    const tab = measureWithin(frame, tabElement);
    const glyph = tabElement.querySelector("svg")?.getBoundingClientRect().width;
    const spec = [
      `inset ${px(track.style.paddingTop)}`,
      kind === "word" ? `sides ${px(tab.style.paddingLeft)}` : null,
      kind === "word" ? `type ${px(tab.style.fontSize)}/${tab.style.fontWeight}` : null,
      glyph ? `glyph ${Math.round(glyph / SCALE)}` : null,
      `line ${px(tab.style.borderTopWidth)}`,
      `radius ${px(track.style.borderTopLeftRadius)} / ${px(tab.style.borderTopLeftRadius)}`,
    ].filter(Boolean);
    const right = track.box.x + track.box.w;
    const bottom = track.box.y + track.box.h;
    return (
      <>
        <Dimension
          axis="x"
          from={track.box.x}
          to={right}
          at={track.box.y - 20}
          label={track.width}
        />
        <Dimension
          axis="y"
          from={track.box.y}
          to={bottom}
          at={track.box.x - 20}
          label={track.height}
        />
        <Dimension
          axis="x"
          from={tab.box.x}
          to={tab.box.x + tab.box.w}
          at={bottom + 20}
          label={tab.width}
        />
        <Dimension
          axis="y"
          from={tab.box.y}
          to={tab.box.y + tab.box.h}
          at={right + 20}
          label={tab.height}
        />
        <p
          className="absolute font-mono text-[11px] whitespace-nowrap text-muted-foreground"
          style={{ left: track.box.x, top: bottom + 44 }}
        >
          {spec.join(" · ")}
        </p>
      </>
    );
  };
}
const annotateIcon = annotateStrip("icon");
const annotateWord = annotateStrip("word");

function AnatomyCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-2 rounded-xl border border-border p-4">
      <figcaption className="text-[13px] font-medium text-foreground">{title}</figcaption>
      {children}
    </figure>
  );
}

const meta = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Stack gap={4}>
      <IconTabs tabs={MODES} tooltips />
      <WordTabs labels={["Code", "Chat"]} />
    </Stack>
  ),
};

/** Square tabs for one glyph each. The size is the strip's height in every theme: `sm` 28px (the
    sidebar's Code / Chat switch), `md` 32px, `lg` 36px. Basic insets its track 2px, so its tabs
    are 24, 28 and 32px. */
export const Icon: Story = {
  name: "Icon tabs",
  render: () => (
    <Stack gap={3}>
      {(["sm", "md", "lg"] as const).map((size) => (
        <Stack key={size} gap={3}>
          <Row label={`${size} · 2 tabs`}>
            <IconTabs tabs={MODES} tooltips size={size} />
          </Row>
          <Row label={`${size} · 3 tabs`}>
            <IconTabs tabs={GROUPING} tooltips size={size} />
          </Row>
          <Row label={`${size} · 4 tabs`}>
            <IconTabs tabs={VIEWS} tooltips size={size} />
          </Row>
        </Stack>
      ))}
    </Stack>
  ),
};

/** The same track and raised pick, each tab sized to its word. Word strips sit at `md`, the
    Figma's 28px word tab under Basic. */
export const Word: Story = {
  name: "Word tabs",
  render: () => (
    <Stack gap={3}>
      <Row label="2 tabs">
        <WordTabs labels={["Code", "Chat"]} />
      </Row>
      <Row label="3 tabs">
        <WordTabs labels={["Day", "Week", "Month"]} initial={1} />
      </Row>
      <Row label="4 tabs">
        <WordTabs labels={["Summary", "Guide", "Timeline", "Code"]} />
      </Row>
    </Stack>
  ),
};

export const States: Story = {
  render: () => (
    <Matrix
      rows={KINDS}
      columns={STATES}
      cell={(kind, state) => <StateCell kind={kind} state={state} />}
    />
  ),
};

/** The real sidebar switch, which is built from these tabs. */
export const SidebarMode: Story = {
  name: "In the sidebar",
  parameters: { surface: "sidebar" },
  render: function SidebarModeStory() {
    const [mode, setMode] = useState<ForkSidebarMode>("code");
    return <SidebarModeTabs mode={mode} onModeChange={setMode} />;
  },
};

/** Every size, magnified ×3 with redlines. All numbers are measured from the live component in
    the toolbar's tone: the track's outer size, the picked tab's size, and the spec below. */
export const Anatomy: Story = {
  parameters: { surface: "bare" },
  render: () => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(440px,1fr))] gap-4">
      {(["sm", "md", "lg"] as const).map((size) => (
        <AnatomyCard key={size} title={`Icon tabs · ${size}`}>
          <Specimen scale={SCALE} width={400} height={230} annotate={annotateIcon}>
            <Tabs aria-label="Mode" value={["code"]} size={size}>
              <IconTab value="code" aria-label="Code">
                <CodeIcon className="size-4" />
              </IconTab>
              <IconTab value="chat" aria-label="Chat">
                <MessageSquareTextIcon className="size-4" />
              </IconTab>
            </Tabs>
          </Specimen>
        </AnatomyCard>
      ))}
      <AnatomyCard title="Word tabs">
        <Specimen scale={SCALE} width={400} height={230} annotate={annotateWord}>
          <Tabs aria-label="Mode" value={["code"]} size="md">
            <Tab value="code">Code</Tab>
            <Tab value="chat">Chat</Tab>
          </Tabs>
        </Specimen>
      </AnatomyCard>
    </div>
  ),
};
