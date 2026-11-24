/**
 * Fork shadow of upstream's ProviderModelPicker — see
 * `.fork/customizations.yaml#fork-model-picker`.
 *
 * Upstream's file with three changes. The Popover shell becomes a Base UI
 * Menu holding provider icon tabs, search and the chosen provider's models
 * (ModelPickerContent's shadow renders them). Non-modal like the popover
 * it replaces; upstream's own wheel/touch lock still guards the page.
 * The trigger shows the same ModelPickerProviderGlyph used in the menu and
 * drops the provider name ("Opus 5.5", not "Claude Opus 5.5"). And an
 * optional `traits` slot (the composer's ComposerModelPicker fills it) adds
 * the reasoning label to the trigger and its panel under the model list,
 * keeping the menu open on a pick.
 *
 * The `compact` prop (dropped upstream in #11002, since restored) caps the
 * trigger's width from the fork's footer (custom/composerModelSlotCompact.ts)
 * instead of letting the composer's controls layout size it; the fork keeps
 * the max width on the composer's trigger too, where upstream lifts it.
 */
import {
  ANTIGRAVITY_DEFAULT_MODEL,
  type ProviderInstanceId,
  type EnvironmentId,
  type ProviderDriverKind,
  type ResolvedKeybindingsConfig,
} from "@t3tools/contracts";
import { RegistryContext } from "@effect/atom-react";
import { T, useGT } from "gt-react";
import {
  createContext,
  memo,
  type ReactNode,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { Badge } from "../ui/badge";
import { Menu, MenuPopup, MenuSeparator, MenuTrigger } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { cn } from "~/lib/utils";
import { ModelPickerProviderGlyph } from "~/custom/icons/ModelPickerProviderGlyph";
import { useIsInletActive } from "~/custom/forkActivePalette";
import { pickerTriggerModelName } from "~/custom/modelPickerDisplayName";
import { ModelPickerContent, resolveModelPickerSelectedModel } from "./ModelPickerContent";
import { retainedModelWhileProviderLocked } from "./ProviderModelPicker.logic";
import { ChatGptSharingControl } from "./ChatGptSharingControl";
import { ModelEsque, getDisplayModelName } from "./providerIconUtils";
import { shouldShowInstanceBadge, type ProviderInstanceEntry } from "../../providerInstances";
import { ComposerControl, type ComposerControlSize } from "./ComposerControl";
import { useComposerMenuProps } from "./composerEventScope";
import { shortcutLabelForCommand } from "../../keybindings";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";

/** Holds the page still behind the open picker; its lifetime is the popup element's. */
function lockBackgroundScroll(popup: HTMLElement | null) {
  if (!popup) return;
  const { documentElement, body } = document;
  const previousDocumentOverscrollBehavior = documentElement.style.overscrollBehavior;
  const previousBodyOverflow = body.style.overflow;
  const previousBodyPaddingRight = body.style.paddingRight;
  const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

  documentElement.style.overscrollBehavior = "contain";
  body.style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }

  const shouldAllowOverlayScroll = (target: EventTarget | null) => {
    return target instanceof Element && target.closest("[data-model-picker-content]");
  };
  const preventBackgroundWheel = (event: WheelEvent) => {
    if (shouldAllowOverlayScroll(event.target)) {
      return;
    }
    event.preventDefault();
  };
  const preventBackgroundTouchMove = (event: TouchEvent) => {
    if (shouldAllowOverlayScroll(event.target)) {
      return;
    }
    event.preventDefault();
  };

  document.addEventListener("wheel", preventBackgroundWheel, { capture: true, passive: false });
  document.addEventListener("touchmove", preventBackgroundTouchMove, {
    capture: true,
    passive: false,
  });

  return () => {
    document.removeEventListener("wheel", preventBackgroundWheel, { capture: true });
    document.removeEventListener("touchmove", preventBackgroundTouchMove, { capture: true });
    documentElement.style.overscrollBehavior = previousDocumentOverscrollBehavior;
    body.style.overflow = previousBodyOverflow;
    body.style.paddingRight = previousBodyPaddingRight;
  };
}

/* fork:begin fork-model-picker — see .fork/customizations.yaml#fork-model-picker
   Upstream's docked effort column (ComposerModelEffort) imports this; the fork never docks
   one, so nothing provides it and the column reads the default. */
export const DockedPickerContext = createContext<{ modelLabel: string }>({ modelLabel: "" });
/* fork:end fork-model-picker */

