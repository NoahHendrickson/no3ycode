import { ProviderDriverKind, type ProviderOptionDescriptor } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { DraftId } from "../composerDraftStore";

import {
  effortLevel,
  findEffortDescriptor,
  orderTraitRows,
  resolveComposerModelTraits,
  selectToggle,
  type ComposerModelTraitsInput,
  type SelectDescriptor,
} from "./composerModelTraits";

const claudeEffort: SelectDescriptor = {
  id: "effort",
  label: "Reasoning",
  type: "select",
  options: [
    { id: "low", label: "Low" },
    { id: "medium", label: "Medium" },
    { id: "high", label: "High", isDefault: true },
    { id: "max", label: "Max" },
    { id: "ultrathink", label: "Ultrathink" },
  ],
  promptInjectedValues: ["ultrathink"],
};

describe("controlled model traits", () => {
  const input: ComposerModelTraitsInput = {
    provider: ProviderDriverKind.make("claudeAgent"),
    model: "test-model",
    models: [
      {
        slug: "test-model",
        name: "Test model",
        isCustom: true,
        capabilities: { optionDescriptors: [claudeEffort] },
      },
    ],
    modelOptions: [{ id: "effort", value: "max" }],
    promptUltrathink: "none",
    onPromptEdit: () => {},
  };

  it("offers the same effort levels and selected value for tasks as conversation drafts", () => {
    const controlled = resolveComposerModelTraits({ ...input, onModelOptionsChange: () => {} });
    const composer = resolveComposerModelTraits({ ...input, draftId: DraftId.make("draft") });
    expect(controlled).not.toBeNull();
    expect(controlled).toEqual(composer);
    expect(controlled?.effort?.level?.id).toBe("max");
  });

  it("splits the effort menu: the effort, other selects, then toggles in one order", () => {
    const traits = resolveComposerModelTraits({
      ...input,
      draftId: DraftId.make("draft"),
      modelOptions: [{ id: "serviceTier", value: "fast" }],
      models: [
        {
          ...input.models[0]!,
          capabilities: {
            optionDescriptors: [
              claudeEffort,
              { id: "fastMode", label: "Fast Mode", type: "boolean" },
              {
                id: "serviceTier",
                label: "Service Tier",
                type: "select",
                options: [
                  { id: "default", label: "Standard", isDefault: true },
                  { id: "fast", label: "Fast" },
                ],
              },
              {
                id: "contextWindow",
                label: "Context Window",
                type: "select",
                options: [
                  { id: "200k", label: "200k", isDefault: true },
                  { id: "1m", label: "1M" },
                ],
              },
              { id: "ultracode", label: "Ultracode", type: "boolean", currentValue: true },
            ],
          },
        },
      ],
    });
    expect(traits?.effort?.level?.id).toBe("high");
    expect(traits?.effort?.locked).toBe(false);
    expect(traits?.selects.map((d) => d.id)).toEqual(["contextWindow"]);
    expect(
      traits?.toggles.map((t) => [t.descriptor.id, t.label, t.checked, t.values?.on ?? null]),
    ).toEqual([
      ["serviceTier", "Fast mode", true, "fast"],
      ["ultracode", "Ultracode", true, null],
      ["fastMode", "Fast Mode", false, null],
    ]);
  });

  it("still hides editable traits without a draft or controlled destination", () => {
    expect(resolveComposerModelTraits(input)).toBeNull();
  });

  it("gives no row to a select whose one value is already in force", () => {
    const cyber: SelectDescriptor = {
      id: "cyberAccessProgram",
      label: "Cyber Access",
      type: "select",
      options: [{ id: "standard", label: "Standard", isDefault: true }],
    };
    const withTraits = (optionDescriptors: ReadonlyArray<ProviderOptionDescriptor>) =>
      resolveComposerModelTraits({
        ...input,
        draftId: DraftId.make("draft"),
        modelOptions: [],
        models: [{ ...input.models[0]!, capabilities: { optionDescriptors } }],
      });
    const traits = withTraits([claudeEffort, cyber]);
    expect(traits?.selects).toEqual([]);
    expect(traits?.toggles).toEqual([]);
    expect(traits?.descriptors.map((d) => d.id)).toEqual(["effort", "cyberAccessProgram"]);
    expect(traits?.trigger.label).not.toContain("Standard");
    // Without a known default, picking the one value still changes the request.
    const { isDefault: _, ...standard } = cyber.options[0]!;
    expect(withTraits([claudeEffort, { ...cyber, options: [standard] }])?.selects).toHaveLength(1);
    // Nothing left to show: no panel at all.
    expect(withTraits([cyber])).toBeNull();
  });
});

