import type { Meta, StoryObj } from "@storybook/react-vite";

import { Skeleton } from "~/components/ui/skeleton";

import { Row, Stack } from "../Specimen.tsx";

const SHAPES = ["block", "card", "pill"] as const;

const meta = {
  title: "Components/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  args: { shape: "block", className: "h-4 w-48" },
  argTypes: {
    shape: { control: "select", options: SHAPES },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Shapes: Story = {
  render: () => (
    <Stack gap={4}>
      <Row label="block">
        <Skeleton shape="block" className="size-5" />
        <Skeleton shape="block" className="h-4 w-40" />
      </Row>
      <Row label="card">
        <Skeleton shape="card" className="h-16 w-56" />
      </Row>
      <Row label="pill">
        <Skeleton shape="pill" className="h-2.5 w-24" />
        <Skeleton shape="pill" className="h-3 w-5" />
        <Skeleton shape="pill" className="size-2" />
      </Row>
    </Stack>
  ),
};

const FILE_TITLES = ["w-40", "w-28", "w-52"] as const;
const LINE_WIDTHS = ["w-4/5", "w-3/5", "w-2/3", "w-5/6", "w-1/2"] as const;

export const DiffLoading: Story = {
  name: "Diff panel loading",
  render: () => (
    <div className="w-[30rem] overflow-hidden rounded-xl border bg-card">
      {FILE_TITLES.map((titleWidth) => (
        <div key={titleWidth} className="border-b last:border-b-0">
          <div className="flex h-8 items-center gap-2 px-2 pr-3">
            <div className="flex size-5 shrink-0 items-center justify-center">
              <Skeleton className="size-2.5" />
            </div>
            <Skeleton className="size-5 shrink-0" />
            <Skeleton shape="pill" className={`h-2.5 ${titleWidth}`} />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Skeleton shape="pill" className="h-3 w-5" />
              <Skeleton shape="pill" className="h-3 w-5" />
            </div>
          </div>
          <div className="space-y-2 px-3 py-2">
            {LINE_WIDTHS.map((width) => (
              <div key={width} className="flex items-center gap-3">
                <Skeleton shape="pill" className="h-2.5 w-5 shrink-0" />
                <Skeleton shape="pill" className={`h-2.5 ${width}`} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};

export const SettingsRowsLoading: Story = {
  name: "Settings rows loading",
  parameters: { surface: "page" },
  render: () => (
    <div className="flex w-[30rem] flex-col divide-y divide-border rounded-xl border bg-card">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
            <Skeleton className="size-4.5" />
            <Skeleton
              shape="pill"
              className="pointer-events-none absolute -left-0.5 -top-0.5 size-2"
              aria-hidden
            />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton shape="pill" className="h-3 w-32" />
            <Skeleton shape="pill" className="h-2.5 w-56" />
          </div>
          <Skeleton shape="pill" className="h-5 w-9" />
        </div>
      ))}
    </div>
  ),
};
