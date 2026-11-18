import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  EyeIcon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";

import { Stack } from "../Specimen.tsx";

const VARIANTS = ["default", "error", "info", "success", "warning"] as const;
const SURFACES = ["default", "glass"] as const;
const ALIGNMENTS = ["center", "first-line"] as const;

const ICONS = {
  default: EyeIcon,
  error: CircleAlertIcon,
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
} as const;

const meta = {
  title: "Components/Alert",
  component: Alert,
  tags: ["autodocs"],
  args: { variant: "warning", surface: "default", controlAlignment: "center" },
  argTypes: {
    variant: { control: "select", options: [...VARIANTS, "sidebar"] },
    surface: { control: "select", options: SURFACES },
    controlAlignment: { control: "select", options: ALIGNMENTS },
  },
  render: (args) => (
    <div className="w-[32rem]">
      <Alert {...args}>
        <TriangleAlertIcon />
        <AlertTitle>Intel build on Apple Silicon</AlertTitle>
        <AlertDescription>
          This Mac is running the Intel build under Rosetta. Download the Apple Silicon build for
          better performance.
        </AlertDescription>
      </Alert>
    </div>
  ),
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="w-[32rem]">
      <Stack gap={3}>
        {VARIANTS.map((variant) => {
          const Icon = ICONS[variant];
          return (
            <Alert key={variant} variant={variant}>
              <Icon />
              <AlertTitle>{variant}</AlertTitle>
              <AlertDescription>
                Can't find a setting? Hop to any other settings page.
              </AlertDescription>
            </Alert>
          );
        })}
      </Stack>
    </div>
  ),
};

export const DescriptionOnly: Story = {
  name: "Description only",
  render: () => (
    <div className="w-[32rem]">
      <Stack gap={3}>
        <Alert variant="info">
          <InfoIcon aria-hidden />
          <AlertDescription>
            Can't find a setting? Keep this project picked above and hop to any other settings page.
          </AlertDescription>
        </Alert>
        <Alert variant="error">
          <AlertDescription>Could not reach the environment at 192.168.1.20:3773.</AlertDescription>
        </Alert>
        <Alert variant="warning">
          <AlertTitle>Check this address</AlertTitle>
          <AlertDescription>
            This app cannot confirm it is one of your machines. The pairing code you paste is sent
            there.
            <span className="block break-all">https://build-box.tailnet-1234.ts.net</span>
          </AlertDescription>
        </Alert>
      </Stack>
    </div>
  ),
};

export const ControlAlignment: Story = {
  name: "Control alignment",
  render: () => (
    <div className="w-[32rem]">
      <Stack gap={3}>
        {ALIGNMENTS.map((alignment) => (
          <Alert key={alignment} variant="error" controlAlignment={alignment}>
            <CircleAlertIcon />
            <AlertDescription>
              {alignment}: the provider exited before the turn finished. Check the provider logs for
              details, then try the turn again.
            </AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm">
                Retry
              </Button>
              <Button variant="ghost" size="icon-xs" aria-label="Dismiss error">
                <XIcon />
              </Button>
            </AlertAction>
          </Alert>
        ))}
      </Stack>
    </div>
  ),
};

export const ThreadErrorBanner: Story = {
  name: "Thread error banner (glass)",
  render: () => (
    <Stack gap={3}>
      <div className="mx-auto w-fit max-w-[min(48rem,calc(100%-2rem))]">
        <Alert variant="error" surface="glass" controlAlignment="first-line">
          <CircleAlertIcon />
          <AlertDescription>
            Codex exited unexpectedly (code 1). The turn was interrupted.
          </AlertDescription>
          <AlertAction>
            <Button variant="ghost" size="icon-xs" aria-label="Dismiss error">
              <XIcon />
            </Button>
          </AlertAction>
        </Alert>
      </div>
      <div className="mx-auto w-fit max-w-[min(48rem,calc(100%-2rem))]">
        <Alert variant="warning" surface="glass" controlAlignment="first-line">
          <CircleAlertIcon />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">ChatGPT usage limit reached</p>
              <p>
                You've reached your workspace's limit for using your ChatGPT plan in other apps.
                Copy a request to ask your workspace admin for increased usage limits.
              </p>
            </div>
          </AlertDescription>
          <AlertAction>
            <Button variant="default" size="sm">
              Copy request for admin
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label="Dismiss error">
              <XIcon />
            </Button>
          </AlertAction>
        </Alert>
      </div>
    </Stack>
  ),
};

export const Running: Story = {
  name: "With spinner",
  render: () => (
    <div className="w-[32rem]">
      <Alert variant="info">
        <Spinner />
        <AlertDescription>
          Rewriting this guide. You will be told when the new one is ready.
        </AlertDescription>
      </Alert>
    </div>
  ),
};

export const Sidebar: Story = {
  name: "Sidebar variant",
  parameters: { surface: "sidebar" },
  render: () => (
    <div className="w-60">
      <Alert variant="sidebar">
        <TriangleAlertIcon />
        <AlertTitle>Update ready</AlertTitle>
        <AlertDescription>Restart to install version 0.12.0.</AlertDescription>
      </Alert>
    </div>
  ),
};