export const ProviderModelPicker = memo(function ProviderModelPicker(props: {
  environmentId: EnvironmentId | null;
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
  activeProviderIconClassName?: string;
  instanceIndicatorBackground?: string;
  size?: ComposerControlSize;
  /** Fork-only (see the header): the composer's narrow-footer width cap. */
  compact?: boolean;
  isComposerOwned?: boolean;
  disabled?: boolean;
  terminalOpen?: boolean;
  open?: boolean;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerAriaLabel?: string;
  onOpenChange?: (open: boolean) => void;
  onOpenProviderSetup?: (instanceId: ProviderInstanceId) => void;
  getModelDisabledReason?: (instanceId: ProviderInstanceId, model: string) => string | null;
  onInstanceModelChange: (instanceId: ProviderInstanceId, model: string) => void;
  /**
   * The selected model's reasoning: a trigger label, a control on the selected row (effort)
   * and a panel of toggles under the model list.
   */
  traits?: {
    label: string;
    selectedRowControl?: ReactNode;
    panel?: ReactNode;
  };
  /** Shown on another model's row while hovered: what picking it would set (its effort). */
  rowPreview?: (instanceId: ProviderInstanceId, model: string) => ReactNode;
  /**
   * The composer's combined menu: a pick keeps it open (effort usually
   * follows a new model) at one width, whether or not the model has traits.
   */
  combined?: boolean;
}) {
  const composerFloatingLayerProps = useComposerMenuProps();
  const [uncontrolledIsMenuOpen, setUncontrolledIsMenuOpen] = useState(false);
  const isMenuOpen = props.open ?? uncontrolledIsMenuOpen;
  const registry = useContext(RegistryContext);
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const refreshModelCatalog = useEffectEvent(() => {
    const environmentId = props.environmentId;
    if (environmentId === null) return;
    // An older server drops the field and probes every provider.
    const config = registry.get(serverEnvironment.configValueAtom(environmentId));
    if (config?.environment.capabilities.modelCatalogRefresh !== true) return;
    void refreshProviders({ environmentId, input: { modelCatalogOnly: true } });
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- asks the server for newly released models on every open; a parent, a keybinding or the palette can open the picker, so no one handler sees them all
  useEffect(() => {
    if (isMenuOpen) refreshModelCatalog();
  }, [isMenuOpen]);
  const gt = useGT();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const size = props.size ?? "sm";

  const activeEntry =
    props.instanceEntries.find((entry) => entry.instanceId === props.activeInstanceId) ?? null;

  const activeInstanceId = props.activeInstanceId;
  const selectedInstanceOptions = props.modelOptionsByInstance.get(activeInstanceId) ?? [];
  const selectedModel =
    resolveModelPickerSelectedModel({
      driverKind: activeEntry?.driverKind,
      model: props.model,
      options: selectedInstanceOptions,
    }) ??
    retainedModelWhileProviderLocked(activeEntry, props.model) ??
    (activeEntry?.driverKind === "opencode" || activeEntry?.driverKind === "antigravity"
      ? undefined
      : selectedInstanceOptions[0]);
  const triggerTitle = selectedModel
    ? pickerTriggerModelName(selectedModel, activeEntry)
    : props.model === ANTIGRAVITY_DEFAULT_MODEL
      ? gt("Choose model")
      : props.model || gt("Choose model");
  const withUnavailable = (model: string, isUnavailable: boolean | undefined) =>
    isUnavailable ? gt("{model} (Unavailable)", { model }) : model;
  const triggerLabel = selectedModel
    ? withUnavailable(getDisplayModelName(selectedModel), selectedModel.isUnavailable)
    : triggerTitle;
  const showInstanceBadge =
    activeEntry !== null && shouldShowInstanceBadge(activeEntry, props.instanceEntries);

  const floatingLayerProps = props.isComposerOwned ? composerFloatingLayerProps : {};

  const setIsMenuOpen = (open: boolean) => {
    props.onOpenChange?.(open);
    if (props.open === undefined) {
      setUncontrolledIsMenuOpen(open);
    }
  };

  const handleInstanceModelChange = (instanceId: ProviderInstanceId, model: string) => {
    if (props.disabled) return;
    props.onInstanceModelChange(instanceId, model);
    if (!props.combined) setIsMenuOpen(false);
  };

  const shortcutLabel = props.keybindings
    ? shortcutLabelForCommand(props.keybindings, "modelPicker.toggle")
    : null;
  const selectedEntries = props.selectedModels?.map((selection) => {
    const entry = props.instanceEntries.find(
      (candidate) => candidate.instanceId === selection.instanceId,
    );
    const model = resolveModelPickerSelectedModel({
      driverKind: entry?.driverKind,
      model: selection.model,
      options: props.modelOptionsByInstance.get(selection.instanceId) ?? [],
    });
    // Same name as the single trigger title; the tooltip keeps the full names.
    const modelName = model ? pickerTriggerModelName(model, entry) : selection.model;
    return {
      ...selection,
      entry,
      label: model ? withUnavailable(modelName, model.isUnavailable) : modelName,
      fullLabel: model
        ? withUnavailable(getDisplayModelName(model), model.isUnavailable)
        : selection.model,
    };
  });
  const multipleLabel = selectedEntries
    ? selectedEntries.length === 0
      ? gt("Choose models")
      : selectedEntries.length > 2
        ? gt("{count, plural, one {{models}, {count} more} other {{models}, {count} more}}", {
            models: selectedEntries
              .slice(0, 2)
              .map((selection) => selection.label)
              .join(", "),
            count: selectedEntries.length - 2,
          })
        : selectedEntries.map((selection) => selection.label).join(", ")
    : undefined;
  const allModelNames = selectedEntries
    ? selectedEntries.map((selection) => selection.fullLabel).join(", ") || gt("Choose models")
    : undefined;
  const triggerTooltipContent = shortcutLabel
    ? `${props.triggerLabel ?? allModelNames ?? triggerLabel} · ${shortcutLabel}`
    : (props.triggerLabel ?? allModelNames ?? triggerLabel);
  // Inlet's open composer menu hangs from this button as a tab, so effort holds
  // its label until close rather than resize the button and the tab with it.
  // The hold is keyed by model: a new pick is deliberate and re-takes it at once.
  const modelLabel = props.triggerLabel ?? multipleLabel ?? triggerTitle;
  const holdKey =
    useIsInletActive() && props.isComposerOwned === true && isMenuOpen ? modelLabel : null;
  const [heldTraits, setHeldTraits] = useState<{
    key: string;
    label: string | undefined;
  } | null>(null);
  if ((heldTraits?.key ?? null) !== holdKey) {
    setHeldTraits(holdKey === null ? null : { key: holdKey, label: props.traits?.label });
  }
  const traitsLabel = heldTraits ? heldTraits.label : props.traits?.label;

  return (
    <Menu
      modal={false}
      open={isMenuOpen}
      onOpenChange={(open) => {
        if (props.disabled) {
          setIsMenuOpen(false);
          return;
        }
        setIsMenuOpen(open);
      }}
    >
      <MenuTrigger
        render={
          <ComposerControl
            aria-label={
              props.triggerAriaLabel ?? props.triggerLabel ?? allModelNames ?? triggerLabel
            }
            size={size}
            data-chat-provider-model-picker="true"
            // Inlet hangs the composer's menu from this button (theme.custom.inlet-menus.css).
            data-fork-tab-trigger={props.isComposerOwned ? "" : undefined}
            // Effort lives in this menu, so Mod+Shift+E opens it like upstream's TraitsPicker.
            data-composer-shortcut={
              props.isComposerOwned && props.traits ? "composer.effort" : undefined
            }
            className={cn(
              "min-w-0 justify-between whitespace-nowrap",
              props.compact ? "max-w-42 shrink-0" : "max-w-48 shrink sm:max-w-56",
              props.triggerClassName,
            )}
            disabled={props.disabled}
          />
        }
      >
        <span
          className={cn("flex min-w-0 flex-1 items-center", size === "xs" ? "gap-1" : "gap-1.5")}
        >
          {/* An aggregate label claims no provider; several selected models
              stack their glyphs. */}
          {props.triggerLabel !== undefined ? null : selectedEntries ? (
            <span className="flex shrink-0 items-center -space-x-1" aria-hidden="true">
              {selectedEntries
                .slice(0, 3)
                .map((selection) =>
                  selection.entry ? (
                    <ModelPickerProviderGlyph
                      key={`${selection.instanceId}:${selection.model}`}
                      entry={selection.entry}
                      showBadge={false}
                      className="size-4 rounded-full bg-(--chat-composer-glass-surface,var(--background)) ring-2 ring-(--chat-composer-glass-surface,var(--background))"
                      iconClassName="size-4"
                    />
                  ) : null,
                )}
              {selectedEntries.length > 3 ? (
                <span className="relative z-30 flex size-4 items-center justify-center rounded-full bg-(--chat-composer-glass-surface,var(--background)) text-3xs ring-2 ring-(--chat-composer-glass-surface,var(--background))">
                  +{selectedEntries.length - 3}
                </span>
              ) : null}
            </span>
          ) : (
            <>
              {activeEntry ? (
                <ModelPickerProviderGlyph
                  entry={activeEntry}
                  showBadge={showInstanceBadge}
                  className="size-4"
                  iconClassName={cn("size-4", props.activeProviderIconClassName)}
                  indicatorBackground={props.instanceIndicatorBackground ?? "var(--contrast-input)"}
                  badgeClassName={cn(
                    "right-[-0.125rem] bottom-[-0.125rem] h-3 min-w-3 px-0.5 text-5xs",
                    size === "xs" && "shadow-none",
                  )}
                />
              ) : null}
            </>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className="min-w-0 flex-1 overflow-hidden truncate"
                  data-chat-provider-model-picker-label="true"
                />
              }
            >
              {modelLabel}
            </TooltipTrigger>
            <TooltipPopup side="top">
              {triggerTooltipContent}
              {/* The composer hides the provider icon, so the tooltip names
                  the instance serving the model. */}
              {activeEntry ? (
                <span className="block text-muted-foreground">{activeEntry.displayName}</span>
              ) : null}
            </TooltipPopup>
          </Tooltip>
          {selectedModel?.isUnavailable && !selectedEntries && props.triggerLabel === undefined ? (
            <Badge variant="outline" size="sm">
              <T context="badge on a model that cannot be selected">Unavailable</T>
            </Badge>
          ) : null}
          {/* The resting strip (size xs) sizes this trigger down to its icon
              below 640px, so the traits label collapses there with the model
              name. Elsewhere it truncates rather than spill past the trigger's
              max width. Fast mode is part of the label text (upstream #16069). */}
          {traitsLabel ? (
            <span
              className={cn(
                "min-w-0 truncate text-muted-foreground [text-box:trim-both_cap_alphabetic] supports-[text-box:trim-both_cap_alphabetic]:py-1.5",
                size === "xs" && "@max-[640px]/composer-surface:hidden",
              )}
              data-chat-provider-model-picker-traits="true"
            >
              {traitsLabel}
            </span>
          ) : null}
        </span>
      </MenuTrigger>
      {/* The composer's trigger ends the row, so its right edge holds still
          while the label's length changes; anchor the menu there. It always
          opens above and never flips: paging to a taller provider would
          otherwise move it to the other side mid-pick (the draft composer
          sits mid-screen), so a short space scrolls the menu instead. */}
      <MenuPopup
        {...floatingLayerProps}
        ref={lockBackgroundScroll}
        align={props.isComposerOwned ? "end" : "start"}
        {...(props.isComposerOwned
          ? { side: "top" as const, collisionAvoidance: { side: "none" as const } }
          : {})}
        className={props.combined ? "w-72" : "w-64"}
        data-fork-tab-menu={props.isComposerOwned ? "composer" : undefined}
      >
        <ModelPickerContent
          searchInputRef={searchInputRef}
          environmentId={props.environmentId}
          workspaceCwd={props.workspaceCwd ?? null}
          activeInstanceId={activeInstanceId}
          model={props.model}
          {...(props.selectedModels !== undefined ? { selectedModels: props.selectedModels } : {})}
          {...(props.onToggleModel
            ? {
                onToggleModel: (instanceId: ProviderInstanceId, model: string) => {
                  if (!props.disabled) props.onToggleModel?.(instanceId, model);
                },
              }
            : {})}
          lockedProvider={props.lockedProvider}
          lockedContinuationGroupKey={props.lockedContinuationGroupKey ?? null}
          instanceEntries={props.instanceEntries}
          {...(props.keybindings ? { keybindings: props.keybindings } : {})}
          modelOptionsByInstance={props.modelOptionsByInstance}
          terminalOpen={props.terminalOpen ?? false}
          onRequestClose={() => setIsMenuOpen(false)}
          {...(props.onOpenProviderSetup ? { onOpenProviderSetup: props.onOpenProviderSetup } : {})}
          getModelDisabledReason={(instanceId, model) =>
            props.disabled
              ? gt("Model picker is disabled")
              : (props.getModelDisabledReason?.(instanceId, model) ?? null)
          }
          onInstanceModelChange={handleInstanceModelChange}
          selectedRowControl={props.traits?.selectedRowControl}
          {...(props.rowPreview ? { rowPreview: props.rowPreview } : {})}
        />
        {props.traits?.panel ? (
          <>
            {/* Edge to edge: the popup's scroll wrapper pads its children by
                4px, so the rule pulls back out by the same amount. It ends at
                the wrapper's padding box, so nothing scrolls sideways. */}
            <MenuSeparator className="-mx-1 my-0" />
            {/* Stamped like the model list above, so the wheel lock lets the popup
                scroll from here and modelPickerHoldsFocus counts the panel's
                controls as inside the picker. */}
            <div data-model-picker-content="true">{props.traits.panel}</div>
          </>
        ) : null}
        {props.selectedModels === undefined ? (
          <ChatGptSharingControl provider={activeEntry?.snapshot ?? null} />
        ) : null}
      </MenuPopup>
    </Menu>
  );
});
