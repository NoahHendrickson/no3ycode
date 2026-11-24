import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ProviderOptionSelections,
  type ServerProviderModel,
} from "@t3tools/contracts";
import { useState } from "react";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import "~/index.css";

import { render } from "../../test/render";
import { useComposerDraftStore } from "../composerDraftStore";
import { deriveProviderInstanceEntries } from "../providerInstances";
import { ComposerModelPicker } from "./ComposerModelPicker";

it("picks effort from the selected row's hover menu and fast mode from a checkbox", async () => {
  const instanceId = ProviderInstanceId.make("codex");
  const provider = ProviderDriverKind.make("codex");
  const models: ServerProviderModel[] = ["Sol", "Astra", "Luna"].map((name) => ({
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
          // A controlled editor (scheduled tasks) gives a picked model its defaults.
          setOptions(undefined);
        }}
        traitsInput={{
          provider,
          instanceId,
          model,
          models,
          modelOptions: options,
          promptUltrathink: "none",
          // The thread runs Luna at Extra High; nothing is remembered for Luna.
          threadModelSelection: {
            instanceId,
            model: "luna",
            options: [{ id: "reasoningEffort", value: "xhigh" }],
          },
          onPromptEdit: () => {},
          onModelOptionsChange: (next) => {
            writes.push(next);
            setOptions(next);
          },
        }}
      />
    );
  }

  // The composer last used Sol at Low. This picker is a controlled editor, whose picks get the
  // model's defaults, so its preview must not show that.
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
  const effort = page.getByRole("button", { name: "Effort: High" });
  await expect.element(effort).toBeVisible();
  expect(document.querySelectorAll('[aria-label^="Effort:"]')).toHaveLength(1);
  // Another row previews the effort picking it would set.
  const sol = page.getByRole("menuitem", { name: /Sol/ });
  await vi.waitFor(() => expect(sol.element().textContent).toContain("High"));
  expect(sol.element().textContent).not.toContain("Low");
  // With nothing remembered, the thread's own model previews the thread's options, as a pick
  // restores them.
  const luna = page.getByRole("menuitem", { name: /Luna/ });
  await vi.waitFor(() => expect(luna.element().textContent).toContain("Extra High"));

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
  const isOpen = () => effort.element().hasAttribute("data-open");
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
  const picked = page.getByRole("button", { name: "Effort: Extra High" });
  await expect.element(picked).toBeVisible();
  // Clicking the level already checked closes the menu too.
  await picked.click();
  await page.getByRole("menuitemradio", { name: /Extra High/ }).click();
  await expect.element(page.getByRole("group", { name: "Effort" })).not.toBeInTheDocument();
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
    .element(page.getByRole("button", { name: "Effort: Extra High, Fast mode on" }))
    .toBeInTheDocument();

  // A click on another row's effort picks that model and opens its effort menu.
  await page.getByRole("button", { name: "Effort: Extra High, Fast mode on" }).click();
  await expect.element(page.getByRole("group", { name: "Effort" })).not.toBeInTheDocument();
  await page.getByRole("menuitem", { name: /Sol/ }).getByText("High").click();
  await expect.element(page.getByRole("button", { name: "Effort: High" })).toBeInTheDocument();
  await expect.element(page.getByRole("group", { name: "Effort" })).toBeVisible();

  // The selected row stays lit while its effort menu is open and the pointer is inside it.
  const solRow = page.getByRole("menuitem", { name: /Sol/ });
  await page
    .getByRole("menuitemradio", { name: /Medium|High/ })
    .first()
    .hover();
  const background = (row: Element) => getComputedStyle(row).backgroundColor;
  const astraRow = page.getByRole("menuitem", { name: /Astra/ }).element();
  expect(background(solRow.element())).not.toBe(background(astraRow));

  // ArrowRight on the focused selected row opens its effort menu, as a submenu trigger would.
  await page.getByRole("button", { name: "Effort: High" }).click();
  await expect.element(page.getByRole("group", { name: "Effort" })).not.toBeInTheDocument();
  (solRow.element() as HTMLElement).focus();
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(page.getByRole("group", { name: "Effort" })).toBeVisible();

  // Closed with its effort menu open (the effort menu closes with its parent, which clears its
  // state), the picker reopens with that menu shut.
  await userEvent.click(document.body, { position: { x: 1, y: 1 } });
  await expect.element(page.getByRole("button", { name: "Effort: High" })).not.toBeInTheDocument();
  await expect.element(page.getByRole("group", { name: "Effort" })).not.toBeInTheDocument();
  await screen.getByRole("button", { name: /Sol/ }).click();
  await expect.element(page.getByRole("button", { name: "Effort: High" })).toBeVisible();
  await expect.element(page.getByRole("group", { name: "Effort" })).not.toBeInTheDocument();
});
