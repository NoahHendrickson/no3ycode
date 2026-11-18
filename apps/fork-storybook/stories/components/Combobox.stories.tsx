import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckIcon, ChevronDownIcon, MessageSquareIcon, SearchIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxSearchInput,
  ComboboxStatus,
  ComboboxTrigger,
} from "~/components/ui/combobox";
import { SelectButton } from "~/components/ui/select";

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
const CONTENT = ["placeholder", "filled"] as const;

type SpeechModel = { readonly id: string; readonly name: string };
const MODELS: ReadonlyArray<SpeechModel> = [
  { id: "openai/gpt-4o-transcribe", name: "GPT-4o Transcribe" },
  { id: "openai/gpt-4o-mini-transcribe", name: "GPT-4o mini Transcribe" },
  { id: "openai/whisper-1", name: "Whisper" },
  { id: "mistralai/voxtral-small", name: "Voxtral Small" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
];

const FONTS = [
  "Inter Variable",
  "SF Pro",
  "IBM Plex Sans",
  "Geist",
  "JetBrains Mono",
  "Berkeley Mono",
] as const;

const REFS = [
  { name: "main", badge: "current" },
  { name: "t3/figma-design-system", badge: null },
  { name: "t3/digest-cards-resize-dismiss", badge: "worktree" },
  { name: "origin/custom", badge: "remote" },
  { name: "origin/main", badge: "default" },
] as const;

function ModelList() {
  return (
    <ComboboxList className="max-h-64">
      {(model: SpeechModel) => (
        <ComboboxItem key={model.id} value={model}>
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{model.name}</span>
            <span className="truncate text-xs text-muted-foreground">{model.id}</span>
          </span>
        </ComboboxItem>
      )}
    </ComboboxList>
  );
}

const meta = {
  title: "Components/Combobox",
  component: ComboboxInput,
  tags: ["autodocs"],
  args: {
    size: "sm",
    showTrigger: true,
    showClear: false,
    placeholder: "Search transcription models",
  },
  argTypes: {
    size: { control: "select", options: SIZES },
    showTrigger: { control: "boolean" },
    showClear: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof ComboboxInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div className="w-80">
      <Combobox items={MODELS} itemToStringLabel={(model: SpeechModel) => model.name} autoHighlight>
        <ComboboxInput {...args} aria-label="OpenRouter model" />
        <ComboboxPopup>
          <ComboboxEmpty>No transcription model matches.</ComboboxEmpty>
          <ModelList />
        </ComboboxPopup>
      </Combobox>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      {SIZES.map((size) => (
        <Row key={size} label={size}>
          <div className="w-72">
            <Combobox items={MODELS}>
              <ComboboxInput
                size={size}
                placeholder="Search transcription models"
                aria-label={size}
              />
            </Combobox>
          </div>
        </Row>
      ))}
      <Row label="startAddon">
        <div className="w-72">
          <Combobox items={MODELS}>
            <ComboboxInput
              startAddon={<SearchIcon />}
              placeholder="Search transcription models"
              aria-label="With addon"
            />
          </Combobox>
        </div>
      </Row>
      <Row label="showClear">
        <div className="w-72">
          <Combobox
            items={MODELS}
            defaultValue={MODELS[2]}
            itemToStringLabel={(model: SpeechModel) => model.name}
          >
            <ComboboxInput showClear aria-label="With clear" />
          </Combobox>
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
          <Combobox
            items={MODELS}
            itemToStringLabel={(model: SpeechModel) => model.name}
            {...(content === "filled" ? { defaultValue: MODELS[0] } : {})}
          >
            <ComboboxInput
              size="sm"
              placeholder="Search models"
              aria-label={`${content} ${state}`}
              {...forcedStateProps(state)}
            />
          </Combobox>
        </div>
      )}
    />
  ),
};

