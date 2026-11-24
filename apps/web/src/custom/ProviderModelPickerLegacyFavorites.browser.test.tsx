/**
 * Fork replacement for the two legacy-favorite cases upstream's
 * ProviderModelPicker.browser.test.tsx skips behind `fork-model-picker`
 * (see `.fork/customizations.yaml#fork-model-picker`). The fork's picker is a
 * Base UI Menu with a rail of provider tabs, so these drive menu items instead of
 * upstream's provider buttons and listbox options.
 */
import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Atom, AtomRegistry } from "effect/reactivity";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import "~/index.css";

import { ProviderModelPicker } from "~/components/chat/ProviderModelPicker";
import { deriveProviderInstanceEntries } from "~/providerInstances";

const favoritesAtom = Atom.make<ReadonlyArray<{ provider: ProviderInstanceId; model: string }>>(
  [],
).pipe(Atom.keepAlive);

vi.mock(import("~/hooks/useSettings"), async (original) => ({
  ...(await original()),
  useEnvironmentModelPreferences: () => ({
    favorites: useAtomValue(favoritesAtom),
    providerModelPreferences: {},
  }),
  useToggleEnvironmentModelFavorite: () => {
    const setFavorites = useAtomSet(favoritesAtom);
    return async (provider: ProviderInstanceId, model: string) => {
      setFavorites((favorites) =>
        favorites.some((favorite) => favorite.provider === provider && favorite.model === model)
          ? favorites.filter(
              (favorite) => favorite.provider !== provider || favorite.model !== model,
            )
          : [...favorites, { provider, model }],
      );
    };
  },
}));

vi.mock(import("@tanstack/react-router"), async (original) => ({
  ...(await original()),
  useNavigate: () => vi.fn(),
}));

let pickerRoot: Root | undefined;
let pickerRegistry: AtomRegistry.AtomRegistry | undefined;

function providerEntry(instanceId: string, driver: string) {
  const provider: ServerProvider = {
    instanceId: ProviderInstanceId.make(instanceId),
    driver: ProviderDriverKind.make(driver),
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
  return deriveProviderInstanceEntries([provider])[0]!;
}

afterEach(async () => {
  if (pickerRoot) await act(async () => pickerRoot!.unmount());
  pickerRoot = undefined;
  pickerRegistry?.dispose();
  pickerRegistry = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

async function click(target: Parameters<typeof userEvent.click>[0]) {
  await act(async () => userEvent.click(target));
}

const menuItem = (name: RegExp) => page.getByRole("menuitem", { name });
const providerTab = (name: RegExp) => page.getByRole("menuitemradio", { name });

// With favorites set, the menu opens scoped to Favorites; the provider's tab
// in the rail swaps the list to its models.
async function openProviderPage(activeModel: string) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const entry = providerEntry("codex", "codex");
  pickerRegistry = AtomRegistry.make();
  pickerRegistry.set(favoritesAtom, [
    { provider: entry.instanceId, model: "current-favorite" },
    { provider: entry.instanceId, model: "legacy-favorite" },
  ]);
  pickerRoot = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () =>
    pickerRoot!.render(
      <RegistryContext.Provider value={pickerRegistry!}>
        <ProviderModelPicker
          environmentId={null}
          activeInstanceId={entry.instanceId}
          model={activeModel}
          lockedProvider={null}
          instanceEntries={[entry]}
          modelOptionsByInstance={
            new Map([
              [
                entry.instanceId,
                [
                  { slug: "current", name: "Current model" },
                  { slug: "legacy-favorite", name: "Legacy favorite", isLegacy: true },
                  { slug: "current-favorite", name: "Current favorite" },
                  { slug: "other-legacy", name: "Other legacy", isLegacy: true },
                ],
              ],
            ])
          }
          onInstanceModelChange={() => {}}
        />
      </RegistryContext.Provider>,
    ),
  );
  await click(document.querySelector("button")!);
  await click(providerTab(new RegExp(`^${entry.displayName}`)));
}

describe("ProviderModelPicker legacy favorites (fork menu)", () => {
  it("lists pinned models in provider order and never moves a row on pin", async () => {
    await openProviderPage("current");
    const legacyFavorite = menuItem(/Legacy favorite/);
    const currentFavorite = menuItem(/Current favorite/);
    const current = menuItem(/Current model/);
    const legacyModels = menuItem(/Legacy models/);
    const top = (row: typeof current) => row.element().getBoundingClientRect().top;

    // A pinned legacy model joins the current ones, all in the provider's order.
    await expect.element(legacyFavorite).toBeVisible();
    await expect.element(currentFavorite).toBeVisible();
    await expect.element(current).toBeVisible();
    await expect.element(menuItem(/Other legacy/)).not.toBeInTheDocument();
    expect(top(current)).toBeLessThan(top(legacyFavorite));
    expect(top(legacyFavorite)).toBeLessThan(top(currentFavorite));

    // Unpinning or pinning flips the pin but leaves every row where it was.
    const before = [current, legacyFavorite, currentFavorite].map(top);
    await click(legacyFavorite.getByRole("button", { name: "Unpin" }));
    await expect
      .element(legacyFavorite.getByRole("button", { name: "Pin", exact: true }))
      .toBeInTheDocument();
    await click(current.getByRole("button", { name: "Pin", exact: true }));
    await expect.element(current.getByRole("button", { name: "Unpin" })).toBeInTheDocument();
    expect([current, legacyFavorite, currentFavorite].map(top)).toEqual(before);

    // The next open places the unpinned legacy model back under its toggle.
    await userEvent.keyboard("{Escape}");
    await click(document.querySelector("button")!);
    await click(providerTab(/^Codex/));
    await expect.element(current).toBeVisible();
    await expect.element(legacyFavorite).not.toBeInTheDocument();
    await click(legacyModels);
    await expect.element(legacyFavorite).toBeVisible();
    expect(top(legacyFavorite)).toBeGreaterThan(top(legacyModels));
  });

  it("adds a pin to the Pinned tab at once and drops an unpinned model from it", async () => {
    await openProviderPage("current");
    const current = menuItem(/Current model/);
    await click(current.getByRole("button", { name: "Pin", exact: true }));
    await expect.element(current.getByRole("button", { name: "Unpin" })).toBeInTheDocument();

    await click(providerTab(/^Pinned/));
    await expect.element(current).toBeVisible();
    await expect.element(menuItem(/Current favorite/)).toBeVisible();

    await click(current.getByRole("button", { name: "Unpin" }));
    await expect.element(current).not.toBeInTheDocument();
    await expect.element(menuItem(/Current favorite/)).toBeVisible();
  });

  it("keeps unrelated legacy models collapsed when the active model is a favorite", async () => {
    await openProviderPage("legacy-favorite");

    await expect.element(menuItem(/Legacy favorite/)).toBeVisible();
    await expect.element(menuItem(/Other legacy/)).not.toBeInTheDocument();
    await click(menuItem(/Legacy models/));
    await expect.element(menuItem(/Other legacy/)).toBeVisible();
  });
});
