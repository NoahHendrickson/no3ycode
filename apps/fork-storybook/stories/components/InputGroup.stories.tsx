import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronDownIcon, ChevronUpIcon, ExternalLink, SearchIcon, XIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import { Kbd } from "~/components/ui/kbd";
import { Spinner } from "~/components/ui/spinner";

import { FORCED_STATES, type ForcedState, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

const VARIANTS = ["default", "popover", "ghost"] as const;
const SIZES = ["default", "lg"] as const;
const ALIGNS = ["inline-start", "inline-end", "block-start", "block-end"] as const;
const INSETS = ["default", "pill"] as const;
const STATES = FORCED_STATES;

// The group answers hover itself and focus/disabled through its input, so each state lands on the
// element the real rule reads.
function splitState(state: ForcedState) {
  const forced = forcedStateProps(state);
  return state === "hover" || state === "active"
    ? { group: forced, input: {} }
    : { group: {}, input: forced };
}

const meta = {
  title: "Components/Input Group",
  component: InputGroup,
  tags: ["autodocs"],
  args: { variant: "default", size: "default" },
  argTypes: {
    variant: { control: "select", options: VARIANTS },
    size: { control: "select", options: SIZES },
  },
} satisfies Meta<typeof InputGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div className="w-80">
      <InputGroup {...args}>
        <InputGroupAddon>
          <SearchIcon aria-hidden className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          size="sm"
          placeholder="Search keybindings"
          aria-label="Search keybindings"
        />
      </InputGroup>
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <Stack gap={3}>
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <div className="w-80">
            <InputGroup variant={variant}>
              <InputGroupAddon>
                <SearchIcon aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                size="sm"
                placeholder="Search pull requests, or label:bug"
                aria-label="Search"
              />
            </InputGroup>
          </div>
        </Row>
      ))}
    </Stack>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      {SIZES.map((size) => (
        <Row key={size} label={size}>
          <div className="w-80">
            <InputGroup size={size}>
              <InputGroupAddon>
                <SearchIcon aria-hidden />
              </InputGroupAddon>
              <InputGroupInput size="sm" placeholder="Find in thread" aria-label="Find in thread" />
            </InputGroup>
          </div>
        </Row>
      ))}
    </Stack>
  ),
};

export const Addons: Story = {
  render: () => (
    <Stack gap={3}>
      {ALIGNS.map((align) => (
        <Row key={align} label={align}>
          <div className="w-80">
            <InputGroup>
              <InputGroupAddon
                align={align}
                className={align.startsWith("block") ? "text-xs text-muted-foreground" : undefined}
              >
                {align.startsWith("block") ? "Base directory" : <SearchIcon aria-hidden />}
              </InputGroupAddon>
              <InputGroupInput placeholder="~/Developer" aria-label={align} />
            </InputGroup>
          </div>
        </Row>
      ))}
      {INSETS.map((inset) => (
        <Row key={inset} label={`inset=${inset}`}>
          <div className="w-80">
            <InputGroup>
              <InputGroupInput size="sm" placeholder="Find in thread" aria-label="Find in thread" />
              <InputGroupAddon align="inline-end" inset={inset}>
                <Button size="icon-xs" variant="ghost" aria-label="Previous match">
                  <ChevronUpIcon />
                </Button>
                <Button size="icon-xs" variant="ghost" aria-label="Next match">
                  <ChevronDownIcon />
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </Row>
      ))}
      <Row label="kbd">
        <div className="w-80">
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput size="sm" placeholder="Search files" aria-label="Search files" />
            <InputGroupAddon align="inline-end">
              <Kbd>⌘P</Kbd>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </Row>
    </Stack>
  ),
};

export const States: Story = {
  render: () => (
    <Matrix
      rows={VARIANTS}
      columns={STATES}
      cell={(variant, state) => {
        const { group, input } = splitState(state);
        return (
          <div className="w-40">
            <InputGroup variant={variant} {...group}>
              <InputGroupAddon>
                <SearchIcon aria-hidden />
              </InputGroupAddon>
              <InputGroupInput size="sm" placeholder="Search" aria-label="Search" {...input} />
            </InputGroup>
          </div>
        );
      }}
    />
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="w-80 space-y-1.5">
      <InputGroup>
        <InputGroupInput
          size="compact"
          font="mono"
          defaultValue="terminalFocus &&"
          aria-invalid
          aria-label="When expression"
        />
      </InputGroup>
      <p className="text-xs text-destructive">Expected an expression after &&.</p>
    </div>
  ),
};

export const FindBar: Story = {
  name: "Find bar",
  render: () => (
    <div className="w-96">
      <InputGroup variant="popover" size="lg" role="search" aria-label="Find in thread">
        <InputGroupInput
          type="search"
          size="sm"
          defaultValue="checkpoint"
          aria-label="Find in thread"
          placeholder="Find in thread"
        />
        <InputGroupAddon align="inline-end" inset="pill">
          <span className="min-w-10 text-center text-xs tabular-nums text-muted-foreground">
            3/12
          </span>
          <Button size="icon-xs" variant="ghost" aria-label="Previous match">
            <ChevronUpIcon />
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label="Next match">
            <ChevronDownIcon />
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label="Close find">
            <XIcon />
          </Button>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

export const SearchField: Story = {
  name: "Search field",
  render: () => (
    <Stack gap={3}>
      <div className="w-96">
        <InputGroup className="min-w-0 flex-1 **:[input]:h-9 sm:**:[input]:h-8">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder="Search pull requests, or label:bug"
            aria-label="Search pull requests"
          />
        </InputGroup>
      </div>
      <div className="w-96">
        <InputGroup className="min-w-0 flex-1 **:[input]:h-9 sm:**:[input]:h-8">
          <InputGroupAddon>
            <Spinner aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            defaultValue="label:bug"
            aria-label="Search pull requests"
          />
        </InputGroup>
      </div>
    </Stack>
  ),
};

export const AddressBar: Story = {
  name: "Address bar",
  render: () => (
    <div className="flex w-[30rem] items-center">
      <InputGroup variant="ghost" className="group/address h-7 flex-1">
        <InputGroupInput
          defaultValue="http://localhost:5173/settings/general"
          aria-label="Search or enter URL"
          size="sm"
          spellCheck={false}
        />
        <InputGroupAddon align="inline-end">
          <Button variant="ghost" size="icon-xs" aria-label="Open in system browser" type="button">
            <ExternalLink />
          </Button>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};
