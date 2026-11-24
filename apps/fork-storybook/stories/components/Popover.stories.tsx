import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfoIcon, SmartphoneIcon } from "lucide-react";
import type { CSSProperties } from "react";

import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover";
import { QRCodeSvg } from "~/components/ui/qr-code";

import { POPUP_ANCHOR } from "../Specimen.tsx";

const PADDINGS = ["default", "compact", "none"] as const;
const WIDTHS = ["auto", "sm", "md", "lg"] as const;
const VARIANTS = ["default", "panel"] as const;
const SIDES = ["top", "bottom", "left", "right", "inline-start", "inline-end"] as const;
const ALIGNS = ["start", "center", "end"] as const;

const rows = (gap: number): CSSProperties => ({
  ...POPUP_ANCHOR,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap,
  marginRight: 520,
});

function Body() {
  return (
    <div className="flex flex-col gap-2">
      <PopoverTitle>Usage limits</PopoverTitle>
      <p className="text-xs text-muted-foreground">
        Your weekly limit resets on Monday. Limits are pooled across every provider account signed
        in on this machine.
      </p>
    </div>
  );
}

const meta = {
  title: "Components/Popover",
  component: PopoverPopup,
  tags: ["autodocs"],
  args: {
    padding: "default",
    width: "md",
    variant: "default",
    side: "bottom",
    align: "center",
    tooltipStyle: false,
  },
  argTypes: {
    padding: { control: "select", options: PADDINGS },
    width: { control: "select", options: WIDTHS },
    variant: { control: "select", options: VARIANTS },
    side: { control: "select", options: SIDES },
    align: { control: "select", options: ALIGNS },
    tooltipStyle: { control: "boolean" },
  },
} satisfies Meta<typeof PopoverPopup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Popover defaultOpen>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>Usage limits</PopoverTrigger>
      <PopoverPopup {...args}>
        <Body />
      </PopoverPopup>
    </Popover>
  ),
};

export const Variants: Story = {
  render: () => (
    <div style={rows(150)}>
      <Popover defaultOpen>
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>default</PopoverTrigger>
        <PopoverPopup side="right" align="start" width="md">
          <Body />
        </PopoverPopup>
      </Popover>
      <Popover defaultOpen>
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>
          tooltipStyle
        </PopoverTrigger>
        <PopoverPopup side="right" tooltipStyle>
          Drag to reorder. Hold Shift to move between groups.
        </PopoverPopup>
      </Popover>
    </div>
  ),
};

export const Sizes: Story = {
  name: "Widths",
  render: () => (
    <div style={rows(130)}>
      {WIDTHS.map((width) => (
        <Popover key={width} defaultOpen>
          <PopoverTrigger render={<Button variant="outline" size="sm" />}>
            {`width: ${width}`}
          </PopoverTrigger>
          <PopoverPopup side="right" align="start" width={width}>
            <Body />
          </PopoverPopup>
        </Popover>
      ))}
    </div>
  ),
};

export const Padding: Story = {
  render: () => (
    <div style={rows(150)}>
      {PADDINGS.map((padding) => (
        <Popover key={padding} defaultOpen>
          <PopoverTrigger render={<Button variant="outline" size="sm" />}>
            {`padding: ${padding}`}
          </PopoverTrigger>
          <PopoverPopup side="right" align="start" width="md" padding={padding}>
            <Body />
          </PopoverPopup>
        </Popover>
      ))}
    </div>
  ),
};

export const Closed: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <SmartphoneIcon />
        iPhone and iPad
      </PopoverTrigger>
      <PopoverPopup align="end">
        <PopoverTitle>App Store</PopoverTitle>
      </PopoverPopup>
    </Popover>
  ),
};

export const Open: Story = {
  name: "Open (mobile app QR)",
  render: () => (
    <div style={POPUP_ANCHOR}>
      <Popover defaultOpen>
        <PopoverTrigger render={<Button size="sm" variant="outline" />}>
          <SmartphoneIcon />
          iPhone and iPad
        </PopoverTrigger>
        <PopoverPopup align="end">
          <div className="flex flex-col items-center gap-3">
            <PopoverTitle>App Store</PopoverTitle>
            <p className="text-xs text-muted-foreground">Scan with your phone camera.</p>
            <div className="rounded-lg bg-white p-1.5">
              <QRCodeSvg
                value="https://apps.apple.com/us/app/t3-code-remote-claude-more/id6787819824"
                size={128}
                level="M"
                marginSize={1}
                title="App Store link"
              />
            </div>
            <PopoverClose render={<Button size="sm" variant="outline" />}>
              Open App Store
            </PopoverClose>
          </div>
        </PopoverPopup>
      </Popover>
    </div>
  ),
};

export const TooltipStyle: Story = {
  name: "Tooltip style",
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="About pooling" />}>
        <InfoIcon />
      </PopoverTrigger>
      <PopoverPopup side="top" tooltipStyle>
        Pooled limits count every signed-in account on this machine.
      </PopoverPopup>
    </Popover>
  ),
};