describe("findEffortDescriptor", () => {
  it("finds each provider's effort option, skipping traits that come first", () => {
    const contextWindow: ProviderOptionDescriptor = {
      id: "contextWindow",
      label: "Context Window",
      type: "select",
      options: [
        { id: "200k", label: "200k" },
        { id: "1m", label: "1M" },
      ],
    };
    for (const id of [
      "effort",
      "reasoningEffort",
      "reasoning",
      "variant",
      "reasoning_effort",
      "thinking_level",
    ]) {
      const effort = { ...claudeEffort, id };
      expect(findEffortDescriptor([contextWindow, effort])).toBe(effort);
    }
  });

  it("matches an agent-marked reasoning select such as Antigravity thinking_level", () => {
    const antigravityThinking: SelectDescriptor = {
      id: "thought_level",
      label: "Thinking Level",
      type: "select",
      role: "reasoning",
      options: [
        { id: "minimal", label: "Minimal" },
        { id: "low", label: "Low" },
        { id: "medium", label: "Medium" },
        { id: "high", label: "High" },
      ],
      currentValue: "high",
    };
    expect(findEffortDescriptor([antigravityThinking])).toBe(antigravityThinking);
  });

  it("leaves a single-level effort to the segmented controls", () => {
    const fixed = { ...claudeEffort, options: [{ id: "high", label: "High" }] };
    expect(findEffortDescriptor([fixed])).toBeNull();
  });
});

describe("effortLevel", () => {
  it("lands on the stored level, else the default", () => {
    expect(effortLevel({ ...claudeEffort, currentValue: "max" }, false)?.id).toBe("max");
    expect(effortLevel(claudeEffort, false)?.id).toBe("high");
  });

  it("lands on Ultrathink while the prompt carries it, whatever is stored", () => {
    expect(effortLevel({ ...claudeEffort, currentValue: "low" }, true)?.id).toBe("ultrathink");
  });
});

describe("selectToggle", () => {
  const tier: SelectDescriptor = {
    id: "serviceTier",
    label: "Service Tier",
    type: "select",
    options: [
      { id: "default", label: "Standard", isDefault: true },
      { id: "fast", label: "Fast" },
    ],
    currentValue: "default",
  };

  it("reads a standard-or-other select as an on/off checkbox", () => {
    expect(selectToggle(tier)).toEqual({
      off: "default",
      on: "fast",
      checked: false,
      label: "Fast mode",
    });
    expect(selectToggle({ ...tier, currentValue: "fast" })?.checked).toBe(true);
    expect(
      selectToggle({
        id: "cyberAccessProgram",
        label: "Cyber Access",
        type: "select",
        options: [
          { id: "standard", label: "Standard", isDefault: true },
          { id: "daybreakBlue", label: "Daybreak Blue" },
        ],
        currentValue: "daybreakBlue",
      }),
    ).toMatchObject({ off: "standard", on: "daybreakBlue", checked: true, label: "Cyber mode" });
  });

  it("leaves selects without a standard value, or with more than two, as menus", () => {
    expect(
      selectToggle({ ...tier, options: [...tier.options, { id: "flex", label: "Flex" }] }),
    ).toBeNull();
    expect(
      selectToggle({
        id: "agent",
        label: "Agent",
        type: "select",
        options: [
          { id: "build", label: "Build", isDefault: true },
          { id: "plan", label: "Plan" },
        ],
      }),
    ).toBeNull();
  });
});

describe("orderTraitRows", () => {
  it("puts Fast Mode above Context Window at the bottom, whatever order the provider lists", () => {
    const fastMode: ProviderOptionDescriptor = {
      id: "fastMode",
      label: "Fast Mode",
      type: "boolean",
    };
    const thinking: ProviderOptionDescriptor = {
      id: "thinking",
      label: "Thinking",
      type: "boolean",
    };
    const contextWindow: ProviderOptionDescriptor = {
      id: "contextWindow",
      label: "Context Window",
      type: "select",
      options: [{ id: "1m", label: "1M" }],
    };
    // Claude lists Fast Mode before Context Window; Cursor lists them the other way round.
    const claude = [claudeEffort, fastMode, contextWindow];
    const cursor = [{ ...claudeEffort, id: "reasoning" }, contextWindow, thinking, fastMode];
    expect(orderTraitRows(claude, claudeEffort).map((d) => d.id)).toEqual([
      "fastMode",
      "contextWindow",
    ]);
    expect(orderTraitRows(cursor, null).map((d) => d.id)).toEqual([
      "reasoning",
      "thinking",
      "fastMode",
      "contextWindow",
    ]);
  });
});
