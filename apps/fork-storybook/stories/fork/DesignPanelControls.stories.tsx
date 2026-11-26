import { ArrowDownIcon, ArrowRightIcon, Grid2x2Icon } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";

import { EnvironmentId, ThreadId } from "@t3tools/contracts";

import { ForkPreviewLayersToggle } from "~/custom/designMode/ForkPreviewLayersToggle";
import { useDesignModeStore } from "~/custom/designMode/designModeStore";
import { CanvasControls } from "~/custom/designMode/panel/CanvasControls";
import { CornerRadiusIcon } from "~/custom/designMode/panel/CornerRadiusIcon";
import { DesignColorPicker } from "~/custom/designMode/panel/DesignColorPicker";
import {
  ColorField,
  PairField,
  PanelSection,
  PanelToggle,
  ScrubField,
  ValueRow,
} from "~/custom/designMode/panel/DesignPanelFields";
import {
  AlignMatrix,
  AlignRow,
  SegmentField,
  SelectRow,
} from "~/custom/designMode/panel/DesignPanelLayoutControls";
import { PaddingIcon } from "~/custom/designMode/panel/PaddingIcon";
import { ScreenSizeMenu } from "~/custom/designMode/panel/ScreenSizeMenu";
import { Expando } from "~/custom/designMode/panel/sections/section";

import { Row, Stack } from "../Specimen.tsx";

type SegmentProps = ComponentProps<typeof SegmentField>;

const DIRECTIONS = [
  { value: "row", label: <ArrowRightIcon />, title: "Row" },
  { value: "column", label: <ArrowDownIcon />, title: "Column" },
] as const;

/** The design panel's own language (Figma's inspector, not the app's Tabs or Button), at the
    panel's width and surface: its tokens hang on the panel's marker. */
function Panel({ children }: { children: ReactNode }) {
  return (
    <div data-fork-design-panel="" className="w-[325px] bg-[var(--fork-design-surface)] p-3">
      {children}
    </div>
  );
}

const meta = {
  title: "Fork/Design panel controls",
  component: SegmentField,
  subcomponents: { AlignRow, AlignMatrix, PanelSection, PanelToggle },
  tags: ["autodocs"],
  args: { options: DIRECTIONS, value: "row", onSelect: () => {} },
} satisfies Meta<typeof SegmentField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The compact segmented control: flex direction, wrap, text-align. `mixed` lifts no segment.
    Picking moves the `value` control. */
export const Segments: Story = {
  render: function Render(args) {
    const [, updateArgs] = useArgs<SegmentProps>();
    const select = (value: string) => updateArgs({ value });
    return (
      <Panel>
        <Stack gap={3}>
          <Row label="Picked">
            <SegmentField {...args} onSelect={select} />
          </Row>
          <Row label="Mixed">
            <SegmentField {...args} mixed onSelect={select} />
          </Row>
        </Stack>
      </Panel>
    );
  },
};

/** Align a selection to its parent, and the flex alignment matrix at its in-panel width. */
export const Alignment: Story = {
  parameters: { controls: { disable: true } },
  render: function Render() {
    const [align, setAlign] = useState({ justifyContent: "flex-start", alignItems: "center" });
    return (
      <Panel>
        <Stack gap={3}>
          <AlignRow caps={{ horizontal: true, vertical: true }} onAlign={() => {}} />
          <div className="flex items-start gap-2">
            <AlignMatrix
              direction="row"
              justifyContent={align.justifyContent}
              alignItems={align.alignItems}
              onChange={(justifyContent, alignItems) => setAlign({ justifyContent, alignItems })}
            />
          </div>
        </Stack>
      </Panel>
    );
  },
};

/** A section with a toggle hung in its header, the way the Figma layouts do. */
export const Section: Story = {
  parameters: { controls: { disable: true } },
  render: function Render() {
    const [pressed, setPressed] = useState(false);
    const [direction, setDirection] = useState("row");
    return (
      <Panel>
        <PanelSection
          title="Layout"
          action={
            <PanelToggle pressed={pressed} title="Grid" onClick={() => setPressed(!pressed)}>
              <Grid2x2Icon />
            </PanelToggle>
          }
        >
          <SegmentField options={DIRECTIONS} value={direction} onSelect={setDirection} />
        </PanelSection>
      </Panel>
    );
  },
};

const TOKENS = {
  colors: [
    { name: "--primary", value: "#518bff" },
    { name: "--accent", value: "#df51ff" },
    { name: "--success", value: "#51ff8b" },
    { name: "--warning", value: "#ffa151" },
  ],
  spacingBasePx: 4,
};

/** A field holding its own value, as the panel holds the selection's. */
function Scrub(
  props: Omit<ComponentProps<typeof ScrubField>, "value" | "onEdit"> & { initial: string },
) {
  const { initial, ...field } = props;
  const [value, setValue] = useState(initial);
  return <ScrubField {...field} value={value} onEdit={setValue} />;
}

