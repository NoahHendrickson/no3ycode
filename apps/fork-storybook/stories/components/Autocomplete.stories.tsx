import type { Meta, StoryObj } from "@storybook/react-vite";
import { SearchIcon } from "lucide-react";

import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "~/components/ui/autocomplete";
import { CommandShortcut } from "~/components/ui/command";

import { type ForcedState, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Row, Stack } from "../Specimen.tsx";

const SIZES = ["sm", "default", "lg"] as const;
const STATES = [
  "default",
  "hover",
  "active",
  "focus",
  "disabled",
] as const satisfies ReadonlyArray<ForcedState>;
const CONTENT = ["placeholder", "filled", "invalid"] as const;

type SshHost = { readonly alias: string; readonly address: string };
const HOSTS: ReadonlyArray<SshHost> = [
  { alias: "devbox", address: "noah@10.0.0.12" },
  { alias: "gpu-runner", address: "ubuntu@gpu-runner.tailnet.ts.net" },
  { alias: "mac-mini", address: "mac-mini.local:2222" },
  { alias: "staging", address: "deploy@staging.example.com" },
];

function HostLabel({ host, index }: { host: SshHost; index: number }) {
  return (
    <>
      <span className="min-w-0 truncate text-sm font-medium">{host.alias}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{host.address}</span>
      <CommandShortcut className="shrink-0">⌘{index + 1}</CommandShortcut>
    </>
  );
}

const meta = {
  title: "Components/Autocomplete",
  component: AutocompleteInput,
  tags: ["autodocs"],
  args: {
    size: "default",
    showTrigger: false,
    showClear: false,
    placeholder: "Search hosts or type devbox",
  },
  argTypes: {
    size: { control: "select", options: SIZES },
    showTrigger: { control: "boolean" },
    showClear: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof AutocompleteInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div className="w-80">
      <Autocomplete
        items={HOSTS}
        itemToStringValue={(host: SshHost) => host.alias}
        mode="none"
        openOnInputClick
      >
        <AutocompleteInput {...args} aria-label="SSH host or alias" spellCheck={false} />
        <AutocompletePopup>
          <AutocompleteList className="max-h-72">
            {(host: SshHost) => (
              <AutocompleteItem
                key={host.alias}
                value={host}
                className="h-8 min-h-8 whitespace-nowrap"
              >
                <HostLabel host={host} index={HOSTS.indexOf(host)} />
              </AutocompleteItem>
            )}
          </AutocompleteList>
        </AutocompletePopup>
      </Autocomplete>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      {SIZES.map((size) => (
        <Row key={size} label={size}>
          <div className="w-72">
            <Autocomplete items={HOSTS}>
              <AutocompleteInput
                size={size}
                placeholder="Search hosts or type devbox"
                aria-label={size}
              />
            </Autocomplete>
          </div>
        </Row>
      ))}
      <Row label="startAddon">
        <div className="w-72">
          <Autocomplete items={HOSTS}>
            <AutocompleteInput
              startAddon={<SearchIcon />}
              placeholder="Search hosts"
              aria-label="With addon"
            />
          </Autocomplete>
        </div>
      </Row>
      <Row label="showTrigger">
        <div className="w-72">
          <Autocomplete items={HOSTS}>
            <AutocompleteInput showTrigger placeholder="Search hosts" aria-label="With trigger" />
          </Autocomplete>
        </div>
      </Row>
      <Row label="showClear">
        <div className="w-72">
          <Autocomplete items={HOSTS} defaultValue="devbox">
            <AutocompleteInput showClear aria-label="With clear" />
          </Autocomplete>
        </div>
      </Row>
    </Stack>
  ),
};

export const States: Story = {
  render: () => (
    <Matrix
      rows={CONTENT}
      columns={STATES}
      cell={(content, state) => (
        <div className="w-40">
          <Autocomplete
            items={HOSTS}
            {...(content === "placeholder" ? {} : { defaultValue: "devbox" })}
          >
            <AutocompleteInput
              placeholder="Search hosts"
              aria-label={`${content} ${state}`}
              aria-invalid={content === "invalid" ? true : undefined}
              {...forcedStateProps(state)}
            />
          </Autocomplete>
        </div>
      )}
    />
  ),
};

export const Open: Story = {
  render: () => (
    <div className="flex h-80 w-96 flex-col">
      <label htmlFor="story-ssh-host" className="mb-1.5 block text-xs font-medium text-foreground">
        SSH host or alias
      </label>
      <Autocomplete
        items={HOSTS}
        itemToStringValue={(host: SshHost) => host.alias}
        mode="none"
        defaultOpen
        openOnInputClick
      >
        <AutocompleteInput
          id="story-ssh-host"
          placeholder="Search hosts or type devbox"
          spellCheck={false}
        />
        <AutocompletePopup>
          <AutocompleteList className="max-h-72">
            {(host: SshHost) => (
              <AutocompleteItem
                key={host.alias}
                value={host}
                className="h-8 min-h-8 whitespace-nowrap"
              >
                <HostLabel host={host} index={HOSTS.indexOf(host)} />
              </AutocompleteItem>
            )}
          </AutocompleteList>
        </AutocompletePopup>
      </Autocomplete>
    </div>
  ),
};

export const OpenGrouped: Story = {
  name: "Open with groups",
  render: () => (
    <div className="flex h-96 w-96 flex-col">
      <Autocomplete
        items={[
          { value: "Discovered", items: HOSTS.slice(0, 2) },
          { value: "Saved", items: HOSTS.slice(2) },
        ]}
        itemToStringValue={(host: SshHost) => host.alias}
        mode="none"
        defaultOpen
      >
        <AutocompleteInput placeholder="Search hosts or type devbox" aria-label="SSH host" />
        <AutocompletePopup>
          <AutocompleteList>
            {(group: { value: string; items: ReadonlyArray<SshHost> }) => (
              <AutocompleteGroup key={group.value} items={group.items}>
                <AutocompleteGroupLabel>{group.value}</AutocompleteGroupLabel>
                {group.items.map((host) => (
                  <AutocompleteItem
                    key={host.alias}
                    value={host}
                    className="h-8 min-h-8 whitespace-nowrap"
                  >
                    <HostLabel host={host} index={HOSTS.indexOf(host)} />
                  </AutocompleteItem>
                ))}
              </AutocompleteGroup>
            )}
          </AutocompleteList>
        </AutocompletePopup>
      </Autocomplete>
    </div>
  ),
};

export const Empty: Story = {
  name: "Open, no matches",
  render: () => (
    <div className="flex h-48 w-96 flex-col">
      <Autocomplete
        items={[] as ReadonlyArray<SshHost>}
        mode="none"
        defaultOpen
        defaultValue="prod-db"
      >
        <AutocompleteInput placeholder="Search hosts or type devbox" aria-label="SSH host" />
        <AutocompletePopup>
          <AutocompleteEmpty className="break-all">No hosts match "prod-db".</AutocompleteEmpty>
        </AutocompletePopup>
      </Autocomplete>
    </div>
  ),
};
