import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { ColorHueSlider, ColorSaturationValuePlane } from "~/components/ui/color-picker";
import { Input } from "~/components/ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { hexToHsv, hsvToHex, type HsvColor } from "~/lib/color";

import { Row, Stack } from "../Specimen.tsx";

const VARIANTS = ["inset", "edge"] as const;

function useHsv(hex: string) {
  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(hex));
  return [hsv, setHsv, hsvToHex(hsv.h, hsv.s, hsv.v)] as const;
}

function ThemePanel({ label, initial }: { label: string; initial: string }) {
  const [hsv, setHsv, hex] = useHsv(initial);
  return (
    <div className="w-72">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{label}</p>
          <p className="text-2xs text-muted-foreground">Choose a color</p>
        </div>
        <span className="size-7 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: hex }} />
      </div>
      <div className="grid gap-3 px-3 pb-3 pt-3">
        <ColorSaturationValuePlane label={label} value={hsv} onChange={setHsv} />
        <ColorHueSlider
          label={`${label} hue`}
          value={hsv.h}
          onChange={(h) => setHsv({ ...hsv, h })}
        />
      </div>
    </div>
  );
}

function AccentPanel() {
  const [hsv, setHsv, hex] = useHsv("#2563eb");
  return (
    <div className="w-56 bg-popover">
      <ColorSaturationValuePlane
        label="Accent color"
        value={hsv}
        onChange={setHsv}
        variant="edge"
      />
      <div className="grid gap-3 p-3">
        <ColorHueSlider
          label="Accent color hue"
          value={hsv.h}
          onChange={(h) => setHsv({ ...hsv, h })}
        />
        <Input
          nativeInput
          size="compact"
          font="mono"
          value={hex}
          readOnly
          aria-label="Custom hex accent color"
          spellCheck={false}
        />
        <Button type="button" size="compact">
          Add color
        </Button>
      </div>
    </div>
  );
}

const meta = {
  title: "Components/Color Picker",
  component: ColorSaturationValuePlane,
  tags: ["autodocs"],
  args: {
    label: "Accent color",
    value: { h: 221, s: 0.84, v: 0.92 },
    variant: "inset",
    onChange: () => undefined,
  },
  argTypes: { variant: { control: "select", options: VARIANTS } },
} satisfies Meta<typeof ColorSaturationValuePlane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div className="grid w-64 gap-3">
        <ColorSaturationValuePlane {...args} value={value} onChange={setValue} />
        <ColorHueSlider
          label={`${args.label} hue`}
          value={value.h}
          onChange={(h) => setValue({ ...value, h })}
        />
      </div>
    );
  },
};

export const Variants: Story = {
  render: () => (
    <Stack gap={4}>
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <div className="w-64">
            <ColorSaturationValuePlane
              label={`${variant} plane`}
              value={{ h: 152, s: 0.7, v: 0.75 }}
              onChange={() => undefined}
              variant={variant}
            />
          </div>
        </Row>
      ))}
      <Row label="hue slider">
        <div className="w-64">
          <ColorHueSlider label="Hue" value={32} onChange={() => undefined} />
        </div>
      </Row>
    </Stack>
  ),
};

export const ThemeColorOpen: Story = {
  name: "Theme color (open)",
  render: () => (
    <div className="flex h-[26rem] w-80 items-start justify-end">
      <Popover defaultOpen>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Choose Accent color color"
              className="size-6 rounded-full border border-border shadow-xs"
              style={{ backgroundColor: "#7c5cff" }}
            />
          }
        />
        <PopoverPopup align="end" padding="none" side="bottom" sideOffset={10} initialFocus={false}>
          <ThemePanel label="Accent color" initial="#7c5cff" />
        </PopoverPopup>
      </Popover>
    </div>
  ),
};

export const ProviderAccentOpen: Story = {
  name: "Provider accent (open)",
  render: () => (
    <div className="flex h-96 items-start">
      <Popover defaultOpen>
        <PopoverTrigger
          render={
            <Button
              type="button"
              size="icon-sm"
              variant="ghost-muted"
              aria-label="Add accent color for Claude"
            >
              <PlusIcon aria-hidden />
            </Button>
          }
        />
        <PopoverPopup
          side="bottom"
          align="start"
          sideOffset={6}
          padding="none"
          initialFocus={false}
        >
          <AccentPanel />
        </PopoverPopup>
      </Popover>
    </div>
  ),
};
