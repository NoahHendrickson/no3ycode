/**
 * Fork shadow of upstream's ModelPickerContent — see
 * `.fork/customizations.yaml#fork-model-picker`.
 *
 * Same export, same props as upstream, so ProviderModelPicker's import is
 * untouched; the four helpers are upstream's verbatim. The render
 * is the fork's, hosted by ProviderModelPicker's shadow in a Base UI Menu: a
 * vertical rail of provider icon tabs (Favorites, then one per provider
 * instance) beside the search field and the chosen scope's models, legacy
 * ones behind an inline toggle. It opens on Favorites when there are favorites, else on the current
 * model's provider. Typing anywhere lands in the search field, and a query
 * swaps the list for one flat, provider-agnostic list of matching models.
 * Picking a model never closes the menu from here; the host decides, since it
 * may render more below the list. Upstream's multi-model draft (Shift-click
 * or Shift+Enter toggles a model into `selectedModels`) works the same way,
 * and its provider-cycling shortcuts step the provider tabs.
 */
import { T, useGT, useLocale, useMessages } from "gt-react";
import {
  ANTIGRAVITY_DEFAULT_MODEL,
  type ProviderInstanceId,
  type EnvironmentId,
  type ProviderDriverKind,
  type ResolvedKeybindingsConfig,
} from "@t3tools/contracts";
import { resolveSelectableModel } from "@t3tools/shared/model";
import { useAtomValue } from "@effect/atom-react";
import {
  formatProviderUpdateRequiredNotice,
  providerUpdateChannelLags,
} from "@t3tools/client-runtime/providerUpdateRequiredModels";
import { groupModelsBySubProvider } from "@t3tools/client-runtime/providerSubProviders";
import { useNavigate } from "@tanstack/react-router";
import { Fragment, memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { CheckIcon, ChevronDownIcon, HeartIcon, SearchIcon, StarIcon } from "lucide-react";
import { getProviderStatusMessage, hasProviderSetup } from "./ProviderStatusBanner";
import { useProviderWorkspaceSnapshotRefresh } from "./useProviderWorkspaceSnapshotRefresh";
import { rankModelPickerSearch } from "@t3tools/client-runtime/model-search";
import { getDisplayModelName, ModelEsque } from "./providerIconUtils";
import { Button } from "../ui/button";
import { MenuItem } from "../ui/menu";
import { Badge } from "../ui/badge";
import { Kbd } from "../ui/kbd";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { isCommandPaletteOpen } from "../../commandPaletteBus";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { registerModelPickerContent } from "../../modelPickerVisibility";
import { primaryServerKeybindingsAtom } from "../../state/server";
import {
  modelPickerJumpCommandForIndex,
  modelPickerJumpIndexFromCommand,
  resolveShortcutCommand,
  shortcutLabelForCommand,
} from "../../keybindings";
import {
  useEnvironmentModelPreferences,
  useToggleEnvironmentModelFavorite,
} from "~/hooks/useSettings";
import { announce } from "~/lib/announce";
import { cn } from "~/lib/utils";
import { stripProviderName } from "~/custom/modelPickerDisplayName";
import { ModelPickerProviderGlyph } from "~/custom/icons/ModelPickerProviderGlyph";
import { MenuIconTab, MenuTabs } from "~/custom/Tabs";
import {
  isProviderInstancePickerReady,
  isProviderInstancePickerVisible,
  shouldShowInstanceBadge,
  type ProviderInstanceEntry,
} from "../../providerInstances";
import { providerModelKey, sortProviderModelItems } from "../../modelOrdering";
import { hasRuntimeModelCatalog } from "../../providerModels";
import { modelPickerSubProviderSectionKey } from "./modelPickerKeys";

type ModelPickerItem = {
  slug: string;
  name: string;
  shortName?: string;
  subProvider?: string;
  instanceId: ProviderInstanceId;
  driverKind: ProviderDriverKind;
  instanceDisplayName: string;
  instanceAccentColor?: string | undefined;
  acpRegistryAgentId?: string | undefined;
  acpRegistryIconUrl?: string | undefined;
  continuationGroupKey?: string | undefined;
  isLegacy?: boolean | undefined;
  isUnavailable?: boolean | undefined;
};

export function resolveModelPickerSelectedModel(input: {
  driverKind: ProviderDriverKind | undefined;
  model: string;
  options: ReadonlyArray<ModelEsque>;
}) {
  if (input.driverKind === "antigravity" && input.model === ANTIGRAVITY_DEFAULT_MODEL) {
    const availableModels = input.options.filter(
      (option) => option.slug !== ANTIGRAVITY_DEFAULT_MODEL && !option.isUnavailable,
    );
    return (
      availableModels.find((option) => option.aliases?.includes(ANTIGRAVITY_DEFAULT_MODEL)) ??
      availableModels.find((option) => option.isDefault)
    );
  }
  return input.options.find((option) => option.slug === input.model);
}

function shouldIncludeModelPickerOption(input: {
  readonly entry: ProviderInstanceEntry;
  readonly option: ModelEsque;
  readonly activeInstanceId: ProviderInstanceId;
  readonly activeModel: string;
}): boolean {
  if (input.entry.driverKind === "antigravity" && input.option.slug === ANTIGRAVITY_DEFAULT_MODEL) {
    return false;
  }
  if (isProviderInstancePickerReady(input.entry)) return true;
  return (
    input.entry.enabled &&
    hasRuntimeModelCatalog(input.entry.driverKind) &&
    input.entry.instanceId === input.activeInstanceId &&
    input.option.slug === input.activeModel &&
    input.option.isUnavailable === true
  );
}

function shouldOfferModelPickerSetup(
  entry: ProviderInstanceEntry,
  options: ReadonlyArray<ModelEsque>,
): boolean {
  return (
    entry.enabled &&
    entry.status !== "disabled" &&
    hasProviderSetup(entry.snapshot) &&
    (!isProviderInstancePickerReady(entry) ||
      !entry.installed ||
      entry.snapshot.auth.status === "unauthenticated" ||
      !options.some((option) => !option.isUnavailable))
  );
}

function adjacentModelPickerProvider(input: {
  entries: ReadonlyArray<ProviderInstanceEntry>;
  selectedInstanceId: ProviderInstanceId | "favorites";
  direction: 1 | -1;
  disabledInstanceIds: ReadonlySet<ProviderInstanceId> | undefined;
  selectableUnavailableInstanceIds: ReadonlySet<ProviderInstanceId> | undefined;
}) {
  const providers: Array<ProviderInstanceId | "favorites"> = [
    "favorites",
    ...input.entries
      .filter(
        (entry) =>
          !input.disabledInstanceIds?.has(entry.instanceId) &&
          (isProviderInstancePickerReady(entry) ||
            input.selectableUnavailableInstanceIds?.has(entry.instanceId)),
      )
      .map((entry) => entry.instanceId),
  ];
  const index = providers.indexOf(input.selectedInstanceId);
  return providers[
    index < 0
      ? input.direction === 1
        ? 0
        : providers.length - 1
      : (index + input.direction + providers.length) % providers.length
  ]!;
}

/**
 * Build the hover tooltip for a provider row that cannot be opened, using
 * the entry's configured `displayName` so custom instances read as authored.
 */
function describeUnavailableInstance(entry: ProviderInstanceEntry): string {
  const label = entry.displayName;
  if (!entry.enabled || entry.status === "disabled") {
    return `${label} — Disabled in settings.`;
  }
  if (entry.status === "ready" && entry.isAvailable) {
    return label;
  }
  const kind =
    entry.status === "error" ? "Unavailable" : entry.status === "warning" ? "Limited" : "Not ready";
  const msg = entry.snapshot.message?.trim();
  return msg ? `${label} — ${kind}. ${msg}` : `${label} — ${kind}.`;
}

/** Keys the search field must see itself rather than the menu's navigation. */
/** A key press as both React and the popup's native listener see it. */
type TypedKeyEvent = Pick<
  globalThis.KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "target" | "preventDefault" | "stopPropagation"
>;

function isTypedCharacter(event: TypedKeyEvent): boolean {
  return event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
}

const EMPTY_MODEL_JUMP_LABELS = new Map<string, string>();

/** Every row shares one shape: 32px, 4px corners, 12px medium label (MenuItem size="xs"). */
const ROW_CLASS = "h-8 min-h-8 sm:min-h-8";

/** Whose models the list shows when no query is typed: the selected tab. */
type ModelPickerScope = ProviderInstanceId | "favorites";

const TOOLTIP_CLASS = "max-w-64";
/** The tooltips' explanations: balanced lines at regular weight. */
const TOOLTIP_TEXT_CLASS = "block text-balance font-normal";

export const ModelPickerContent = memo(function ModelPickerContent(props: {
  environmentId: EnvironmentId | null;
  /** Keeps the open provider tab's catalog fresh for this directory. */
  workspaceCwd?: string | null;
  activeInstanceId: ProviderInstanceId;
  model: string;
  selectedModels?: ReadonlyArray<{ instanceId: ProviderInstanceId; model: string }>;
  onToggleModel?: (instanceId: ProviderInstanceId, model: string) => void;
  lockedProvider: ProviderDriverKind | null;
  lockedContinuationGroupKey?: string | null;
  instanceEntries: ReadonlyArray<ProviderInstanceEntry>;
  keybindings?: ResolvedKeybindingsConfig;
  modelOptionsByInstance: ReadonlyMap<ProviderInstanceId, ReadonlyArray<ModelEsque>>;
  terminalOpen: boolean;
  onRequestClose?: () => void;
  onOpenProviderSetup?: (instanceId: ProviderInstanceId) => void;
  getModelDisabledReason?: (instanceId: ProviderInstanceId, model: string) => string | null;
  onInstanceModelChange: (instanceId: ProviderInstanceId, model: string) => void;
  /** The search field; a Menu has no `initialFocus`, so this content focuses it itself. */
  searchInputRef: RefObject<HTMLInputElement | null>;
}) {
  const gt = useGT();
  const messages = useMessages();
  const locale = useLocale();
  const {
    searchInputRef,
    keybindings: providedKeybindings,
    modelOptionsByInstance,
    instanceEntries,
    getModelDisabledReason,
    onInstanceModelChange,
    onToggleModel,
  } = props;
  const [searchQuery, setSearchQuery] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- publishes this picker's mount to global keydown handlers
  useLayoutEffect(() => registerModelPickerContent(), []);
  const { favorites } = useEnvironmentModelPreferences(props.environmentId);
  const serverKeybindings = useAtomValue(primaryServerKeybindingsAtom);
  const keybindings = providedKeybindings ?? serverKeybindings;
  const toggleFavorite = useToggleEnvironmentModelFavorite(props.environmentId);
  const navigate = useNavigate();

  const activeEntry = instanceEntries.find((entry) => entry.instanceId === props.activeInstanceId);
  const activeModel = resolveModelPickerSelectedModel({
    driverKind: activeEntry?.driverKind,
    model: props.model,
    options: modelOptionsByInstance.get(props.activeInstanceId) ?? [],
  });
  const activeModelSlug =
    activeModel?.slug ?? (props.model === ANTIGRAVITY_DEFAULT_MODEL ? "" : props.model);
  // A multi-model draft checks every selected row; otherwise just the active one.
  const activeModelKey = activeModelSlug
    ? providerModelKey(props.activeInstanceId, activeModelSlug)
    : null;
  const selectedModelKeys = props.selectedModels?.map((selection) => {
    const entry = instanceEntries.find((entry) => entry.instanceId === selection.instanceId);
    const model = resolveModelPickerSelectedModel({
      driverKind: entry?.driverKind,
      model: selection.model,
      options: modelOptionsByInstance.get(selection.instanceId) ?? [],
    });
    return providerModelKey(selection.instanceId, model?.slug ?? selection.model);
  });
  const selectedModelKeySet = new Set(
    selectedModelKeys ?? (activeModelKey ? [activeModelKey] : []),
  );
  const activeInstanceHasSelectableUnavailableModel =
    activeEntry !== undefined &&
    (modelOptionsByInstance.get(props.activeInstanceId) ?? []).some((option) =>
      shouldIncludeModelPickerOption({
        entry: activeEntry,
        option,
        activeInstanceId: props.activeInstanceId,
        activeModel: activeModelSlug,
      }),
    ) &&
    !isProviderInstancePickerReady(activeEntry);

  const coarsePointer = useMediaQuery({ pointer: "coarse" });
  const focusSearchInput = () => {
    searchInputRef.current?.focus({ preventScroll: true });
  };

  // The menu focuses its own popup as it opens; land on the search field
  // after it does, so typing searches straight away.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- moves DOM focus to the search field after the menu focuses its popup on open
  useLayoutEffect(() => {
    // Touch opens on the popup itself so the on-screen keyboard stays down until the search
    // is tapped.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    focusSearchInput();
    const frame = window.requestAnimationFrame(focusSearchInput);
    const timeout = window.setTimeout(focusSearchInput, 0);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [focusSearchInput]);

  // Favorites are keyed by `${instanceId}:${slug}`; pre-migration favorites
  // keyed by driver slugs still resolve — the default instance id equals it.
  const favoritesSet = new Set(favorites.map((fav) => providerModelKey(fav.provider, fav.model)));
  const entryByInstanceId = new Map(instanceEntries.map((entry) => [entry.instanceId, entry]));
  const instanceOrder = instanceEntries.map((entry) => entry.instanceId);
  const matchesLockedProvider = (
    entry: Pick<ProviderInstanceEntry, "driverKind" | "continuationGroupKey">,
  ): boolean => {
    if (props.lockedProvider === null) return true;
    if (entry.driverKind !== props.lockedProvider) return false;
    if (!props.lockedContinuationGroupKey) return true;
    return entry.continuationGroupKey === props.lockedContinuationGroupKey;
  };

  // One pass over the instance-keyed map; each model carries its instance id
  // and driver kind so a row renders its glyph without another lookup.
  const flatModels = (() => {
    const out: ModelPickerItem[] = [];
    const seenKeys = new Set<string>();
    for (const [instanceId, models] of modelOptionsByInstance) {
      const entry = entryByInstanceId.get(instanceId);
      if (!entry) continue;
      for (const model of models) {
        const key = providerModelKey(instanceId, model.slug);
        if (
          seenKeys.has(key) ||
          !shouldIncludeModelPickerOption({
            entry,
            option: model,
            activeInstanceId: props.activeInstanceId,
            activeModel: activeModelSlug,
          })
        ) {
          continue;
        }
        seenKeys.add(key);
        out.push({
          slug: model.slug,
          name: model.name,
          ...(model.shortName ? { shortName: model.shortName } : {}),
          ...(model.subProvider ? { subProvider: model.subProvider } : {}),
          ...(model.isLegacy ? { isLegacy: true } : {}),
          ...(model.isUnavailable ? { isUnavailable: true } : {}),
          instanceId,
          driverKind: entry.driverKind,
          instanceDisplayName: entry.displayName,
          ...(entry.accentColor ? { instanceAccentColor: entry.accentColor } : {}),
          ...(entry.acpRegistryAgentId ? { acpRegistryAgentId: entry.acpRegistryAgentId } : {}),
          ...(entry.acpRegistryIconUrl ? { acpRegistryIconUrl: entry.acpRegistryIconUrl } : {}),
          ...(entry.continuationGroupKey
            ? { continuationGroupKey: entry.continuationGroupKey }
            : {}),
        });
      }
    }
    return out;
  })();

  const isSearching = searchQuery.trim().length > 0;

  // A query searches every provider's models (locked provider still
  // respected), ranked by match, favorites first on a tie.
  const searchResults = isSearching
    ? rankModelPickerSearch(
        flatModels.filter((model) => matchesLockedProvider(model)),
        searchQuery,
        (model) => ({
          name: model.name,
          ...(model.shortName ? { shortName: model.shortName } : {}),
          ...(model.subProvider ? { subProvider: model.subProvider } : {}),
          driverKind: model.driverKind,
          providerDisplayName: model.instanceDisplayName,
          isFavorite: favoritesSet.has(providerModelKey(model.instanceId, model.slug)),
        }),
      )
    : [];

  const favoriteModels = sortProviderModelItems(
    flatModels.filter(
      (model) =>
        matchesLockedProvider(model) &&
        favoritesSet.has(providerModelKey(model.instanceId, model.slug)),
    ),
    { favoriteModelKeys: favoritesSet, groupFavorites: false, instanceOrder },
  );

  // The menu remounts on every open and picks its scope once: Favorites when
  // one can be picked, else the current model's provider. Favorites that load
  // after the open join the rail rather than swapping the list.
  const [storedScope, setStoredScope] = useState<ModelPickerScope>(() =>
    favoriteModels.some((model) => !getModelDisabledReason?.(model.instanceId, model.slug))
      ? "favorites"
      : props.activeInstanceId,
  );
  const [showLegacy, setShowLegacy] = useState(false);
  // Favorites always has a tab, so it stays chosen even when empty. A stored
  // instance that has since been removed (a thread still on it) falls back to
  // Favorites if any, else the current model's provider, else the first listed.
  const scopeEntry = (() => {
    if (storedScope === "favorites") return "favorites";
    const stored = entryByInstanceId.get(storedScope);
    if (stored) return stored;
    if (favoriteModels.length > 0) return "favorites";
    return (
      entryByInstanceId.get(props.activeInstanceId) ??
      instanceEntries.find(isProviderInstancePickerVisible) ??
      instanceEntries[0] ??
      "favorites"
    );
  })();
  const scope = scopeEntry === "favorites" ? "favorites" : scopeEntry.instanceId;
  const { scanning: workspaceModelsScanning } = useProviderWorkspaceSnapshotRefresh({
    environmentId: props.environmentId,
    gitCwd: props.workspaceCwd ?? null,
    instanceId: scope === "favorites" ? undefined : scope,
  });

  const isLegacyModel = (model: ModelPickerItem) =>
    model.isLegacy === true && !favoritesSet.has(providerModelKey(model.instanceId, model.slug));
  const modelsForInstance = (instanceId: ProviderInstanceId) => {
    const models = sortProviderModelItems(
      flatModels.filter((model) => model.instanceId === instanceId),
      { favoriteModelKeys: favoritesSet, groupFavorites: true, instanceOrder: [] },
    );
    return {
      all: models,
      current: models.filter((model) => !isLegacyModel(model)),
      legacy: models.filter(isLegacyModel),
    };
  };

  // The thread's backend opens expanded, so its models show without a click.
  const [expandedSubProviderKeys, setExpandedSubProviderKeys] = useState(
    () =>
      new Set<string>(
        activeModel?.subProvider
          ? [modelPickerSubProviderSectionKey(props.activeInstanceId, activeModel.subProvider)]
          : [],
      ),
  );
  const toggleSubProviderSection = (key: string) => {
    setExpandedSubProviderKeys((expanded) => {
      const next = new Set(expanded);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };
  // A provider whose models run on several backends, such as fx, lists each
  // backend as a collapsible heading. Search and Favorites stay flat.
  const subProviderSectionsFor = (instanceId: ProviderInstanceId) => {
    const subProviders = entryByInstanceId.get(instanceId)?.snapshot.subProviders;
    if (!subProviders?.length) return null;
    const { ungrouped, groups } = groupModelsBySubProvider(
      modelsForInstance(instanceId).all,
      subProviders,
      (model) => model.subProvider,
    );
    const sections = groups.map(({ subProvider, models }) => {
      const key = modelPickerSubProviderSectionKey(instanceId, subProvider.name);
      return {
        key,
        name: subProvider.name,
        unavailableReason: subProvider.unavailableReason,
        models,
        isExpanded: expandedSubProviderKeys.has(key),
      };
    });
    return {
      ungrouped,
      sections,
      visible: [
        ...ungrouped,
        ...sections.flatMap((section) => (section.isExpanded ? section.models : [])),
      ],
    };
  };

  const providerEntries = (() => {
    const visible = instanceEntries.filter(isProviderInstancePickerVisible);
    if (props.lockedProvider === null) return visible;
    // Locked: the thread's own providers first, the rest listed but disabled.
    return [
      ...visible.filter((entry) => matchesLockedProvider(entry)),
      ...visible.filter((entry) => !matchesLockedProvider(entry)),
    ];
  })();

  // The providers the cycling shortcuts may land on: locked-out instances
  // never, unready ones only while they hold the selected model or can offer
  // setup — the same tabs the rail leaves enabled.
  const lockedDisabledInstanceIds = (() => {
    if (props.lockedProvider === null) return undefined;
    const disabled = new Set<ProviderInstanceId>();
    for (const entry of instanceEntries) {
      if (!matchesLockedProvider(entry)) disabled.add(entry.instanceId);
    }
    return disabled;
  })();
  const selectableUnavailableInstanceIds = (() => {
    const instanceIds = new Set<ProviderInstanceId>();
    if (activeInstanceHasSelectableUnavailableModel) {
      instanceIds.add(props.activeInstanceId);
    }
    if (props.onOpenProviderSetup) {
      for (const entry of instanceEntries) {
        if (
          shouldOfferModelPickerSetup(entry, modelOptionsByInstance.get(entry.instanceId) ?? [])
        ) {
          instanceIds.add(entry.instanceId);
        }
      }
    }
    return instanceIds.size > 0 ? instanceIds : undefined;
  })();

  const handleModelSelect = (
    modelSlug: string,
    instanceId: ProviderInstanceId,
    additive = false,
  ): string | null => {
    if (getModelDisabledReason?.(instanceId, modelSlug)) return null;
    const options = modelOptionsByInstance.get(instanceId);
    const entry = entryByInstanceId.get(instanceId);
    if (!options || !entry) return null;
    // `resolveSelectableModel` normalizes by driver kind; custom instances
    // share their driver's rules.
    const resolvedModel = resolveSelectableModel(entry.driverKind, modelSlug, options);
    if (!resolvedModel) return null;
    if (additive && onToggleModel) {
      onToggleModel(instanceId, resolvedModel);
    } else {
      onInstanceModelChange(instanceId, resolvedModel);
    }
    return resolvedModel;
  };

  // Swap first, focus later. Focusing the search field from the row's click
  // closes the menu: the row re-takes focus on click, and the field's focusout
  // is checked a microtask later against a row the swap already removed,
  // which the menu reads as focus leaving. A frame and a tick later, the swap
  // and that check have both run.
  // A query hides the scope behind the flat results, so choosing a scope
  // clears it.
  const selectScope = (next: ModelPickerScope, options?: { showLegacy?: boolean }) => {
    setSearchQuery("");
    setStoredScope(next);
    setShowLegacy(options?.showLegacy ?? false);
    // Focusing the search on touch raises the on-screen keyboard on every provider tap.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    window.requestAnimationFrame(focusSearchInput);
    window.setTimeout(focusSearchInput, 0);
  };

  // A pick from search results clears the query onto the model's own
  // provider, so the menu (if the host keeps it open) shows the check on the
  // new pick. Shift (`additive`) toggles the model into a multi-model draft
  // and keeps the query, so one search can collect several models, as
  // upstream's does.
  const chooseModel = (model: ModelPickerItem, additive = false) => {
    const selectedSlug = handleModelSelect(model.slug, model.instanceId, additive);
    if (isSearching && !additive) {
      selectScope(model.instanceId, { showLegacy: isLegacyModel(model) });
    }
    return selectedSlug;
  };

  // The cycling shortcuts step the provider tabs, Favorites included.
  const cycleProvider = (direction: 1 | -1) => {
    const next = adjacentModelPickerProvider({
      entries: providerEntries,
      selectedInstanceId: scope,
      direction,
      disabledInstanceIds: lockedDisabledInstanceIds,
      selectableUnavailableInstanceIds,
    });
    selectScope(next);
    announce(
      next === "favorites" ? gt("Favorites") : (entryByInstanceId.get(next)?.displayName ?? next),
      "model-picker",
    );
  };

  // ⌘1–9 jump through the list on screen: the search results while
  // searching, else the scope's models in the order they are listed.
  const jumpModels = (() => {
    if (isSearching) return searchResults;
    if (scope === "favorites") return favoriteModels;
    const subProviderSections = subProviderSectionsFor(scope);
    if (subProviderSections) return subProviderSections.visible;
    const { current, legacy } = modelsForInstance(scope);
    return showLegacy ? [...current, ...legacy] : current;
  })();
  const jumpTargets = (() => {
    const targets: ModelPickerItem[] = [];
    for (const model of jumpModels) {
      if (getModelDisabledReason?.(model.instanceId, model.slug)) continue;
      if (!modelPickerJumpCommandForIndex(targets.length)) break;
      targets.push(model);
    }
    return targets;
  })();
  const modelJumpShortcutContext = {
    terminalFocus: false,
    terminalOpen: props.terminalOpen,
    modelPickerOpen: true,
  } as const;
  const modelJumpLabelByKey = ((): ReadonlyMap<string, string> => {
    if (jumpTargets.length === 0) return EMPTY_MODEL_JUMP_LABELS;
    const options = { platform: navigator.platform, context: modelJumpShortcutContext };
    const mapping = new Map<string, string>();
    jumpTargets.forEach((model, index) => {
      const command = modelPickerJumpCommandForIndex(index);
      const label = command ? shortcutLabelForCommand(keybindings, command, options) : null;
      if (label) mapping.set(providerModelKey(model.instanceId, model.slug), label);
    });
    return mapping.size > 0 ? mapping : EMPTY_MODEL_JUMP_LABELS;
  })();

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- subscribes a capture-phase window keydown listener for the picker's lifetime
  useEffect(() => {
    const onWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      // Upstream: keys that compose IME text never trigger picker shortcuts.
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.keyCode === 229 ||
        isCommandPaletteOpen()
      )
        return;
      const command = resolveShortcutCommand(event, keybindings, {
        platform: navigator.platform,
        context: modelJumpShortcutContext,
      });
      if (command === "modelPicker.previousProvider" || command === "modelPicker.nextProvider") {
        event.preventDefault();
        event.stopPropagation();
        cycleProvider(command === "modelPicker.nextProvider" ? 1 : -1);
        return;
      }
      const jumpIndex = modelPickerJumpIndexFromCommand(command ?? "");
      if (jumpIndex === null) return;
      event.preventDefault();
      event.stopPropagation();
      const target = jumpTargets[jumpIndex];
      if (!target) return;
      const selectedSlug = chooseModel(target);
      if (selectedSlug === null) return;
      const name = flatModels.find(
        (item) => item.slug === selectedSlug && item.instanceId === target.instanceId,
      )?.name;
      announce(gt("Model: {name}", { name: name ?? selectedSlug }), "model-picker");
    };
    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => window.removeEventListener("keydown", onWindowKeyDown, true);
  }, [chooseModel, cycleProvider, jumpTargets, keybindings, modelJumpShortcutContext]);

  // Typing anywhere in the menu — a provider row, a model row — goes to the
  // search field instead of the menu's type-ahead. Capture phase, so it runs
  // before the menu's own key handling on the focused row.
  const redirectTypingToSearch = (event: TypedKeyEvent) => {
    if (event.target === searchInputRef.current || !isTypedCharacter(event)) return;
    if (event.key === " " && !isSearching) return;
    event.preventDefault();
    event.stopPropagation();
    setSearchQuery((query) => query + event.key);
    focusSearchInput();
  };

  // When a swap removes the focused row, the menu parks focus on the popup
  // itself, outside this content's own capture; catch typing there too.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- subscribes a capture-phase keydown listener on the menu popup element
  useEffect(() => {
    const popup = contentRef.current?.closest<HTMLElement>('[data-slot="menu-popup"]');
    if (!popup) return;
    const onPopupKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.target === popup) redirectTypingToSearch(event);
    };
    popup.addEventListener("keydown", onPopupKeyDown, true);
    return () => popup.removeEventListener("keydown", onPopupKeyDown, true);
  }, [redirectTypingToSearch]);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      (event as typeof event & { preventBaseUIHandler?: () => void }).preventBaseUIHandler?.();
      event.stopPropagation();
      return;
    }
    if (event.key === "Escape" && searchQuery) {
      event.preventDefault();
      event.stopPropagation();
      setSearchQuery("");
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const first = searchResults.find(
        (model) => !getModelDisabledReason?.(model.instanceId, model.slug),
      );
      if (first) chooseModel(first, event.shiftKey);
      return;
    }
    // Arrows, Escape (with nothing typed) and Tab drive the menu; everything
    // else edits the query and must not reach the menu's type-ahead.
    if (!["ArrowDown", "ArrowUp", "Escape", "Tab"].includes(event.key)) {
      event.stopPropagation();
    }
  };

  // Models the manifest announces that an instance's installed CLI is too old
  // to run. A search spans every provider, so it explains gated matches from
  // any of them; a provider's list explains its own.
  const renderUpdateRequiredNotices = (entries: ReadonlyArray<ProviderInstanceEntry>) =>
    entries.flatMap((entry) => {
      const notice = formatProviderUpdateRequiredNotice(
        entry.snapshot,
        searchQuery,
        messages,
        locale,
      );
      return notice
        ? [
            <div key={`update:${entry.instanceId}`} className="px-2 py-1.5 text-xs leading-snug">
              <p className="text-muted-foreground">{notice}</p>
              {providerUpdateChannelLags(entry.snapshot, searchQuery) ? null : (
                <MenuItem
                  size="xs"
                  className={cn(ROW_CLASS, "mt-1 -mx-2")}
                  onClick={() => {
                    props.onRequestClose?.();
                    void navigate({ to: "/settings/providers" });
                  }}
                >
                  <T>Provider settings</T>
                </MenuItem>
              )}
            </div>,
          ]
        : [];
    });

  const renderModelItem = (model: ModelPickerItem, showProvider: boolean) => {
    const modelKey = providerModelKey(model.instanceId, model.slug);
    const disabledReason = getModelDisabledReason?.(model.instanceId, model.slug) ?? null;
    const isFavorite = favoritesSet.has(modelKey);
    const isSelected = selectedModelKeySet.has(modelKey);
    const jumpLabel = modelJumpLabelByKey.get(modelKey);
    // Upstream retired its driver-keyed glyph table; the instance icon carries
    // the ACP registry art and accent the row's provider actually has.
    const providerEntry = showProvider ? entryByInstanceId.get(model.instanceId) : undefined;
    const providerLabel = model.subProvider
      ? `${model.instanceDisplayName} · ${model.subProvider}`
      : model.instanceDisplayName;
    const displayName = getDisplayModelName(model);
    // The row's provider label, or the selected provider tab, names the
    // provider already.
    const modelName = stripProviderName(displayName, {
      driverKind: model.driverKind,
      displayName: model.instanceDisplayName,
    });

    const label = (
      <>
        {providerEntry ? (
          <span className="shrink-0 text-muted-foreground" aria-hidden>
            {renderProviderGlyph(providerEntry)}
          </span>
        ) : null}
        <span className="min-w-0 truncate">{modelName}</span>
        {showProvider ? (
          <span className="min-w-0 truncate font-normal text-muted-foreground/70">
            {providerLabel}
          </span>
        ) : null}
        {model.isUnavailable ? (
          <Badge variant="outline" size="sm">
            <T context="badge on a model that cannot be selected">Unavailable</T>
          </Badge>
        ) : null}
      </>
    );

    return (
      <MenuItem
        key={modelKey}
        disabled={Boolean(disabledReason)}
        // The host closes the menu on a pick, or keeps it open for what it
        // renders below the list.
        closeOnClick={false}
        size="xs"
        className={cn(ROW_CLASS, "group", disabledReason && "data-disabled:pointer-events-auto")}
        onClick={(event) => chooseModel(model, event.shiftKey)}
      >
        {disabledReason ? (
          <Tooltip>
            <TooltipTrigger render={<span className="flex min-w-0 flex-1 items-center gap-2" />}>
              {label}
            </TooltipTrigger>
            <TooltipPopup side="left" align="center" className={TOOLTIP_CLASS}>
              <span className={TOOLTIP_TEXT_CLASS}>{disabledReason}</span>
            </TooltipPopup>
          </Tooltip>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2">{label}</span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {jumpLabel ? (
            <Kbd variant="faint" size="xs" reveal="row" className="h-4 min-w-0">
              {jumpLabel}
            </Kbd>
          ) : null}
          {/* Toggles the favorite without choosing the row: the item selects
              on click, so the star's click must not reach it. */}
          <Button
            variant="ghost-muted"
            size="icon-xs"
            tabIndex={-1}
            aria-label={isFavorite ? gt("Remove from favorites") : gt("Add to favorites")}
            // Shown on touch, where nothing hovers: tapping a row's right edge must not toggle
            // a favorite the user cannot see.
            reveal="row"
            // Button's 44px coarse-pointer target would reach into the next row's star.
            className="pointer-coarse:after:hidden"
            disabled={Boolean(disabledReason)}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onMouseUp={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void toggleFavorite(model.instanceId, model.slug);
            }}
          >
            <StarIcon className={cn("size-3.5", isFavorite && "fill-current text-yellow-500")} />
          </Button>
          {isSelected ? (
            <CheckIcon className="size-4 shrink-0 text-foreground" aria-label="Selected" />
          ) : null}
        </span>
      </MenuItem>
    );
  };

  const renderProviderGlyph = (entry: ProviderInstanceEntry) => (
    <ModelPickerProviderGlyph
      entry={entry}
      showBadge={shouldShowInstanceBadge(entry, instanceEntries)}
    />
  );

  /** One of the top bar's provider tabs. It sets the scope rather than choosing
      a model, so it never closes the menu. */
  const renderScopeTab = (input: {
    target: ModelPickerScope;
    icon: ReactNode;
    /** Accessible name and tooltip: the scope's name, or why it is disabled. */
    title: string;
    disabled?: boolean;
  }) => {
    const isSelected = scope === input.target;
    const holdsCurrentModel = !isSelected && input.target === props.activeInstanceId;
    return (
      <Tooltip key={input.target}>
        <TooltipTrigger
          render={
            <MenuIconTab
              value={input.target}
              disabled={input.disabled}
              aria-label={holdsCurrentModel ? `${input.title} (current model)` : input.title}
              aria-current={isSelected ? "true" : undefined}
              data-model-picker-provider={input.target}
              // A pick goes through onValueChange; clicking the open tab again
              // only lands here, and still clears the search back to its list.
              onClick={() => {
                if (isSelected && !input.disabled) selectScope(input.target);
              }}
              className={cn(
                "relative aspect-auto min-w-7 flex-1",
                input.disabled && "data-disabled:pointer-events-auto",
              )}
            >
              {input.icon}
              {holdsCurrentModel ? (
                // Where the current model lives, when the list shows another scope.
                <span
                  className="pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-foreground/60"
                  aria-hidden
                />
              ) : null}
            </MenuIconTab>
          }
        />
        <TooltipPopup side="top" sideOffset={6} align="center" className={TOOLTIP_CLASS}>
          <span className={TOOLTIP_TEXT_CLASS}>{input.title}</span>
        </TooltipPopup>
      </Tooltip>
    );
  };

  const renderProviderTab = (entry: ProviderInstanceEntry) => {
    const isUnavailable = !isProviderInstancePickerReady(entry);
    const isContextDisabled = !matchesLockedProvider(entry);
    const { current, legacy } = modelsForInstance(entry.instanceId);
    const needsSetup =
      props.onOpenProviderSetup !== undefined &&
      shouldOfferModelPickerSetup(entry, modelOptionsByInstance.get(entry.instanceId) ?? []);
    // An unready instance still opens when it holds the selected model or
    // can offer setup, so neither gets stranded behind a disabled tab.
    const isDisabled =
      isContextDisabled ||
      (isUnavailable && current.length === 0 && legacy.length === 0 && !needsSetup);

    return renderScopeTab({
      target: entry.instanceId,
      icon: renderProviderGlyph(entry),
      title: isContextDisabled
        ? gt("{provider} is unavailable in this thread. Start a new thread to switch providers.", {
            provider: entry.displayName,
          })
        : describeUnavailableInstance(entry),
      disabled: isDisabled,
    });
  };

  /** Horizontal provider tabs above the search field, using the fork's segmented
      MenuTabs strip so the tabs stay in the menu's keyboard navigation. */
  const renderProviderTabs = () => (
    <div
      className="flex shrink-0 items-center overflow-x-auto overscroll-contain px-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-fork-model-picker="providers"
    >
      <MenuTabs
        size="md"
        aria-label="Providers"
        value={scope}
        onValueChange={(next) => {
          if (typeof next === "string") selectScope(next as ModelPickerScope);
        }}
        className="min-w-full"
      >
        {renderScopeTab({
          target: "favorites",
          title: gt("Favorites"),
          icon: <HeartIcon className="size-4 shrink-0" aria-hidden />,
        })}
        {providerEntries.map(renderProviderTab)}
      </MenuTabs>
    </div>
  );

  const renderSubProviderSection = (section: {
    key: string;
    name: string;
    unavailableReason: string | undefined;
    models: ReadonlyArray<ModelPickerItem>;
    isExpanded: boolean;
  }) => {
    const unavailable = section.unavailableReason !== undefined;
    const label = (
      <>
        <span className="min-w-0 truncate">{section.name}</span>
        {unavailable ? (
          <Badge variant="outline" size="sm">
            {gt("Unavailable", { $context: "backend cannot be used right now" })}
          </Badge>
        ) : null}
      </>
    );
    return (
      <Fragment key={section.key}>
        <MenuItem
          closeOnClick={false}
          disabled={unavailable}
          aria-expanded={unavailable ? undefined : section.isExpanded}
          size="xs"
          className={cn(ROW_CLASS, unavailable && "data-disabled:pointer-events-auto")}
          onClick={() => toggleSubProviderSection(section.key)}
        >
          {unavailable ? (
            <Tooltip>
              <TooltipTrigger render={<span className="flex min-w-0 flex-1 items-center gap-2" />}>
                {label}
              </TooltipTrigger>
              <TooltipPopup side="left" align="center" className={TOOLTIP_CLASS}>
                <span className={TOOLTIP_TEXT_CLASS}>{section.unavailableReason}</span>
              </TooltipPopup>
            </Tooltip>
          ) : (
            <>
              <span className="flex min-w-0 flex-1 items-center gap-2">{label}</span>
              <span className="shrink-0 font-normal text-muted-foreground/70">
                {section.models.length}
              </span>
              <ChevronDownIcon
                className={cn(
                  "size-4 shrink-0 transition-transform",
                  section.isExpanded && "rotate-180",
                )}
                aria-hidden
              />
            </>
          )}
        </MenuItem>
        {section.isExpanded ? section.models.map((model) => renderModelItem(model, false)) : null}
      </Fragment>
    );
  };

  const renderInstanceModels = (entry: ProviderInstanceEntry) => {
    const { instanceId } = entry;
    const { current, legacy } = modelsForInstance(instanceId);
    const needsSetup =
      props.onOpenProviderSetup !== undefined &&
      shouldOfferModelPickerSetup(entry, modelOptionsByInstance.get(instanceId) ?? []);
    const subProviderSections = subProviderSectionsFor(instanceId);
    return (
      <>
        {subProviderSections ? (
          <>
            {subProviderSections.ungrouped.map((model) => renderModelItem(model, false))}
            {subProviderSections.sections.map(renderSubProviderSection)}
          </>
        ) : (
          <>
            {current.map((model) => renderModelItem(model, false))}
            {legacy.length > 0 ? (
              <MenuItem
                closeOnClick={false}
                aria-expanded={showLegacy}
                data-model-picker-legacy-toggle="true"
                size="xs"
                tone="muted"
                className={ROW_CLASS}
                onClick={() => setShowLegacy((shown) => !shown)}
              >
                <span className="min-w-0 flex-1 truncate">Legacy models</span>
                <span className="shrink-0 font-normal text-muted-foreground/70">
                  {legacy.length}
                </span>
                <ChevronDownIcon
                  className={cn("size-4 shrink-0 transition-transform", showLegacy && "rotate-180")}
                  aria-hidden
                />
              </MenuItem>
            ) : null}
            {showLegacy ? legacy.map((model) => renderModelItem(model, false)) : null}
          </>
        )}
        {needsSetup ? (
          <div className="px-2 py-1.5 text-xs leading-snug">
            <p className="line-clamp-3 text-muted-foreground">
              {getProviderStatusMessage(entry.snapshot, messages)}
            </p>
            <MenuItem
              size="xs"
              className={cn(ROW_CLASS, "mt-1 -mx-2")}
              onClick={() => {
                props.onRequestClose?.();
                props.onOpenProviderSetup?.(instanceId);
              }}
            >
              {gt("Open provider setup")}
            </MenuItem>
          </div>
        ) : null}
        {current.length === 0 &&
        legacy.length === 0 &&
        !subProviderSections?.sections.length &&
        !needsSetup ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            {workspaceModelsScanning ? gt("Searching project models...") : "No models"}
          </p>
        ) : null}
        {renderUpdateRequiredNotices([entry])}
      </>
    );
  };

  const renderModelList = () => {
    if (isSearching) {
      return (
        <>
          {searchResults.length > 0 ? (
            searchResults.map((model) => renderModelItem(model, true))
          ) : (
            <p className="px-2 py-2 text-xs text-muted-foreground">{gt("No models found")}</p>
          )}
          {renderUpdateRequiredNotices(instanceEntries.filter(matchesLockedProvider))}
        </>
      );
    }
    if (scopeEntry === "favorites") {
      return favoriteModels.length > 0 ? (
        favoriteModels.map((model) => renderModelItem(model, true))
      ) : (
        <p className="px-2 py-2 text-xs text-muted-foreground">
          No favorites yet. Star a model to add it here.
        </p>
      );
    }
    return renderInstanceModels(scopeEntry);
  };

  return (
    <TooltipProvider delay={0}>
      <div
        ref={contentRef}
        className="-mx-1 -mt-1 flex min-h-0 flex-col last:-mb-1"
        data-model-picker-content="true"
        data-fork-model-picker="true"
        onKeyDownCapture={redirectTypingToSearch}
      >
        {renderProviderTabs()}
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-2" data-fork-model-picker="list">
          <label className="flex h-8 shrink-0 items-center gap-2 rounded-sm border border-foreground/12 bg-foreground/4 px-2">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={searchInputRef}
              // The menu focuses its first tabbable element as it opens; on touch that would raise
              // the keyboard, so the popup takes focus and a tap still reaches the field.
              tabIndex={coarsePointer ? -1 : undefined}
              aria-label={gt("Search models")}
              placeholder={gt("Search models")}
              className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
              }}
              onKeyDown={handleSearchKeyDown}
            />
          </label>
          {/* Scrolls on its own so whatever the host renders below stays put. */}
          <div className="flex max-h-80 min-h-0 flex-col overflow-y-auto">{renderModelList()}</div>
        </div>
      </div>
    </TooltipProvider>
  );
});
