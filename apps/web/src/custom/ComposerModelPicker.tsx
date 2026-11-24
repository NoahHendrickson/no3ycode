/**
 * The composer's single model-and-reasoning menu — see
 * `.fork/customizations.yaml#fork-model-picker`.
 *
 * Wraps ProviderModelPicker and hands it the reasoning half as one control on the selected
 * model's row: its effort ("⇕ High", led by an icon per toggle that is on), which opens a menu
 * above it on click with the model's levels, any other select, and its toggles (Fast, Ultracode,
 * Cyber) as checkboxes. The model menu itself has no traits panel, so its height never depends on
 * the model. Writes go to the same draft-store options, with the same Ultrathink prompt prefix,
 * as upstream's traits picker. Controlled editors supply their own options callback so scheduled
 * tasks can reuse the menu without a conversation draft.
 */
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ProviderInstanceId, ProviderOptionDescriptor } from "@t3tools/contracts";
import {
  applyClaudePromptEffortPrefix,
  buildProviderOptionSelectionsFromDescriptors,
  getProviderOptionCurrentLabel,
  getProviderOptionCurrentValue,
  getProviderOptionDescriptors,
} from "@t3tools/shared/model";
import { BrainIcon, ChevronsUpDownIcon, CodeIcon, ShieldIcon, ZapIcon } from "lucide-react";
import { type ComponentProps, Fragment, type ReactNode, useRef, useState } from "react";

// Through the alias: a relative import type-checks against upstream's module,
// not the shadow that adds `traits` and `combined`.
import { ProviderModelPicker } from "~/components/chat/ProviderModelPicker";
import { useApplyThreadModelPick } from "~/components/chat/useApplyThreadModelPick";
import { CheckboxMark } from "../components/ui/checkbox";
import { composerFloatingLayerProps } from "../components/chat/composerEventScope";
import {
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuSeparator,
  MenuSub,
} from "../components/ui/menu";
import { useComposerDraftStore } from "../composerDraftStore";
import { getProviderModelCapabilities } from "../providerModels";
import { cn } from "~/lib/utils";
import {
  type ComposerModelTraits,
  type ComposerModelTraitsInput,
  type SelectDescriptor,
  effortStopIndex,
  findEffortDescriptor,
  resolveComposerModelTraits,
  selectToggle,
} from "./composerModelTraits";

const ULTRATHINK_PROMPT_PREFIX = "Ultrathink:\n";

function replaceDescriptorCurrentValue(
  descriptors: ReadonlyArray<ProviderOptionDescriptor>,
  descriptorId: string,
  currentValue: string | boolean,
): ReadonlyArray<ProviderOptionDescriptor> {
  return descriptors.map((descriptor) =>
    descriptor.id !== descriptorId
      ? descriptor
      : descriptor.type === "boolean"
        ? { ...descriptor, ...(typeof currentValue === "boolean" ? { currentValue } : {}) }
        : { ...descriptor, ...(typeof currentValue === "string" ? { currentValue } : {}) },
  );
}

/** A trait's mark: on the selected row while it is on, and beside its checkbox. */
const TRAIT_ICONS: Readonly<Record<string, typeof ZapIcon>> = {
  fastMode: ZapIcon,
  serviceTier: ZapIcon,
  ultracode: CodeIcon,
  cyberAccessProgram: ShieldIcon,
  thinking: BrainIcon,
};

function TraitIcon(props: { id: string; className: string }) {
  const Icon = TRAIT_ICONS[props.id];
  return Icon ? <Icon aria-hidden className={props.className} /> : null;
}

const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
/** Keeps a press on the value from also picking the model row it sits in. */
const stopRowPick = { onPointerDown: stop, onPointerUp: stop, onMouseUp: stop, onClick: stop };
/**
 * The menu is portaled, but React still bubbles its events through the row that renders it: a
 * move would highlight that row, which closes the menu, and a click would pick the row. (The
 * value's own moves must bubble, for the menus' hover logic; the row ignores those itself.)
 */
