/**
 * The composer's single model-and-reasoning menu — see
 * `.fork/customizations.yaml#fork-model-picker`.
 *
 * Wraps ProviderModelPicker and hands it the reasoning half. The selected model's row carries a
 * plain button naming its effort ("⇕ High", led by an icon per toggle that is on); a click opens
 * the effort menu above it with the levels, any other select, and the toggles as checkbox rows.
 * That menu is a submenu of the model menu rendered outside every row (the picker's `layer`) and
 * anchored to the button, so no row has to know about it. Other rows preview the effort a pick
 * would set. Writes go to the same draft-store options, with the same Ultrathink prompt prefix, as
 * upstream's traits picker. Controlled editors supply their own options callback so scheduled
 * tasks can reuse the menu without a conversation draft.
 */
import type { ProviderInstanceId, ProviderOptionDescriptor } from "@t3tools/contracts";
import {
  applyClaudePromptEffortPrefix,
  buildProviderOptionSelectionsFromDescriptors,
  getProviderOptionCurrentLabel,
  getProviderOptionCurrentValue,
  getProviderOptionDescriptors,
} from "@t3tools/shared/model";
import { ChevronsUpDownIcon } from "lucide-react";
import {
  type ComponentProps,
  Fragment,
  type MouseEvent,
  type ReactNode,
  type Ref,
  useState,
} from "react";

// Through the alias: a relative import type-checks against upstream's module,
// not the shadow that adds `traits` and `combined`.
import { ProviderModelPicker } from "~/components/chat/ProviderModelPicker";
import { useApplyThreadModelPick } from "~/components/chat/useApplyThreadModelPick";
import { composerFloatingLayerProps } from "../components/chat/composerEventScope";
import { CheckboxMark } from "../components/ui/checkbox";
import {
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuSeparator,
  MenuSub,
} from "../components/ui/menu";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { useComposerDraftStore } from "../composerDraftStore";
import { getProviderModelCapabilities } from "../providerModels";
import { cn } from "~/lib/utils";
import {
  type ComposerModelTraits,
  type ComposerModelTraitsInput,
  type SelectDescriptor,
  type TraitToggle,
  findEffortDescriptor,
  resolveComposerModelTraits,
} from "./composerModelTraits";
import { resolvePickOptions } from "./pickOptions";
import { TRAIT_PRESENTATION } from "./traitPresentation";

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

function TraitIcon(props: { id: string; className: string }) {
  const Icon = TRAIT_PRESENTATION[props.id]?.icon;
  return Icon ? <Icon aria-hidden className={props.className} /> : null;
}

/** A value on a model row, laid out the same on the selected row and in previews. */
const EFFORT_VALUE_CLASS =
  "flex h-6 shrink-0 cursor-pointer items-center gap-0.5 rounded-[4px] px-1 text-base outline-none hover:bg-foreground/10";
/** Rules a section off edge to edge, through the popup's and the menu's 4px insets. */
const SECTION_RULE_CLASS = "-mx-2 my-1";

/**
 * A button inside a model row: its press and click stay off the row (which picks on click, and on
 * release after a drag), and a mousedown never moves focus, so a press on it never reads as
 * focus leaving its open menu.
 */
const rowButtonProps = {
  type: "button" as const,
  tabIndex: -1,
  onPointerDown: (event: { stopPropagation: () => void }) => event.stopPropagation(),
  onPointerUp: (event: { stopPropagation: () => void }) => event.stopPropagation(),
  onMouseUp: (event: { stopPropagation: () => void }) => event.stopPropagation(),
  onMouseDown: (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  },
};

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

  const setToggle = (toggle: TraitToggle, checked: boolean) => {
    if (toggle.values && toggle.descriptor.type === "select") {
      selectOption(toggle.descriptor, checked ? toggle.values.on : toggle.values.off);
      return;
    }
    updateDescriptors(replaceDescriptorCurrentValue(descriptors, toggle.descriptor.id, checked));
  };

  return { selectOption, setToggle };
}