export const Open: Story = {
  render: () => (
    <div className="flex h-96 w-80 flex-col">
      <Combobox
        items={MODELS}
        itemToStringLabel={(model: SpeechModel) => model.name}
        defaultValue={MODELS[0]}
        defaultOpen
        autoHighlight
      >
        <ComboboxInput
          size="sm"
          placeholder="Search transcription models"
          aria-label="OpenRouter model"
        />
        <ComboboxPopup>
          <ComboboxEmpty>No transcription model matches.</ComboboxEmpty>
          <ModelList />
        </ComboboxPopup>
      </Combobox>
      <p className="mt-1 truncate text-xs text-muted-foreground">openai/gpt-4o-transcribe</p>
    </div>
  ),
};

export const PickerClosed: Story = {
  name: "Picker (closed)",
  render: () => (
    <Combobox items={FONTS} defaultValue="Inter Variable">
      <ComboboxTrigger
        aria-label="Interface font"
        render={<SelectButton size="sm" className="w-44" />}
      >
        Inter Variable
      </ComboboxTrigger>
    </Combobox>
  ),
};

export const PickerOpen: Story = {
  name: "Picker (open)",
  render: () => (
    <div className="flex h-[26rem] items-start">
      <Combobox items={FONTS} defaultValue="Inter Variable" defaultOpen autoHighlight>
        <ComboboxTrigger
          aria-label="Interface font"
          render={<SelectButton size="sm" className="w-44" />}
        >
          Inter Variable
        </ComboboxTrigger>
        <ComboboxPopup align="start" className="flex w-72 flex-col">
          <ComboboxSearchInput placeholder="Search fonts…" />
          <ComboboxEmpty>No fonts found.</ComboboxEmpty>
          <ComboboxList className="max-h-72">
            {(family: string) => (
              <ComboboxItem hideIndicator key={family} value={family}>
                <div className="flex w-full min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 truncate" style={{ fontFamily: family }}>
                    {family}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {family === "Inter Variable" ? (
                      <>
                        <span className="text-3xs text-muted-foreground/60">default</span>
                        <CheckIcon className="size-3.5 text-muted-foreground" />
                      </>
                    ) : null}
                  </span>
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
    </div>
  ),
};

export const BranchPicker: Story = {
  name: "Branch picker (open, with status)",
  render: () => (
    <div className="flex h-[24rem] items-start">
      <Combobox items={REFS.map((ref) => ref.name)} defaultValue="main" defaultOpen autoHighlight>
        <ComboboxTrigger
          render={<Button variant="outline" size="sm" />}
          className="w-56 justify-between"
        >
          <span className="min-w-0 flex-1 truncate text-left">main</span>
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </ComboboxTrigger>
        <ComboboxPopup align="start" className="flex w-80 flex-col">
          <ComboboxSearchInput placeholder="Search branches…" />
          <ComboboxEmpty>No refs found.</ComboboxEmpty>
          <ComboboxList className="max-h-56">
            {(name: string) => {
              const badge = REFS.find((ref) => ref.name === name)?.badge;
              return (
                <ComboboxItem hideIndicator key={name} value={name}>
                  <div className="flex w-full min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    {badge ? (
                      <span className="shrink-0 text-3xs text-muted-foreground/45">{badge}</span>
                    ) : null}
                  </div>
                </ComboboxItem>
              );
            }}
          </ComboboxList>
          <ComboboxStatus>Showing 5 of 128 refs</ComboboxStatus>
        </ComboboxPopup>
      </Combobox>
    </div>
  ),
};

export const DestinationPicker: Story = {
  name: "Destination picker (empty)",
  render: () => (
    <div className="flex h-60 items-start">
      <Combobox
        items={[] as ReadonlyArray<string>}
        defaultOpen
        filter={null}
        defaultInputValue="release notes"
      >
        <ComboboxTrigger
          render={<Button variant="outline" size="sm" />}
          className="w-72 justify-between"
        >
          <MessageSquareIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-left">New thread each run</span>
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </ComboboxTrigger>
        <ComboboxPopup align="start" side="bottom" className="w-80">
          <ComboboxSearchInput aria-label="Search threads" placeholder="Search all threads..." />
          <ComboboxEmpty>No threads match.</ComboboxEmpty>
          <ComboboxList>
            {(title: string) => (
              <ComboboxItem key={title} value={title}>
                {title}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
    </div>
  ),
};