const stopRowEvents = { ...stopRowPick, onMouseMove: stop, onPointerMove: stop, onMouseDown: stop };

/** A value on a model row, laid out like the selected row's control so previews line up. */
const EFFORT_VALUE_CLASS = "flex h-6 shrink-0 items-center gap-0.5 px-1 text-base";
/** Rules a section off edge to edge, through the popup's and the menu's 4px insets. */
const SECTION_RULE_CLASS = "-mx-2 my-1";

type Traits = NonNullable<ComposerModelTraits>;

/** Writes match upstream's traits menu: same draft-store options, same Ultrathink prefix. */
function useTraitWrites(input: ComposerModelTraitsInput, traits: Traits) {
  const { descriptors, primarySelectId } = traits;
  const setProviderModelOptions = useComposerDraftStore((store) => store.setProviderModelOptions);
  const applyThreadModelPick = useApplyThreadModelPick();

  const updateDescriptors = (next: ReadonlyArray<ProviderOptionDescriptor>) => {
    const options = buildProviderOptionSelectionsFromDescriptors(next);
    if (input.onModelOptionsChange) {
      input.onModelOptionsChange(options);
      return;
    }
    const target = input.threadRef ?? input.draftId;
    if (!target) return;
    setProviderModelOptions(target, input.provider, options, {
      ...(input.instanceId ? { instanceId: input.instanceId } : {}),
      model: input.model,
      persistSticky: true,
    });
    // A thread's pick reaches the server now, as upstream's TraitsPicker does; a draft's waits for send.
    if (input.threadRef) void applyThreadModelPick(input.threadRef);
  };

  // Upstream's select semantics: Ultrathink is a prompt prefix, not a stored
  // option, and leaving it strips the prefix again.
  const selectOption = (descriptor: SelectDescriptor, value: string) => {
    if (descriptor.promptInjectedValues?.includes(value)) {
      input.onPromptEdit((prompt) =>
        prompt.trim().length === 0
          ? ULTRATHINK_PROMPT_PREFIX
          : applyClaudePromptEffortPrefix(prompt, "ultrathink"),
      );
      return;
    }
    const isPrimary = descriptor.id === primarySelectId;
    if (traits.ultrathinkInBodyText && isPrimary) return;
    if (traits.ultrathinkPromptControlled && isPrimary) {
      input.onPromptEdit((prompt) => prompt.replace(/^Ultrathink:\s*/i, ""));
    }
    updateDescriptors(replaceDescriptorCurrentValue(descriptors, descriptor.id, value));
  };

  return { updateDescriptors, selectOption };
}

/** The prompt says "ultrathink" in its body, so effort stays put until it is removed. */
function effortLocked(traits: Traits): boolean {
  return traits.ultrathinkInBodyText && traits.effortDescriptor?.id === traits.primarySelectId;
}