/** A section of the menu: a header ruled off above a select's values. */
function SelectSection(props: {
  title: string;
  descriptor: SelectDescriptor;
  value: string | undefined;
  disabled?: boolean;
  note?: ReactNode;
  /** Every click, the checked value's too: a click on a value always closes the menu. */
  onChoose: (optionId: string) => void;
}) {
  return (
    <>
      <div data-fork-option-menu-label="" className="px-2 pb-1 text-base text-muted-foreground">
        {props.title}
      </div>
      {props.note}
      {/* A 1px gap, so a hovered value never touches the checked one. */}
      <MenuRadioGroup className="grid gap-px" aria-label={props.title} value={props.value ?? null}>
        {props.descriptor.options.map((option) => (
          <MenuRadioItem
            key={option.id}
            value={option.id}
            disabled={props.disabled}
            closeOnClick={false}
            onClick={() => props.onChoose(option.id)}
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

/** The selected row's value: its effort, led by the icon of each toggle that is on. */
function EffortValue({
  ref,
  traits,
  open,
  onToggle,
}: {
  traits: Traits;
  open: boolean;
  onToggle: () => void;
  ref: Ref<HTMLButtonElement>;
}) {
  const togglesOn = traits.toggles.filter((toggle) => toggle.checked);
  const valueLabel = traits.effort?.level?.label ?? "Options";
  return (
    <button
      {...rowButtonProps}
      ref={ref}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={[
        `${traits.effort ? "Effort" : "Options"}: ${valueLabel}`,
        ...togglesOn.map((toggle) => `${toggle.label} on`),
      ].join(", ")}
      {...(open ? { "data-open": "" } : {})}
      // A white wash a step past the lit row's, like the pin's, while hovered or open.
      className={cn(EFFORT_VALUE_CLASS, "text-foreground data-open:bg-foreground/10")}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {togglesOn.map((toggle) => (
        <TraitIcon
          key={toggle.descriptor.id}
          id={toggle.descriptor.id}
          className="mr-1 size-4 text-muted-foreground"
        />
      ))}
      <ChevronsUpDownIcon aria-hidden className="size-4 text-muted-foreground" />
      <span className="max-w-28 truncate">{valueLabel}</span>
    </button>
  );
}

/** Another row's effort as a pick would set it; a click picks that model and opens its menu. */
function EffortPreview(props: { label: string; onPickAndOpen: () => void }) {
  return (
    <button
      {...rowButtonProps}
      aria-label={`Pick with effort ${props.label}`}
      className={cn(EFFORT_VALUE_CLASS, "text-muted-foreground")}
      onClick={(event) => {
        // A shift-click adds the model to a multi-model draft: the row handles that.
        if (event.shiftKey) return;
        event.stopPropagation();
        props.onPickAndOpen();
      }}
    >
      <ChevronsUpDownIcon aria-hidden className="size-4" />
      <span className="max-w-28 truncate">{props.label}</span>
    </button>
  );
}

/**
 * The effort menu, laid out like the permissions menu: the levels under an "Effort" header, any
 * other select as its own section, then the toggles as checkbox rows.
 */
function EffortMenu(props: {
  input: ComposerModelTraitsInput;
  traits: Traits;
  anchor: HTMLButtonElement | null;
  open: boolean;
  onClose: () => void;
  composerOwned: boolean;
}) {
  const { traits, anchor } = props;
  const { effort, selects, toggles } = traits;
  const { selectOption, setToggle } = useTraitWrites(props.input, traits);
  // A value click closes the menu (and writes when it changes the value); a checkbox keeps it
  // open, so the check is seen to change.
  const choose = (descriptor: SelectDescriptor, current: string | undefined, optionId: string) => {
    props.onClose();
    if (optionId !== current) selectOption(descriptor, optionId);
  };

  return (
    <MenuSub
      open={props.open && anchor !== null}
      onOpenChange={(next, details) => {
        // A press on the value is its own click, which toggles the menu itself.
        const target = details.event?.target;
        if (!next && target instanceof Node && anchor?.contains(target)) return;
        if (!next) props.onClose();
      }}
    >
      {/* Stamped like the model menu: its wheel lock and focus checks count this popup in, and in
          the composer it joins the floating layer (Glass surfaces, resting-composer focus). */}
      <MenuPopup
        anchor={anchor}
        side="top"
        align="center"
        sideOffset={4}
        width="content"
        data-model-picker-content="true"
        {...(props.composerOwned ? composerFloatingLayerProps : {})}
      >
        <div data-fork-option-menu="" className="grid min-w-52 gap-0.5 p-1">
          {effort ? (
            <SelectSection
              title="Effort"
              descriptor={effort.descriptor}
              value={effort.level?.id}
              disabled={effort.locked}
              note={
                effort.locked ? (
                  <p className="max-w-52 px-2 pb-1 text-base text-muted-foreground">
                    Remove &quot;ultrathink&quot; from your prompt to change the effort.
                  </p>
                ) : null
              }
              onChoose={(optionId) => choose(effort.descriptor, effort.level?.id, optionId)}
            />
          ) : null}
          {selects.map((descriptor, index) => {
            const current = getProviderOptionCurrentValue(descriptor);
            const value = typeof current === "string" ? current : undefined;
            return (
              <Fragment key={descriptor.id}>
                {effort || index > 0 ? <MenuSeparator className={SECTION_RULE_CLASS} /> : null}
                <SelectSection
                  title={descriptor.label}
                  descriptor={descriptor}
                  value={value}
                  onChoose={(optionId) => choose(descriptor, value, optionId)}
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
                    key={toggle.descriptor.id}
                    data-slot="menu-checkbox-item"
                    checked={toggle.checked}
                    closeOnClick={false}
                    onCheckedChange={(checked) => setToggle(toggle, checked)}
                    className="flex min-h-8 cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    <TraitIcon
                      id={toggle.descriptor.id}
                      className="size-4 shrink-0 text-muted-foreground"
                    />
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
      {props.traits.savedRows.map((descriptor) => {
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
 * Another model's effort as picking it would set it, by the pick's own rule (resolvePickOptions):
 * the options last used with that model, else the thread's own when it is the thread's model,
 * else the model's default.
 */
function useEffortPreview(
  instanceEntries: ComponentProps<typeof ProviderModelPicker>["instanceEntries"],
  input: ComposerModelTraitsInput,
) {
  const sticky = useComposerDraftStore((store) => store.stickyOptionsByModelByProvider);
  // A controlled editor (scheduled tasks) gives a picked model its defaults, not the composer's
  // remembered options.
  const remembered = input.onModelOptionsChange ? undefined : sticky;
  // Every row asks; one pass builds a slug lookup per provider instead of a scan per row.
  const byInstance = new Map(
    instanceEntries.map((entry) => [
      entry.instanceId,
      { entry, models: new Map(entry.models.map((model) => [model.slug, model])) },
    ]),
  );
  return (instanceId: ProviderInstanceId, model: string): string | null => {
    const known = byInstance.get(instanceId);
    const found = known?.models.get(model);
    if (!known || !found) return null;
    const entry = known.entry;
    const caps = getProviderModelCapabilities(
      [found],
      model,
      entry.driverKind,
      input.includePlanAgent,
    );
    const thread = input.threadModelSelection;
    const selections = resolvePickOptions({
      remembered: remembered?.[instanceId]?.[model],
      threadOptions:
        thread?.instanceId === instanceId && thread.model === model ? thread.options : undefined,
    });
    const effort = findEffortDescriptor(getProviderOptionDescriptors({ caps, selections }));
    return (effort ? getProviderOptionCurrentLabel(effort) : undefined) ?? null;
  };
}

/** The composer's model picker, carrying the reasoning controls the traits picker used to. */
export function ComposerModelPicker({
  traitsInput,
  ...pickerProps
}: Omit<ComponentProps<typeof ProviderModelPicker>, "traits" | "combined" | "renderRowControl"> & {
  traitsInput: ComposerModelTraitsInput;
}) {
  const traits = resolveComposerModelTraits(traitsInput);
  const previewEffort = useEffortPreview(pickerProps.instanceEntries, traitsInput);
  // The model whose effort menu is open, so a pick of another model closes it on its own, and a
  // click on another row's preview opens it for the model that click picks.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const currentKey = `${pickerProps.activeInstanceId}:${pickerProps.model}`;
  const menuTraits =
    traits &&
    !traits.modelIsUnavailable &&
    (traits.effort || traits.toggles.length > 0 || traits.selects.length > 0)
      ? traits
      : null;
  const open = menuTraits !== null && openFor === currentKey;

  return (
    <ProviderModelPicker
      {...pickerProps}
      onOpenChange={(pickerOpen) => {
        if (!pickerOpen) setOpenFor(null);
        pickerProps.onOpenChange?.(pickerOpen);
      }}
      combined
      renderRowControl={(model, { selected, pick }) => {
        if (selected) {
          return menuTraits ? (
            <EffortValue
              ref={setAnchor}
              traits={menuTraits}
              open={open}
              onToggle={() => setOpenFor((current) => (current === currentKey ? null : currentKey))}
            />
          ) : null;
        }
        const label = previewEffort(model.instanceId, model.slug);
        return label ? (
          <EffortPreview
            label={label}
            onPickAndOpen={() => {
              pick();
              setOpenFor(`${model.instanceId}:${model.slug}`);
            }}
          />
        ) : null;
      }}
      {...(traits
        ? {
            traits: {
              label: traits.trigger.label,
              ...(traits.modelIsUnavailable
                ? { panel: <UnavailableModelTraits traits={traits} /> }
                : menuTraits
                  ? {
                      layer: (
                        <EffortMenu
                          input={traitsInput}
                          traits={menuTraits}
                          anchor={anchor}
                          open={open}
                          onClose={() => setOpenFor(null)}
                          composerOwned={pickerProps.isComposerOwned === true}
                        />
                      ),
                    }
                  : {}),
            },
          }
        : {})}
    />
  );
}
