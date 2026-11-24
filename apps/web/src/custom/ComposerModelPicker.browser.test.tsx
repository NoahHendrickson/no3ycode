import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ProviderOptionSelections,
  type ServerProviderModel,
} from "@t3tools/contracts";
import { useState } from "react";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import "~/index.css";

import { render } from "../../test/render";
import { useComposerDraftStore } from "../composerDraftStore";
import { deriveProviderInstanceEntries } from "../providerInstances";
import { ComposerModelPicker } from "./ComposerModelPicker";

it("picks effort from the selected row's hover menu and fast mode from a checkbox", async () => {
  const instanceId = ProviderInstanceId.make("codex");
  const provider = ProviderDriverKind.make("codex");
  const models: ServerProviderModel[] = ["Sol", "Astra"].map((name) => ({
    slug: name.toLowerCase(),
    name,
    isCustom: false,
    capabilities: {
      optionDescriptors: [
        {
          id: "reasoningEffort",
          label: "Reasoning",
          type: "select",
          options: [
            { id: "low", label: "Low" },
            { id: "high", label: "High", isDefault: true },
            { id: "xhigh", label: "Extra High" },
          ],
          currentValue: "high",
        },
        {
          id: "serviceTier",
          label: "Service Tier",
          type: "select",
          options: [
            { id: "default", label: "Standard", isDefault: true },
            { id: "fast", label: "Fast" },
          ],
          currentValue: "default",
        },
      ],
    },
  }));
  const entries = deriveProviderInstanceEntries([
    {
      instanceId,
      driver: provider,
      enabled: true,
      installed: true,
      version: null,
      status: "ready",
      auth: { status: "authenticated" },
      checkedAt: "2026-01-01T00:00:00.000Z",
      models,
      slashCommands: [],
      skills: [],
    },
  ]);
  const writes: Array<ProviderOptionSelections | undefined> = [];

  function Picker() {
    const [model, setModel] = useState("astra");
    const [options, setOptions] = useState<ProviderOptionSelections | undefined>();
    return (
      <ComposerModelPicker
        environmentId={null}
        activeInstanceId={instanceId}
        model={model}
        lockedProvider={null}
        instanceEntries={entries}
        modelOptionsByInstance={new Map([[instanceId, models]])}
        onInstanceModelChange={(_instanceId, next) => {
          setModel(next);
          // A pick restores the options last used with that model, as the composer does.
          setOptions(next === "sol" ? [{ id: "reasoningEffort", value: "low" }] : undefined);
        }}
        traitsInput={{
          provider,
          instanceId,
          model,
          models,
          modelOptions: options,
          promptUltrathink: "none",
          onPromptEdit: () => {},
          onModelOptionsChange: (next) => {
            writes.push(next);
            setOptions(next);
          },
        }}
      />
    );
  }

  // Sol was last used at Low, which a pick restores.
  const remembered = useComposerDraftStore.getState().stickyOptionsByModelByProvider;
  useComposerDraftStore.setState({
    stickyOptionsByModelByProvider: {
      [instanceId]: { sol: [{ id: "reasoningEffort", value: "low" }] },
    },
  });
  using _remembered = {
    [Symbol.dispose]: () =>
      useComposerDraftStore.setState({ stickyOptionsByModelByProvider: remembered }),
  };
  await using screen = await render(<Picker />);
  await screen.getByRole("button", { name: /Astra/ }).click();

  // Only the selected model's row carries its effort, and the model menu has no traits panel:
  // the toggles live in the effort menu, so the model menu's height never depends on the model.
  expect(document.body.textContent).not.toContain("Fast mode");
  const effort = page.getByRole("menuitem", { name: "Effort: High" });
  await expect.element(effort).toBeVisible();
  expect(document.querySelectorAll('[aria-label^="Effort:"]')).toHaveLength(1);
  // Another row previews the effort picking it would set.
  const sol = page.getByRole("menuitem", { name: /Sol/ });
  await vi.waitFor(() => expect(sol.element().textContent).toContain("Low"));

  // Hovering the value never opens its menu; a click does, and stays open. A real press opens it
  // on mousedown before its click arrives; that click must not close it again.
  await effort.hover();
  await expect.element(page.getByRole("group", { name: "Effort" })).not.toBeInTheDocument();
  const mouse = (target: Element, type: string) =>
    target.dispatchEvent(
      new (type.startsWith("pointer") ? PointerEvent : MouseEvent)(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...(type.startsWith("pointer") ? { pointerType: "mouse", isPrimary: true } : {}),
      }),
    );
  const isOpen = () => effort.element().hasAttribute("data-popup-open");
  const press = async (click: boolean) => {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
      mouse(effort.element(), type);
    }
    // A real click arrives after the press has settled.
    await expect.element(effort).toBeVisible();
    await expect.element(effort).toBeVisible();
    if (click) mouse(effort.element(), "click");
  };
  await press(true);
  await vi.waitFor(() => expect(isOpen()).toBe(true));
  await press(true);
  await vi.waitFor(() => expect(isOpen()).toBe(false));
  await effort.click();
  // A header names the menu above its levels, as in the permissions menu.
  await expect.element(page.getByRole("group", { name: "Effort" })).toBeVisible();
  await page.getByRole("menuitemradio", { name: /Extra High/ }).click();
  await vi.waitFor(() =>
    expect(writes.at(-1)).toContainEqual({ id: "reasoningEffort", value: "xhigh" }),
  );
  // The model menu stays open, now showing the new level.
  const picked = page.getByRole("menuitem", { name: "Effort: Extra High" });
  await expect.element(picked).toBeVisible();
  // Every click on the value toggles its levels, and moving across it, or away, leaves them as
  // they are.
  for (let pass = 0; pass < 3; pass += 1) {
    await picked.click({ position: { x: 4, y: 12 } });
    await expect.element(page.getByRole("menuitemradio", { name: /Low/ })).toBeVisible();
    await picked.hover({ position: { x: 30, y: 12 } });
    await picked.unhover();
    await expect.element(page.getByRole("menuitemradio", { name: /Low/ })).toBeVisible();
    await picked.click({ position: { x: 4, y: 12 } });
    await expect.element(page.getByRole("menuitemradio", { name: /Low/ })).not.toBeInTheDocument();
  }

  // Fast mode is a checkbox row under the levels; it keeps the menu open, and the row's value then
  // carries its mark.
  await picked.click();
  await page.getByRole("menuitemcheckbox", { name: "Fast mode" }).click();
  await vi.waitFor(() =>
    expect(writes.at(-1)).toContainEqual({ id: "serviceTier", value: "fast" }),
  );
  await expect
    .element(page.getByRole("menuitemcheckbox", { name: "Fast mode" }))
    .toHaveAttribute("aria-checked", "true");
  await expect
    .element(page.getByRole("menuitem", { name: "Effort: Extra High, Fast mode on" }))
    .toBeInTheDocument();

  // A click on another row's effort picks that model and opens its effort menu.
  await page.getByRole("menuitem", { name: "Effort: Extra High, Fast mode on" }).click();
  await expect.element(page.getByRole("group", { name: "Effort" })).not.toBeInTheDocument();
  await page.getByRole("menuitem", { name: /Sol/ }).getByText("Low").click();
  await expect.element(page.getByRole("menuitem", { name: "Effort: Low" })).toBeInTheDocument();
  await expect.element(page.getByRole("group", { name: "Effort" })).toBeVisible();
});