/** A section of the menu: a header ruled off above a select's values. */
function SelectSection(props: {
  title: string;
  descriptor: SelectDescriptor;
  value: string | undefined;
  disabled?: boolean;
  note?: ReactNode;
  onSelect: (optionId: string) => void;
}) {
  return (
    <>
      <div data-fork-option-menu-label="" className="px-2 pb-1 text-base text-muted-foreground">
        {props.title}
      </div>
      {props.note}
      {/* A 1px gap, so a hovered value never touches the checked one. */}
      <MenuRadioGroup
        className="grid gap-px"
        aria-label={props.title}
        value={props.value ?? null}
        onValueChange={(value: string) => {
          if (value !== props.value) props.onSelect(value);
        }}
      >
        {props.descriptor.options.map((option) => (
          <MenuRadioItem
            key={option.id}
            value={option.id}
            disabled={props.disabled}
            closeOnClick={false}
          >
            <span className="flex w-full items-center gap-3 text-base">
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.isDefault ? <span className="text-muted-foreground">Default</span> : null}
              <span className="flex size-4 shrink-0 items-center justify-center">
                <MenuRadioItemIndicator />
              </span>
            </span>
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
    </>
  );
}

/**
 * The selected model row's traits. Its value names the effort, led by an icon for each toggle
 * that is on; clicking it (or ArrowRight) opens the effort levels, any other select, and the
 * toggles as checkboxes in a menu above it, laid out like the permissions menu.
 */
function ComposerTraitsMenu(props: {
  input: ComposerModelTraitsInput;
  traits: Traits;
  /** The composer's menu: the popup joins its floating layer, like the model menu. */
  composerOwned: boolean;
  /** Opens as it mounts: the model was picked by a click on its row's effort. */
  defaultOpen?: boolean;
}) {
  const { traits } = props;
  const { descriptors, effortDescriptor: effort } = traits;
  const { updateDescriptors, selectOption } = useTraitWrites(props.input, traits);
  // Click only: a click on the value opens the menu and another closes it (hover never opens
  // it). A level pick closes it; checkboxes keep it open, so the check is seen to change.
  const [open, setOpen] = useState(props.defaultOpen === true);
  // Whether the menu was open when the press began: the menu's outside-press check can shut it on
  // pointerdown, before the click that decides. Null for a keyboard click.
  const openAtPressRef = useRef<boolean | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const locked = effortLocked(traits);
  const level = effort
    ? effort.options[
        effortStopIndex(
          effort,
          traits.ultrathinkPromptControlled && effort.id === traits.primarySelectId,
        )
      ]
    : undefined;
  const toggles = traits.rows.flatMap((descriptor) => {
    if (descriptor.type === "boolean") {
      return [
        {
          id: descriptor.id,
          label: descriptor.label,
          checked: descriptor.currentValue === true,
          set: (checked: boolean) =>
            updateDescriptors(replaceDescriptorCurrentValue(descriptors, descriptor.id, checked)),
        },
      ];
    }
    const toggle = selectToggle(descriptor);
    return toggle
      ? [
          {
            id: descriptor.id,
            label: toggle.label,
            checked: toggle.checked,
            set: (checked: boolean) => selectOption(descriptor, checked ? toggle.on : toggle.off),
          },
        ]
      : [];
  });
  const selects = traits.rows.filter(
    (descriptor): descriptor is SelectDescriptor =>
      descriptor.type === "select" && selectToggle(descriptor) === null,
  );
  const togglesOn = toggles.filter((toggle) => toggle.checked);
  const valueLabel = level?.label ?? "Options";
  const pick = (descriptor: SelectDescriptor, optionId: string) => {
    setOpen(false);
    selectOption(descriptor, optionId);
  };

  return (
    <MenuSub
      open={open}
      onOpenChange={(next, details) => {
        // Focus leaving the menu for its own value is that value's click, which decides itself;
        // closing here would let the click reopen it.
        const towards = details.event instanceof FocusEvent ? details.event.relatedTarget : null;
        if (
          !next &&
          details.reason === "focus-out" &&
          towards instanceof Node &&
          triggerRef.current?.contains(towards)
        ) {
          return;
        }
        setOpen(next);
      }}
    >
      <MenuPrimitive.SubmenuTrigger
        ref={triggerRef}
        openOnHover={false}
        aria-label={[
          `${effort ? "Effort" : "Options"}: ${valueLabel}`,
          ...togglesOn.map((toggle) => `${toggle.label} on`),
        ].join(", ")}
        // A white wash a step past the lit row's, like the pin's, while hovered or open.
        className={cn(
          EFFORT_VALUE_CLASS,
          "cursor-pointer rounded-[4px] text-foreground outline-none hover:bg-foreground/10 data-highlighted:bg-foreground/10 data-popup-open:bg-foreground/10",
        )}
        {...stopRowPick}
        // The press is ours, and the click alone toggles: Base UI opens on mousedown, so its open
        // and a click toggle landed together and shut the menu as it opened. None of it may reach
        // the row. ArrowRight still opens it through Base UI.
        onPointerDown={(event) => {
          event.stopPropagation();
          event.preventBaseUIHandler();
          openAtPressRef.current = open;
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
          event.preventBaseUIHandler();
        }}
        onClick={(event) => {
          event.stopPropagation();
          event.preventBaseUIHandler();
          // A keyboard click (detail 0) reads the live state; a press abandoned by dragging off
          // leaves a stale one behind.
          const wasOpen = event.detail === 0 ? open : (openAtPressRef.current ?? open);
          openAtPressRef.current = null;
          setOpen(!wasOpen);
        }}
      >
        {togglesOn.map((toggle) => (
          <TraitIcon key={toggle.id} id={toggle.id} className="mr-1 size-4 text-muted-foreground" />
        ))}
        <ChevronsUpDownIcon aria-hidden className="size-4 text-muted-foreground" />
        <span className="max-w-28 truncate">{valueLabel}</span>
      </MenuPrimitive.SubmenuTrigger>
      {/* Stamped like the model menu: its wheel lock and focus checks count this popup in, and in
          the composer it joins the floating layer (Glass surfaces, resting-composer focus). */}
      <MenuPopup
        side="top"
        align="center"
        sideOffset={0}
        width="content"
        data-model-picker-content="true"
        {...(props.composerOwned ? composerFloatingLayerProps : {})}
        {...stopRowEvents}
      >
        <div data-fork-option-menu="" className="grid min-w-52 gap-0.5 p-1">
          {effort ? (
            <SelectSection
              title="Effort"
              descriptor={effort}
              value={level?.id}
              disabled={locked}
              note={
                locked ? (
                  <p className="max-w-52 px-2 pb-1 text-base text-muted-foreground">
                    Remove &quot;ultrathink&quot; from your prompt to change the effort.
                  </p>
                ) : null
              }
              onSelect={(optionId) => pick(effort, optionId)}
            />
          ) : null}
          {selects.map((descriptor, index) => {
            const value = getProviderOptionCurrentValue(descriptor);
            return (
              <Fragment key={descriptor.id}>
                {effort || index > 0 ? <MenuSeparator className={SECTION_RULE_CLASS} /> : null}
                <SelectSection
                  title={descriptor.label}
                  descriptor={descriptor}
                  value={typeof value === "string" ? value : undefined}
                  onSelect={(optionId) => pick(descriptor, optionId)}
                />
              </Fragment>
            );
          })}
          {toggles.length > 0 ? (
            <>
              {effort || selects.length > 0 ? (
                <MenuSeparator className={SECTION_RULE_CLASS} />
              ) : null}
              <div className="grid gap-px">
                {toggles.map((toggle) => (
                  // The menu's own checkbox row draws its check on the left; this one keeps
                  // the row's slot (so it lights like every row) with a checkbox on the right.
                  <MenuPrimitive.CheckboxItem
                    key={toggle.id}
                    data-slot="menu-checkbox-item"
                    checked={toggle.checked}
                    closeOnClick={false}
                    onCheckedChange={(checked) => toggle.set(checked)}
                    className="flex min-h-8 cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    <TraitIcon id={toggle.id} className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{toggle.label}</span>
                    <CheckboxMark checked={toggle.checked} />
                  </MenuPrimitive.CheckboxItem>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </MenuPopup>
    </MenuSub>
  );
}

/** A saved model that is no longer listed: its options, read-only as they were saved. */
function UnavailableModelTraits(props: { traits: Traits }) {
  return (
    <div className="flex flex-col p-1">
      {props.traits.rows.map((descriptor) => {
        const value = getProviderOptionCurrentLabel(descriptor);
        return value ? (
          <div key={descriptor.id} className="flex min-h-8 items-center justify-between gap-3 px-2">
            <span className="shrink-0 text-base text-muted-foreground">{descriptor.label}</span>
            <span className="truncate text-base text-muted-foreground">{value}</span>
          </div>
        ) : null;
      })}
    </div>
  );
}

/**
 * Another model row's effort as picking it would set it: the options last used with that model
 * (what a pick restores), else the model's default.
 */
function useEffortPreview(
  instanceEntries: ComponentProps<typeof ProviderModelPicker>["instanceEntries"],
  includePlanAgent: boolean | undefined,
  onPick: (instanceId: ProviderInstanceId, model: string) => void,
) {
  const remembered = useComposerDraftStore((store) => store.stickyOptionsByModelByProvider);
  return (instanceId: ProviderInstanceId, model: string): ReactNode => {
    const entry = instanceEntries.find((candidate) => candidate.instanceId === instanceId);
    if (!entry) return null;
    const caps = getProviderModelCapabilities(
      entry.models,
      model,
      entry.driverKind,
      includePlanAgent,
    );
    const effort = findEffortDescriptor(
      getProviderOptionDescriptors({ caps, selections: remembered[instanceId]?.[model] }),
    );
    const label = effort ? getProviderOptionCurrentLabel(effort) : undefined;
    if (!label) return null;
    // The click also reaches the row, which picks the model; onPick opens its effort menu.
    return (
      <span
        className={cn(
          EFFORT_VALUE_CLASS,
          "cursor-pointer rounded-[4px] text-muted-foreground hover:bg-foreground/10",
        )}
        // A shift-click adds the model to a multi-model draft rather than picking it.
        onClick={(event) => {
          if (!event.shiftKey) onPick(instanceId, model);
        }}
      >
        <ChevronsUpDownIcon aria-hidden className="size-4" />
        <span className="max-w-28 truncate">{label}</span>
      </span>
    );
  };
}

/** The composer's model picker, carrying the reasoning controls the traits picker used to. */
export function ComposerModelPicker({
  traitsInput,
  ...pickerProps
}: Omit<ComponentProps<typeof ProviderModelPicker>, "traits" | "combined"> & {
  traitsInput: ComposerModelTraitsInput;
}) {
  const traits = resolveComposerModelTraits(traitsInput);
  // A click on another row's effort picks that model and opens its effort menu; it lasts until
  // the picker closes, so a later open starts with the menu shut.
  const [openTraitsFor, setOpenTraitsFor] = useState<{
    instanceId: ProviderInstanceId;
    model: string;
  } | null>(null);
  const rowPreview = useEffortPreview(
    pickerProps.instanceEntries,
    traitsInput.includePlanAgent,
    (instanceId, model) => setOpenTraitsFor({ instanceId, model }),
  );
  const openTraitsNow =
    openTraitsFor !== null &&
    openTraitsFor.model === traitsInput.model &&
    (traitsInput.instanceId === undefined || openTraitsFor.instanceId === traitsInput.instanceId);
  return (
    <ProviderModelPicker
      {...pickerProps}
      rowPreview={rowPreview}
      onInstanceModelChange={(instanceId, model) => {
        // Only the pick a preview's click asked for opens its menu; any other pick clears it.
        setOpenTraitsFor((current) =>
          current?.instanceId === instanceId && current.model === model ? current : null,
        );
        pickerProps.onInstanceModelChange(instanceId, model);
      }}
      onOpenChange={(open) => {
        if (!open) setOpenTraitsFor(null);
        pickerProps.onOpenChange?.(open);
      }}
      combined
      {...(traits
        ? {
            traits: {
              label: traits.trigger.label,
              ...(traits.modelIsUnavailable
                ? { panel: <UnavailableModelTraits traits={traits} /> }
                : {
                    selectedRowControl: (
                      <ComposerTraitsMenu
                        input={traitsInput}
                        traits={traits}
                        composerOwned={pickerProps.isComposerOwned === true}
                        defaultOpen={openTraitsNow}
                      />
                    ),
                  }),
            },
          }
        : {})}
    />
  );
}
