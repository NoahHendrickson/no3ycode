/**
 * The composer's single model-and-reasoning menu — see
 * `.fork/customizations.yaml#fork-model-picker`.
 *
 * Wraps ProviderModelPicker and hands it the reasoning half: a panel under
 * the model list where effort is a slider over the model's own levels, and
 * every other trait keeps a compact control (a checkbox for on/off traits,
 * segments for the rest). The trigger reads "Opus 5.5 High". Writes go to the
 * same draft-store options, with the same Ultrathink prompt prefix, as
 * upstream's traits picker. Controlled editors supply their own options
 * callback so scheduled tasks can reuse the menu without a conversation draft.
 */
import type { ProviderOptionDescriptor } from "@t3tools/contracts";
import {
  applyClaudePromptEffortPrefix,
  buildProviderOptionSelectionsFromDescriptors,
  getProviderOptionCurrentLabel,
  getProviderOptionCurrentValue,
} from "@t3tools/shared/model";
import { Slider } from "@base-ui/react/slider";
import { type ComponentProps, type KeyboardEvent, type ReactNode, useId, useState } from "react";

// Through the alias: a relative import type-checks against upstream's module,
// not the shadow that adds `traits` and `combined`.
import { ProviderModelPicker } from "~/components/chat/ProviderModelPicker";
import { useApplyThreadModelPick } from "~/components/chat/useApplyThreadModelPick";
import { Checkbox } from "../components/ui/checkbox";
import { useComposerDraftStore } from "../composerDraftStore";
import { cn } from "~/lib/utils";
import {
  type ComposerModelTraits,
  type ComposerModelTraitsInput,
  type SelectDescriptor,
  effortStopIndex,
  orderTraitRows,
  resolveComposerModelTraits,
} from "./composerModelTraits";

const ULTRATHINK_PROMPT_PREFIX = "Ultrathink:\n";
/**
 * The thumb's width, a variable on the track so a palette can widen the thumb (Inlet does). Edge
 * alignment keeps half of it inside the track, so the stops inset by as much to sit under it.
 */
const THUMB_WIDTH = "var(--fork-effort-thumb-width)";

/** An n x n Bayer matrix, n a power of two: the order its cells turn on as the level rises. */
function bayerMatrix(size: number): ReadonlyArray<ReadonlyArray<number>> {
  if (size === 1) return [[0]];
  const half = size / 2;
  const inner = bayerMatrix(half);
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const quadrant = [0, 2, 3, 1][(y < half ? 0 : 2) + (x < half ? 0 : 1)] ?? 0;
      return (inner[y % half]?.[x % half] ?? 0) * 4 + quadrant;
    }),
  );
}

const DITHER_SIZE = 8;
/** Each dither cell's side, in CSS pixels. */
const DITHER_CELL = 2;
/** One path per level: the cells lit at that level, the first lighting one cell, the last all. */
const DITHER_LEVEL_PATHS = (() => {
  const matrix = bayerMatrix(DITHER_SIZE);
  return Array.from({ length: DITHER_SIZE * DITHER_SIZE }, (_, level) =>
    matrix
      .flatMap((row, y) =>
        row.map((rank, x) =>
          rank > level
            ? ""
            : `M${x * DITHER_CELL} ${y * DITHER_CELL}h${DITHER_CELL}v${DITHER_CELL}h-${DITHER_CELL}z`,
        ),
      )
      .join(""),
  );
})();

/** The effort fill's colours from the track's start to the thumb, by provider: its brand colour,
    Antigravity's arch, and Grok's and Cursor's black and white. Any other provider's runs from
    the done blue to the working green. */
const EFFORT_DITHER_STOPS: Readonly<Record<string, ReadonlyArray<string>>> = {
  claudeAgent: ["#8f3f26", "#d97757", "#f3b38e"],
  codex: ["#3d36b8", "#8680ff"],
  antigravity: ["#f43f7f", "#4285f4", "#1ee36e"],
  grok: ["#ffffff", "#000000"],
  cursor: ["#ffffff", "#000000"],
};
const DEFAULT_EFFORT_DITHER_STOPS = [
  "var(--sidebar-v2-status-done)",
  "var(--sidebar-v2-status-working)",
];

function effortDitherStops(driver: string): ReadonlyArray<string> {
  return EFFORT_DITHER_STOPS[driver] ?? DEFAULT_EFFORT_DITHER_STOPS;
}

/** The fill as an ordered dither through `stops`: each span lays a colour and thickens the next
    over it one band per level, the last solid at the middle of the thumb, so no fill shows past
    the thumb's rounded corners. Static, so the fill's width is all that moves. */