/** The panel's fields: scrub a number by its label or type one (an expression works), the
    paired spacing field ("8" sets both, "8, 16" splits), a colour with its picker, a select,
    a read-only reading, and the disclosure that holds the controls Figma hides. Mixed shows no
    value; a drafted field offers a revert. */
export const Fields: Story = {
  parameters: { controls: { disable: true } },
  render: function Render() {
    const [pair, setPair] = useState<readonly [string, string]>(["8px", "16px"]);
    const [color, setColor] = useState("rgb(81, 139, 255)");
    const [display, setDisplay] = useState("flex");
    return (
      <Panel>
        <div className="grid grid-cols-2 gap-2">
          <Scrub label="W" title="Width" initial="320px" tokenBasePx={4} />
          <Scrub label="H" title="Height" initial="auto" keywords={["auto"]} />
          <Scrub label="X" title="X" initial="24px" readOnly />
          <Scrub label="Y" title="Y" initial="0px" mixed />
          <Scrub
            label="Radius"
            icon={<CornerRadiusIcon corner="tl" />}
            title="Top-left radius"
            initial="12px"
            drafted
            onRevert={() => {}}
          />
          <Scrub
            label="Opacity"
            title="Opacity"
            initial="0.64"
            unit="none"
            step={0.01}
            precision={2}
          />
          <PairField
            label="Padding X"
            icon={<PaddingIcon axis="inline" />}
            title="Horizontal padding"
            values={pair}
            tokenBasePx={4}
            onEdit={(first, second) => setPair([first, second])}
          />
          <PairField
            label="Padding Y"
            icon={<PaddingIcon axis="block" />}
            title="Vertical padding"
            values={["12px", "12px"]}
            mixed
            onEdit={() => {}}
          />
          <div className="col-span-2">
            <ColorField label="Fill" title="Fill" value={color} tokens={TOKENS} onEdit={setColor} />
          </div>
          <SelectRow
            label="Display"
            title="Display"
            value={display}
            options={["block", "flex", "grid", "inline", "none"]}
            onSelect={setDisplay}
          />
          <ValueRow
            label="Font"
            title="Font family"
            value={'"Inter Variable", system-ui, sans-serif'}
          />
          <Expando label="Per-side padding">
            <Scrub label="T" title="Padding top" initial="8px" />
            <Scrub label="B" title="Padding bottom" initial="8px" />
          </Expando>
        </div>
      </Panel>
    );
  },
};

/** The colour picker open: saturation and value, hue, hex, and the previewed app's own colour
    tokens as swatches. */
export const ColorPicker: Story = {
  name: "Color picker",
  parameters: { controls: { disable: true } },
  render: function Render() {
    const [color, setColor] = useState("#518bff");
    return (
      <Panel>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <DesignColorPicker
            value={color}
            tokens={TOKENS}
            onPick={setColor}
            triggerAriaLabel="Pick fill colour"
          />
          {color}
        </div>
      </Panel>
    );
  },
};

const environmentId = EnvironmentId.make("story");
const threadRef = { environmentId, threadId: ThreadId.make("thread-design") };
const LAYERS_TAB = "story-design-layers";

/** The canvas strip at the panel's head: Canvas off, then on with the screen size menu and
    zoom. */
export const Canvas: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      {[false, true].map((on) => (
        <div
          key={String(on)}
          data-fork-design-panel=""
          className="w-[325px] bg-[var(--fork-design-surface)]"
        >
          <CanvasControls
            runtimeTabId="story-design-canvas"
            threadRef={threadRef}
            tabId={null}
            canvas={{ on, scalePercent: 75 }}
          />
        </div>
      ))}
      <div
        data-fork-design-panel=""
        className="flex w-[325px] justify-end bg-[var(--fork-design-surface)] p-2"
      >
        <ScreenSizeMenu
          runtimeTabId="story-design-canvas"
          threadRef={threadRef}
          tabId={null}
          triggerClassName="flex size-6 items-center justify-center rounded bg-[var(--fork-design-field)] text-muted-foreground [&_svg]:size-3.5"
        />
      </div>
    </Stack>
  ),
};

/** The preview chrome row's way back into a collapsed layers rail: drawn only while design mode
    is on, a layers tree has arrived, and the rail is collapsed. Showing the rail removes it. */
export const LayersToggle: Story = {
  name: "Layers toggle",
  parameters: { controls: { disable: true } },
  beforeEach: () => {
    const store = useDesignModeStore.getState();
    store.setEnabled(LAYERS_TAB, true);
    store.setLayers(LAYERS_TAB, { roots: [], truncated: false });
    localStorage.setItem("t3code:fork:design-layers-collapsed:v1", "true");
  },
  render: () => <ForkPreviewLayersToggle runtimeTabId={LAYERS_TAB} />,
};
