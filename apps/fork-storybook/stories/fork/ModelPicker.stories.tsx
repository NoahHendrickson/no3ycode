import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ProviderOptionDescriptor,
  type ProviderOptionSelections,
  type ServerProvider,
  type ServerProviderModel,
} from "@t3tools/contracts";
import { useState } from "react";
import { screen, userEvent } from "storybook/test";

import { ComposerModelPicker } from "~/custom/ComposerModelPicker";
import { deriveProviderInstanceEntries } from "~/providerInstances";

const CLAUDE = ProviderDriverKind.make("claudeAgent");
const CODEX = ProviderDriverKind.make("codex");
const ANTIGRAVITY = ProviderDriverKind.make("antigravity");

// The bundled manifest's current profiles (apps/server/src/provider/model-manifest.json).
const CLAUDE_EFFORT: ProviderOptionDescriptor = {
  id: "effort",
  label: "Reasoning",
  type: "select",
  options: [
    { id: "low", label: "Low" },
    { id: "medium", label: "Medium" },
    { id: "high", label: "High", isDefault: true },
    { id: "xhigh", label: "Extra High" },
    { id: "max", label: "Max" },
    { id: "ultracode", label: "Ultracode" },
    { id: "ultrathink", label: "Ultrathink" },
  ],
  promptInjectedValues: ["ultrathink"],
};
const FAST_MODE: ProviderOptionDescriptor = { id: "fastMode", label: "Fast Mode", type: "boolean" };
const CODEX_EFFORT: ProviderOptionDescriptor = {
  id: "reasoningEffort",
  label: "Reasoning",
  type: "select",
  options: [
    { id: "low", label: "Low" },
    { id: "medium", label: "Medium" },
    { id: "high", label: "High", isDefault: true },
    { id: "xhigh", label: "Extra High" },
  ],
};
const SERVICE_TIER: ProviderOptionDescriptor = {
  id: "serviceTier",
  label: "Service Tier",
  type: "select",
  options: [
    { id: "default", label: "Standard", isDefault: true },
    { id: "fast", label: "Fast" },
  ],
};

const model = (
  slug: string,
  name: string,
  optionDescriptors: ReadonlyArray<ProviderOptionDescriptor>,
  isLegacy = false,
): ServerProviderModel => ({
  slug,
  name,
  isCustom: false,
  ...(isLegacy ? { isLegacy } : {}),
  capabilities: { optionDescriptors: [...optionDescriptors] },
});

const CLAUDE_MODELS = [
  model("claude-opus-5-5", "Claude Opus 5.5", [CLAUDE_EFFORT, FAST_MODE]),
  model("claude-sonnet-5-5", "Claude Sonnet 5.5", [CLAUDE_EFFORT]),
  model("claude-fable-5-2", "Claude Fable 5.2", [CLAUDE_EFFORT, FAST_MODE]),
  model("claude-haiku-5-5", "Claude Haiku 5.5", [CLAUDE_EFFORT]),
  model("claude-opus-5", "Claude Opus 5", [CLAUDE_EFFORT, FAST_MODE], true),
  model("claude-sonnet-5", "Claude Sonnet 5", [CLAUDE_EFFORT], true),
  model("claude-fable-5-1", "Claude Fable 5.1", [CLAUDE_EFFORT], true),
];
const CODEX_MODELS = [
  model("gpt-6.1-sol", "GPT-6.1 Sol", [CODEX_EFFORT, SERVICE_TIER]),
  model("gpt-6-astra", "GPT-6 Astra", [CODEX_EFFORT, SERVICE_TIER]),
  model("gpt-6-luna", "GPT-6 Luna", [CODEX_EFFORT, SERVICE_TIER]),
  model("gpt-6-sol", "GPT-6 Sol", [CODEX_EFFORT], true),
];
const ANTIGRAVITY_MODELS = [
  model("gemini-4-carbon", "Gemini 4 Carbon", []),
  model("gemini-4-argon", "Gemini 4 Argon", []),
  model("gemini-3.8-flash", "Gemini 3.8 Flash", []),
];

const provider = (
  driver: ProviderDriverKind,
  displayName: string,
  models: ReadonlyArray<ServerProviderModel>,
): ServerProvider => ({
  instanceId: ProviderInstanceId.make(driver),
  driver,
  displayName,
  enabled: true,
  installed: true,
  version: null,
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: "2026-11-26T09:00:00.000Z",
  models: [...models],
  slashCommands: [],
  skills: [],
});

const ENTRIES = deriveProviderInstanceEntries([
  provider(CLAUDE, "Claude", CLAUDE_MODELS),
  provider(CODEX, "Codex", CODEX_MODELS),
  provider(ANTIGRAVITY, "Antigravity", ANTIGRAVITY_MODELS),
]);
const MODELS_BY_INSTANCE = new Map(ENTRIES.map((entry) => [entry.instanceId, entry.models]));

/** The composer's picker, open, as a controlled editor (scheduled tasks' path), so a pick or an
    effort change moves this story's state instead of a conversation draft. */
function ModelPicker(props: { model: string; options?: ProviderOptionSelections }) {
  const [selection, setSelection] = useState({
    instanceId: ProviderInstanceId.make(CLAUDE),
    model: props.model,
  });
  const [options, setOptions] = useState(props.options);
  const [open, setOpen] = useState(true);
  const entry = ENTRIES.find((candidate) => candidate.instanceId === selection.instanceId)!;
  return (
    <ComposerModelPicker
      environmentId={null}
      activeInstanceId={selection.instanceId}
      model={selection.model}
      lockedProvider={null}
      instanceEntries={ENTRIES}
      modelOptionsByInstance={MODELS_BY_INSTANCE}
      open={open}
      onOpenChange={setOpen}
      onInstanceModelChange={(instanceId, next) => {
        setSelection({ instanceId, model: next });
        setOptions(undefined);
      }}
      traitsInput={{
        provider: entry.driverKind,
        instanceId: entry.instanceId,
        model: selection.model,
        models: entry.models,
        modelOptions: options,
        promptUltrathink: "none",
        onPromptEdit: () => {},
        onModelOptionsChange: setOptions,
      }}
    />
  );
}

const meta = {
  title: "Fork/Model picker",
  component: ModelPicker,
  tags: ["autodocs"],
  // Opens above its trigger, as it does from the composer's control row.
  parameters: { surface: "composer", router: true },
  args: { model: "claude-opus-5-5" },
} satisfies Meta<typeof ModelPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Provider tabs (Pinned, then one per provider), search, and the open provider's models in
    family order. The selected row carries its effort and the check; hovering another row shows
    the effort a pick would set and its pin. Legacy models wait behind the last row. */
export const Menu: Story = {};

/** The selected row's effort, clicked: the levels under an "Effort" header, then the toggles as
    checkbox rows. A toggle that is on leads the row's effort with its icon. */
export const EffortMenu: Story = {
  args: { options: [{ id: "fastMode", value: true }] },
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: /^Effort: High/ }));
  },
};

/** A query searches every provider: one flat list, each row led by its provider's mark. */
export const Search: Story = {
  play: async () => {
    await userEvent.type(await screen.findByRole("textbox", { name: "Search models" }), "5.5");
  },
};