function EffortDither(props: { readonly stops: ReadonlyArray<string> }) {
  const id = `fork-effort-dither${useId().replace(/[^\w-]/g, "")}`;
  const spans = props.stops.slice(1).map((ink, span) => ({ ink, under: props.stops[span] ?? ink }));
  const bands = spans.length * DITHER_LEVEL_PATHS.length;
  return (
    <svg
      aria-hidden
      data-fork-effort-dither=""
      className="absolute inset-y-0 left-0 h-full w-[calc(100%-var(--fork-effort-thumb-width)/2)]"
      shapeRendering="crispEdges"
    >
      <defs>
        {spans.map(({ ink, under }, span) => (
          // Pattern content takes its paint from the pattern's ancestors, not the shape it fills.
          <g key={`${under}>${ink}`} style={{ fill: ink }}>
            {DITHER_LEVEL_PATHS.map((path, level) => (
              <pattern
                key={path}
                id={`${id}-${span}-${level}`}
                width={DITHER_SIZE * DITHER_CELL}
                height={DITHER_SIZE * DITHER_CELL}
                patternUnits="userSpaceOnUse"
              >
                <path d={path} />
              </pattern>
            ))}
          </g>
        ))}
      </defs>
      {spans.map(({ ink, under }, span) => (
        <g key={`${under}>${ink}`}>
          <rect
            x={`${(span / spans.length) * 100}%`}
            width={`${100 / spans.length}%`}
            height="100%"
            style={{ fill: under }}
          />
          {DITHER_LEVEL_PATHS.map((path, level) => (
            <rect
              key={path}
              x={`${((span * DITHER_LEVEL_PATHS.length + level) / bands) * 100}%`}
              width={`${100 / bands}%`}
              height="100%"
              fill={`url(#${id}-${span}-${level})`}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

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

/**
 * The slider, checkboxes and segments read their own keys. Escape and Tab
 * still reach the menu, so it can close and move focus.
 */
function keepKeysInPanel(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Escape" && event.key !== "Tab") event.stopPropagation();
}

/** A labelled row; as a `<label>`, a click anywhere on it toggles its checkbox. */
function TraitRow(props: { label: string; children: ReactNode; asLabel?: boolean }) {
  const Row = props.asLabel ? "label" : "div";
  return (
    <Row
      className={cn(
        "flex min-h-8 items-center justify-between gap-3 px-2",
        props.asLabel && "cursor-pointer",
      )}
    >
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{props.label}</span>
      {props.children}
    </Row>
  );
}

function EffortSlider(props: {
  descriptor: SelectDescriptor;
  /** The provider's driver, whose colours the fill takes. */
  driver: string;
  committedIndex: number;
  disabled: boolean;
  onCommit: (optionId: string) => void;
}) {
  const { descriptor, committedIndex } = props;
  // Dragging previews locally and writes once on release, so sweeping past
  // Ultrathink doesn't rewrite the prompt at every stop.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Base UI marks a plain click as dragging too, so only the change reason
  // tells a press or arrow key (glide to the stop) from a drag (follow the finger).
  const [glide, setGlide] = useState(false);
  const index = dragIndex ?? committedIndex;
  const option = descriptor.options[index];
  const lastIndex = descriptor.options.length - 1;
  const glideClass =
    glide && "duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";

  return (
    <div className="flex flex-col gap-1.5 px-2 pt-1.5 pb-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-muted-foreground">{descriptor.label}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          {option?.isDefault ? <span className="text-muted-foreground">Default</span> : null}
          <span className="truncate font-medium text-foreground">{option?.label}</span>
        </span>
      </div>
      <Slider.Root
        value={index}
        min={0}
        max={lastIndex}
        step={1}
        thumbAlignment="edge"
        disabled={props.disabled}
        onValueChange={(value, details) => {
          setGlide(details.reason !== "drag");
          setDragIndex(value);
        }}
        onValueCommitted={(value) => {
          setDragIndex(null);
          const next = descriptor.options[value];
          if (next && value !== committedIndex) props.onCommit(next.id);
        }}
      >
        <Slider.Control
          data-fork-effort-control
          className="flex h-6 w-full touch-none items-center select-none data-disabled:opacity-64"
        >
          {/* A 24px bar with a block thumb of the same height. The fill runs
              from the start under the whole thumb; the stops are dots, and the
              model's default level is a short bar. */}
          <Slider.Track
            data-fork-effort-track
            className="relative h-6 w-full rounded-[6px] bg-foreground/8 [--fork-effort-thumb-width:20px]"
          >
            <div
              data-fork-effort-fill
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-[6px]",
                glideClass && ["transition-[width]", glideClass],
              )}
              style={{
                width: `calc(${THUMB_WIDTH} + ${index / lastIndex} * (100% - ${THUMB_WIDTH}))`,
              }}
            >
              <EffortDither stops={effortDitherStops(props.driver)} />
            </div>
            <div
              className="pointer-events-none absolute inset-y-0"
              style={{ insetInline: `calc(${THUMB_WIDTH} / 2)` }}
            >
              {descriptor.options.map((stop, stopIndex) => (
                <span
                  key={stop.id}
                  className={cn(
                    "absolute top-1/2 -translate-1/2 rounded-full",
                    stop.isDefault ? "h-2.5 w-0.5" : "size-1",
                    "bg-foreground/35",
                    // Only the stops ahead of the thumb: the fill covers the rest.
                    stopIndex <= index && "invisible",
                  )}
                  style={{ left: `${(stopIndex / lastIndex) * 100}%` }}
                />
              ))}
            </div>
            <Slider.Thumb
              aria-label={descriptor.label}
              getAriaValueText={() => option?.label ?? ""}
              data-fork-effort-thumb
              className={cn(
                "h-6 w-(--fork-effort-thumb-width) rounded-[6px] bg-background shadow-sm dark:bg-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
                glideClass && ["transition-[inset-inline-start]", glideClass],
              )}
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}

/** Styled like ui/toggle-group's segmented variant, so Glass's --input wash applies. */
function SegmentedTrait(props: {
  descriptor: SelectDescriptor;
  onSelect: (optionId: string) => void;
}) {
  const current = getProviderOptionCurrentValue(props.descriptor);
  return (
    <div
      data-fork-segmented-trait=""
      className="flex min-w-0 flex-wrap justify-end gap-0.5 rounded-[6px] bg-input/40 p-0.5"
    >
      {props.descriptor.options.map((option) => {
        const selected = option.id === current;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            className={cn(
              "h-6 cursor-pointer rounded-[4px] px-2 text-xs font-medium text-muted-foreground hover:text-foreground",
              selected && "bg-background text-foreground shadow-xs/10 dark:bg-input/72",
            )}
            onClick={() => props.onSelect(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ComposerModelTraitsPanel(props: {
  input: ComposerModelTraitsInput;
  traits: NonNullable<ComposerModelTraits>;
}) {
  const { input, traits } = props;
  const { descriptors, effortDescriptor, primarySelectId } = traits;
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

  if (traits.modelIsUnavailable) {
    return (
      <div className="flex flex-col p-1" onKeyDown={keepKeysInPanel}>
        {orderTraitRows(descriptors, null).map((descriptor) => {
          const value = getProviderOptionCurrentLabel(descriptor);
          return value ? (
            <TraitRow key={descriptor.id} label={descriptor.label}>
              <span className="truncate text-xs text-muted-foreground">{value}</span>
            </TraitRow>
          ) : null;
        })}
      </div>
    );
  }

  const effortLocked = traits.ultrathinkInBodyText && effortDescriptor?.id === primarySelectId;

  return (
    <div className="flex flex-col p-1" data-fork-model-traits="true" onKeyDown={keepKeysInPanel}>
      {effortDescriptor ? (
        <>
          <EffortSlider
            descriptor={effortDescriptor}
            driver={input.provider}
            committedIndex={effortStopIndex(
              effortDescriptor,
              traits.ultrathinkPromptControlled && effortDescriptor.id === primarySelectId,
            )}
            disabled={effortLocked}
            onCommit={(optionId) => selectOption(effortDescriptor, optionId)}
          />
          {effortLocked ? (
            <p className="px-2 pb-1.5 text-xs text-muted-foreground">
              Your prompt contains &quot;ultrathink&quot; in the text. Remove it to change this
              option.
            </p>
          ) : null}
        </>
      ) : null}
      {orderTraitRows(descriptors, effortDescriptor).map((descriptor) => {
        if (descriptor.type === "boolean") {
          return (
            <TraitRow key={descriptor.id} label={descriptor.label} asLabel>
              <Checkbox
                checked={descriptor.currentValue === true}
                onCheckedChange={(checked) =>
                  updateDescriptors(
                    replaceDescriptorCurrentValue(descriptors, descriptor.id, checked),
                  )
                }
              />
            </TraitRow>
          );
        }
        return (
          <TraitRow key={descriptor.id} label={descriptor.label}>
            <SegmentedTrait
              descriptor={descriptor}
              onSelect={(optionId) => selectOption(descriptor, optionId)}
            />
          </TraitRow>
        );
      })}
    </div>
  );
}

/** The composer's model picker, carrying the reasoning controls the traits picker used to. */
export function ComposerModelPicker({
  traitsInput,
  ...pickerProps
}: Omit<ComponentProps<typeof ProviderModelPicker>, "traits" | "combined"> & {
  traitsInput: ComposerModelTraitsInput;
}) {
  const traits = resolveComposerModelTraits(traitsInput);
  return (
    <ProviderModelPicker
      {...pickerProps}
      combined
      {...(traits
        ? {
            traits: {
              label: traits.trigger.label,
              panel: <ComposerModelTraitsPanel input={traitsInput} traits={traits} />,
            },
          }
        : {})}
    />
  );
}
