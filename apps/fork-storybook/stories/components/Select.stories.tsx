import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Select,
  SelectButton,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { type ForcedState, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

const VARIANTS = ["default", "ghost"] as const;
const SIZES = ["xs", "compact", "sm", "default", "lg"] as const;
const STATES = [
  "default",
  "hover",
  "active",
  "focus",
  "disabled",
] as const satisfies ReadonlyArray<ForcedState>;

const PROJECT_ORDER = {
  updated_at: "Last user message",
  created_at: "Created at",
  manual: "Manual",
} as const;
type ProjectOrder = keyof typeof PROJECT_ORDER;
const ORDERS = Object.keys(PROJECT_ORDER) as ReadonlyArray<ProjectOrder>;

const DEVICE_PRESETS = [
  { id: "iphone-se", label: "iPhone SE", detail: "375 × 667" },
  { id: "iphone-xr", label: "iPhone XR", detail: "414 × 896" },
  { id: "iphone-12-pro", label: "iPhone 12 Pro", detail: "390 × 844" },
  { id: "iphone-14-pro-max", label: "iPhone 14 Pro Max", detail: "430 × 932" },
  { id: "pixel-7", label: "Pixel 7", detail: "412 × 915" },
  { id: "galaxy-s8-plus", label: "Samsung Galaxy S8+", detail: "360 × 740" },
] as const;
const DEVICE_ITEMS = [
  { value: "responsive", label: "Responsive" },
  ...DEVICE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
];

const SNOOZE_UNITS = { minutes: "Minutes", hours: "Hours", days: "Days" } as const;

function ProjectOrderSelect({
  open,
  variant,
  size = "sm",
  state = "default",
  className = "w-44",
}: {
  open?: boolean;
  variant?: (typeof VARIANTS)[number];
  size?: (typeof SIZES)[number];
  state?: ForcedState;
  className?: string;
}) {
  return (
    <Select
      items={PROJECT_ORDER}
      defaultValue="updated_at"
      {...(open ? { defaultOpen: true } : {})}
    >
      <SelectTrigger
        size={size}
        variant={variant}
        className={className}
        aria-label="Project order"
        {...forcedStateProps(state)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectPopup align="end" alignItemWithTrigger={false}>
        {ORDERS.map((order) => (
          <SelectItem hideIndicator key={order} value={order}>
            {PROJECT_ORDER[order]}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

const meta = {
  title: "Components/Select",
  component: SelectTrigger,
  tags: ["autodocs"],
  args: { variant: "default", size: "sm" },
  argTypes: {
    variant: { control: "select", options: VARIANTS },
    size: { control: "select", options: SIZES },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof SelectTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Select items={PROJECT_ORDER} defaultValue="updated_at">
      <SelectTrigger {...args} className="w-44" aria-label="Project order">
        <SelectValue />
      </SelectTrigger>
      <SelectPopup align="end" alignItemWithTrigger={false}>
        {ORDERS.map((order) => (
          <SelectItem hideIndicator key={order} value={order}>
            {PROJECT_ORDER[order]}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  ),
};

export const Variants: Story = {
  render: () => (
    <Stack gap={3}>
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <ProjectOrderSelect variant={variant} />
        </Row>
      ))}
      <Row label="SelectButton">
        <SelectButton size="sm" className="w-44">
          Inter Variable
        </SelectButton>
      </Row>
    </Stack>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      {SIZES.map((size) => (
        <Row key={size} label={size}>
          <ProjectOrderSelect size={size} />
          <ProjectOrderSelect size={size} variant="ghost" className="w-auto" />
        </Row>
      ))}
    </Stack>
  ),
};

export const States: Story = {
  render: () => (
    <Matrix
      rows={VARIANTS}
      columns={STATES}
      cell={(variant, state) => (
        <ProjectOrderSelect variant={variant} state={state} className="w-36" />
      )}
    />
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="w-56 space-y-1.5">
      <Select items={SNOOZE_UNITS}>
        <SelectTrigger aria-invalid aria-label="Unit">
          <SelectValue placeholder="Choose a unit" />
        </SelectTrigger>
        <SelectPopup>
          {Object.entries(SNOOZE_UNITS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      <p className="text-xs text-destructive">Choose how long to snooze.</p>
    </div>
  ),
};

export const Closed: Story = {
  render: () => <ProjectOrderSelect />,
};

export const Open: Story = {
  render: () => (
    <div className="flex h-64 items-start">
      <ProjectOrderSelect open />
    </div>
  ),
};

export const OpenOverTrigger: Story = {
  name: "Open (aligned to item)",
  render: () => (
    <div className="w-56">
      <Select items={SNOOZE_UNITS} defaultValue="hours" defaultOpen>
        <SelectTrigger aria-label="Unit">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {Object.entries(SNOOZE_UNITS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  ),
};

export const Grouped: Story = {
  name: "Open with groups",
  render: () => (
    <div className="flex h-96 items-start">
      <Select modal={false} defaultValue="iphone-12-pro" defaultOpen items={DEVICE_ITEMS}>
        <SelectTrigger
          variant="ghost"
          size="xs"
          className="w-36 shrink-0 justify-between"
          aria-label="Browser device preset"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectPopup align="start" alignItemWithTrigger={false}>
          <SelectItem value="responsive">Responsive</SelectItem>
          <SelectGroup>
            <SelectGroupLabel>Standard</SelectGroupLabel>
            {DEVICE_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                <span className="flex w-full items-center justify-between gap-5">
                  <span>{preset.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {preset.detail}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectPopup>
      </Select>
    </div>
  ),
};
