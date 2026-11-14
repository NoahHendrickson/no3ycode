import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { RegistryContext } from "@effect/atom-react";
import { AtomRegistry } from "effect/reactivity";
import { describe, expect, it, vi } from "vite-plus/test";

import "~/index.css";

import { ProviderModelPicker } from "~/components/chat/ProviderModelPicker";
import { deriveProviderInstanceEntries } from "~/providerInstances";
import { render } from "../../test/render";
import { setActiveForkPalette } from "./forkActivePalette";

vi.mock(import("~/hooks/useSettings"), async (original) => ({
  ...(await original()),
  useEnvironmentModelPreferences: () => ({ favorites: [], providerModelPreferences: {} }),
}));

const provider: ServerProvider = {
  instanceId: ProviderInstanceId.make("codex"),
  driver: ProviderDriverKind.make("codex"),
  enabled: true,
  installed: true,
  version: null,
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: "2026-08-28T00:00:00.000Z",
  models: [],
  slashCommands: [],
  skills: [],
};
const entry = deriveProviderInstanceEntries([provider])[0]!;
const registry = AtomRegistry.make();

function picker(props: { open: boolean; model: string; effort: string }) {
  return (
    <RegistryContext.Provider value={registry}>
      <ProviderModelPicker
        environmentId={null}
        activeInstanceId={entry.instanceId}
        model={props.model}
        lockedProvider={null}
        instanceEntries={[entry]}
        modelOptionsByInstance={
          new Map([
            [
              entry.instanceId,
              [
                { slug: "alpha", name: "Alpha" },
                { slug: "beta", name: "Beta" },
              ],
            ],
          ])
        }
        onInstanceModelChange={() => {}}
        open={props.open}
        isComposerOwned
        combined
        traits={{ label: props.effort, panel: null }}
      />
    </RegistryContext.Provider>
  );
}

describe("ProviderModelPicker Inlet label hold", () => {
  it("holds effort while the menu is open but shows a new model at once", async () => {
    setActiveForkPalette("inlet");
    using _palette = { [Symbol.dispose]: () => setActiveForkPalette(null) };
    await using screen = await render(picker({ open: false, model: "alpha", effort: "High" }));
    const label = () =>
      screen.container.querySelector<HTMLElement>("[data-chat-provider-model-picker-label]");
    const traits = () =>
      screen.container.querySelector<HTMLElement>("[data-chat-provider-model-picker-traits]");

    await screen.rerender(picker({ open: true, model: "alpha", effort: "High" }));
    await screen.rerender(picker({ open: true, model: "alpha", effort: "Low" }));
    await expect.element(traits()).toHaveTextContent("High");

    await screen.rerender(picker({ open: true, model: "beta", effort: "Medium" }));
    await expect.element(label()).toHaveTextContent("Beta");
    await expect.element(traits()).toHaveTextContent("Medium");

    await screen.rerender(picker({ open: false, model: "beta", effort: "Low" }));
    await expect.element(traits()).toHaveTextContent("Low");
  });
});
