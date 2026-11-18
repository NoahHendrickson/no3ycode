import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "~/components/ui/button";
import { QRCodeSvg } from "~/components/ui/qr-code";

import { Row } from "../Specimen.tsx";

const PAIRING_URL = "https://app.t3.codes/pair#host=build-box.local:3773&token=4f9c2a7e1b";
const LEVELS = ["L", "M", "Q", "H"] as const;

const meta = {
  title: "Components/QR Code",
  component: QRCodeSvg,
  tags: ["autodocs"],
  args: {
    value: PAIRING_URL,
    size: 168,
    level: "M",
    marginSize: 1,
    title: "Pairing link. Scan to open on another device",
    foregroundColor: "#000",
    backgroundColor: "#fff",
  },
  argTypes: {
    level: { control: "select", options: LEVELS },
    size: { control: { type: "range", min: 64, max: 320, step: 4 } },
    marginSize: { control: { type: "range", min: 0, max: 6, step: 1 } },
    foregroundColor: { control: "color" },
    backgroundColor: { control: "color" },
  },
} satisfies Meta<typeof QRCodeSvg>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const ErrorCorrection: Story = {
  name: "Error correction levels",
  render: () => (
    <Row>
      {LEVELS.map((level) => (
        <div key={level} className="flex flex-col items-center gap-1.5">
          <div className="rounded-lg bg-white p-1.5">
            <QRCodeSvg value={PAIRING_URL} size={128} level={level} marginSize={1} />
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">{level}</span>
        </div>
      ))}
    </Row>
  ),
};

export const PairingCard: Story = {
  name: "Pairing card",
  parameters: { surface: "page" },
  render: () => (
    <div className="flex w-[34rem] flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-sm font-medium">Pair a phone</span>
        <p className="text-xs text-muted-foreground">
          Scan this code with the T3 Code app, or open the link on the device you want to connect.
        </p>
        <Button size="sm" variant="outline" className="w-fit">
          Copy link
        </Button>
      </div>
      <div className="w-fit shrink-0 self-center rounded-xl bg-white p-3 sm:self-start">
        <QRCodeSvg
          value={PAIRING_URL}
          size={168}
          level="M"
          marginSize={1}
          title="Pairing link. Scan to open on another device"
        />
      </div>
    </div>
  ),
};

export const RevealPanel: Story = {
  name: "Reveal panel",
  parameters: { surface: "page" },
  render: () => (
    <div className="flex w-80 justify-center rounded-xl border border-border/60 bg-muted/30 p-4">
      <QRCodeSvg
        value={PAIRING_URL}
        size={132}
        level="M"
        marginSize={2}
        title="Pairing link. Scan to open on another device"
      />
    </div>
  ),
};
