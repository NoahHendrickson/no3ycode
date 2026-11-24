/**
 * The no3y iPhone model picker: a half-height sheet with a close button and a Favorites/provider
 * select, and the models for that choice, the selected one carrying its reasoning level — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. It drives the thread settings session the
 * upstream picker uses (ThreadSettingsSheet.tsx), so picks, favorites and options save the same way.
 */
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import SlidersHorizontalIcon from "@hugeicons/core-free-icons/SlidersHorizontalIcon";
import StarIcon from "@hugeicons/core-free-icons/StarIcon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";
import { isReasoningSelect } from "@t3tools/client-runtime/model-traits";
import type { ModelSelection, ProviderOptionDescriptor, RuntimeMode } from "@t3tools/contracts";
import { getProviderOptionCurrentValue } from "@t3tools/shared/model";
import * as Haptics from "expo-haptics";
import type { MenuAction } from "@react-native-menu/menu";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import type { RuntimeModeChoice } from "../src/features/threads/thread-settings-options";
import type { ModelOption, ProviderGroup } from "../src/lib/modelOptions";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { effortLevelAt, effortStopX } from "./effortSlider";
import { HugeIcon } from "./HugeIcon";
import { No3yAccessIcon, No3yAccessMenu } from "./No3yAccess";
import { No3yProviderMark } from "./No3yProviderMark";
import { No3yCircleButton } from "./No3yControls";
import { No3yGlassLayer } from "./No3yGlass";
import { No3yGlassMenuButton } from "./No3yGlassMenuButton";
import { NO3Y_IPHONE } from "./no3yIphone";
import { no3ySheetBackground } from "./no3ySheet";

/** iPhone gets this picker in a half sheet; iPad and Android keep the full thread settings sheet. */
export const NO3Y_MODEL_SHEET = NO3Y_IPHONE;

type SelectDescriptor = Extract<ProviderOptionDescriptor, { type: "select" }>;

/** The parts of the thread settings session the picker reads and drives. */
export interface No3yModelPickerSession {
  readonly providerGroups: ReadonlyArray<ProviderGroup>;
  /** Also picks the provider whose workspace models the session scans for this folder. */
  readonly providerFilter: string | null;
  readonly setProviderFilter: (providerKey: string | null) => void;
  readonly favoriteKeys: ReadonlySet<string>;
  readonly favoritesLoaded: boolean;
  readonly toggleFavorite: (option: ModelOption) => void;
  readonly displayedDescriptors: ReadonlyArray<ProviderOptionDescriptor>;
  readonly displayedModelSelection: ModelSelection | null;
  readonly reportedModelSelection: ModelSelection | null;
  readonly promptTraits: {
    readonly primarySelectDescriptor: ProviderOptionDescriptor | null;
    readonly ultrathinkPromptControlled: boolean;
    readonly ultrathinkInBodyText: boolean;
  };
  readonly isDisplayed: (option: ModelOption) => boolean;
  readonly pressModel: (option: ModelOption) => void;
  readonly commitPendingModel: () => boolean;
  readonly applyOptionChange: (id: string, value: string | boolean) => void;
  readonly runtimeMode: RuntimeMode;
  readonly runtimeModeChoices: ReadonlyArray<RuntimeModeChoice>;
  readonly onUpdateRuntimeMode: (mode: RuntimeMode) => void;
}

const FAVORITES = "@favorites";

/** The models a choice lists: favorites across providers, or one provider's current models. */
function modelsFor(
  session: No3yModelPickerSession,
  choice: string,
): ReadonlyArray<{ readonly option: ModelOption; readonly providerLabel: string }> {
  return session.providerGroups.flatMap((group) =>
    choice !== FAVORITES && group.providerKey !== choice
      ? []
      : group.models
          .filter((option) =>
            choice === FAVORITES
              ? session.favoriteKeys.has(option.key)
              : !option.isLegacy ||
                session.isDisplayed(option) ||
                session.favoriteKeys.has(option.key),
          )
          .map((option) => ({ option, providerLabel: group.providerLabel })),
  );
}

function effortStopIndex(descriptor: SelectDescriptor, ultrathinkActive: boolean): number {
  const value = ultrathinkActive ? "ultrathink" : getProviderOptionCurrentValue(descriptor);
  const index = descriptor.options.findIndex((option) => option.id === value);
  if (index >= 0) return index;
  return Math.max(
    0,
    descriptor.options.findIndex((option) => option.isDefault),
  );
}

const ROW_HEIGHT = 52;
/** The tick's slot at the row's end, which becomes the meter's save button. */
const TRAILING_SIZE = 40;
const ROW_PADDING_LEFT = 14;
const ROW_PADDING_RIGHT = 6;
/** The open meter takes the row's whole height and width, short of the save button. */
const METER_RIGHT = ROW_PADDING_RIGHT + TRAILING_SIZE + 6;
const KNOB_INSET = 4;
const KNOB_SIZE = ROW_HEIGHT - KNOB_INSET * 2;
const DOT_SIZE = 4;
const CHIP_HEIGHT = 30;
/** Room under the open meter for its level names; the rows below move down by this much. */
const LABEL_SPACE = 24;
const LABEL_WIDTH = 76;
/** Each row below starts moving this share of the meter's animation after the one above it. */
const PUSH_STAGGER = 0.08;
const PUSH_STAGGER_MAX = 0.4;
const METER_TIMING = {
  duration: 240,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
} as const;

/** A row of the list, moved down out of the open meter's way `order` rows below it. */
function PushedRow(props: {
  readonly meter: SharedValue<number>;
  readonly order: number;
  readonly children: ReactNode;
}) {
  const { meter, order } = props;
  const style = useAnimatedStyle(() => {
    if (order <= 0) return { transform: [{ translateY: 0 }] };
    const start = Math.min(PUSH_STAGGER_MAX, (order - 1) * PUSH_STAGGER);
    const progress = Math.min(1, Math.max(0, (meter.get() - start) / (1 - start)));
    return { transform: [{ translateY: progress * LABEL_SPACE }] };
  });
  return <Animated.View style={style}>{props.children}</Animated.View>;
}

function RowLead(props: {
  readonly palette: FlatGlassPalette;
  readonly option: ModelOption;
  readonly favorite: boolean;
}) {
  const { palette, option } = props;
  return (
    <>
      <No3yProviderMark
        iconUrl={option.providerIconUrl}
        provider={option.providerDriver}
        size={20}
      />
      <Text
        numberOfLines={1}
        style={{ ...NO3Y_FONT.regular, flex: 1, fontSize: 17, color: palette.foreground }}
      >
        {option.label}
      </Text>
      {props.favorite ? (
        <HugeIcon icon={StarIcon} size={14} color={palette.statusAttention} filled />
      ) : null}
    </>
  );
}

interface ModelRowProps {
  readonly palette: FlatGlassPalette;
  readonly option: ModelOption;
  readonly providerLabel: string;
  readonly selected: boolean;
  readonly favorite: boolean;
  /** A star marks favorites in a provider's list; the Favorites list needs none. */
  readonly showFavorite: boolean;
  readonly onPress: () => void;
  readonly onLongPress: () => void;
}

function rowAccessibility(props: ModelRowProps) {
  return {
    accessibilityRole: "button" as const,
    accessibilityLabel: [
      props.option.label,
      props.providerLabel,
      props.favorite ? "Favorite" : null,
    ]
      .filter(Boolean)
      .join(", "),
    accessibilityHint: "Long-press to add or remove a favorite",
  };
}

function ModelRow(props: ModelRowProps) {
  const { palette, option } = props;
  return (
    <Pressable
      {...rowAccessibility(props)}
      accessibilityState={{ selected: props.selected, disabled: option.isUnavailable === true }}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      style={({ pressed }) => ({
        height: ROW_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingLeft: ROW_PADDING_LEFT,
        paddingRight: ROW_PADDING_RIGHT,
        borderRadius: 12,
        backgroundColor: props.selected
          ? palette.rowSelected
          : pressed
            ? palette.rowPressed
            : "transparent",
        opacity: option.isUnavailable ? 0.45 : 1,
      })}
    >
      <RowLead palette={palette} option={option} favorite={props.showFavorite && props.favorite} />
      <View
        style={{
          width: TRAILING_SIZE,
          height: TRAILING_SIZE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {props.selected ? (
          <HugeIcon icon={Tick02Icon} size={18} color={palette.foreground} />
        ) : null}
      </View>
    </Pressable>
  );
}

function levelLabel(option: SelectDescriptor["options"][number] | undefined) {
  return option?.isDefault ? `${option.label} · Default` : (option?.label ?? "");
}

/**
 * The selected model's row, with its reasoning level as a chip before the tick. Tapping the chip
 * grows it into a pill slider that takes over the row: a dot per level, a white fill and a glass
 * knob with its level named beneath, the rows below stepping down to make room. Taps jump, drags
 * snap with a haptic tick, and the tick becomes a save button that shrinks it back.
 */
function ReasoningModelRow(
  props: ModelRowProps & {
    readonly descriptor: SelectDescriptor;
    readonly committedIndex: number;
    readonly disabled: boolean;
    /** 0 while the chip rests, 1 while the meter is open; the picker drives it. */
    readonly meter: SharedValue<number>;
    readonly editing: boolean;
    readonly onOpen: () => void;
    readonly onSave: (optionId: string | null) => void;
  },
) {
  const { palette, option, descriptor, meter } = props;
  const [rowWidth, setRowWidth] = useState(0);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const rowWidthValue = useSharedValue(0);
  const chip = useSharedValue({ x: 0, y: 0, width: 0, height: CHIP_HEIGHT });
  const lastIndex = descriptor.options.length - 1;
  const index = pendingIndex ?? props.committedIndex;
  const meterWidth = Math.max(0, rowWidth - METER_RIGHT);
  const track = {
    width: meterWidth - KNOB_INSET * 2,
    thumbWidth: KNOB_SIZE,
    levels: descriptor.options.length,
  };
  const stopX = (stop: number) => KNOB_INSET + effortStopX(track, stop);
  const snapTo = (x: number) => {
    const next = effortLevelAt(track, x - KNOB_INSET);
    if (next !== index) void Haptics.selectionAsync().catch(() => {});
    setPendingIndex(next);
  };
  const step = (delta: number) => setPendingIndex(Math.max(0, Math.min(lastIndex, index + delta)));
  const open = () => {
    setPendingIndex(null);
    void Haptics.selectionAsync().catch(() => {});
    props.onOpen();
  };
  const save = () => {
    const picked = descriptor.options[index];
    props.onSave(picked && index !== props.committedIndex ? picked.id : null);
  };

  // A meter closed from outside (the row left the list) can leave the shared value at 1.
  const editing = props.editing;
  const shown = useDerivedValue(() => (editing ? meter.get() : 0));

  // The meter grows out of the chip's pill to become the row, short of the save button.
  const meterStyle = useAnimatedStyle(() => {
    const progress = shown.get();
    const rect = chip.get();
    const width = rowWidthValue.get();
    return {
      left: interpolate(progress, [0, 1], [rect.x, 0]),
      right: interpolate(progress, [0, 1], [width - rect.x - rect.width, METER_RIGHT]),
      top: interpolate(progress, [0, 1], [rect.y, 0]),
      bottom: interpolate(progress, [0, 1], [ROW_HEIGHT - rect.y - rect.height, 0]),
      borderRadius: interpolate(progress, [0, 1], [CHIP_HEIGHT / 2, ROW_HEIGHT / 2]),
    };
  });
  const fadeOutStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shown.get(), [0, 0.6], [1, 0], Extrapolation.CLAMP),
  }));
  const fadeInStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shown.get(), [0.25, 1], [0, 1], Extrapolation.CLAMP),
  }));
  // Glass never renders under a fading ancestor, so the knob arrives by scale alone.
  const knobInStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(shown.get(), [0.25, 1], [0, 1], Extrapolation.CLAMP) }],
  }));
  const saveFillStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ scale: interpolate(shown.get(), [0, 1], [0.6, 1]) }],
  }));
  const saveInkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shown.get(), [0, 0.6], [0, 1], Extrapolation.CLAMP),
  }));

  const chipText = { ...NO3Y_FONT.medium, fontSize: 14, color: palette.foreground } as const;
  const committedLabel = descriptor.options[props.committedIndex]?.label ?? "";

  return (
    <Pressable
      {...rowAccessibility(props)}
      // Open, the meter and its save button take VoiceOver focus themselves.
      accessible={!props.editing}
      accessibilityState={{ selected: true, disabled: option.isUnavailable === true }}
      accessibilityActions={
        props.disabled ? [] : [{ name: "reasoning", label: `Change ${descriptor.label}` }]
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "reasoning") open();
      }}
      disabled={props.editing}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      onLayout={(event: LayoutChangeEvent) => {
        const width = event.nativeEvent.layout.width;
        rowWidthValue.set(width);
        setRowWidth(width);
      }}
      style={{
        height: ROW_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingLeft: ROW_PADDING_LEFT,
        paddingRight: ROW_PADDING_RIGHT,
        opacity: option.isUnavailable ? 0.45 : 1,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            backgroundColor: palette.rowSelected,
          },
          fadeOutStyle,
        ]}
      />
      <Animated.View
        style={[
          { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
          fadeOutStyle,
        ]}
      >
        <RowLead
          palette={palette}
          option={option}
          favorite={props.showFavorite && props.favorite}
        />
      </Animated.View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${descriptor.label}: ${committedLabel}`}
        accessibilityHint="Opens a slider to change it"
        accessibilityState={{ disabled: props.disabled }}
        disabled={props.disabled || props.editing}
        hitSlop={8}
        onPress={open}
        onLayout={(event: LayoutChangeEvent) => {
          const { x, y, width, height } = event.nativeEvent.layout;
          chip.set({ x, y, width, height });
        }}
        style={({ pressed }) => ({
          height: CHIP_HEIGHT,
          paddingHorizontal: 12,
          borderRadius: CHIP_HEIGHT / 2,
          justifyContent: "center",
          backgroundColor: palette.circleFill,
          opacity: props.editing ? 0 : props.disabled ? 0.45 : pressed ? 0.6 : 1,
        })}
      >
        <Text numberOfLines={1} style={chipText}>
          {committedLabel}
        </Text>
      </Pressable>
      {props.editing ? (
        <Animated.View
          style={[
            { position: "absolute", overflow: "hidden", backgroundColor: palette.circleFill },
            meterStyle,
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", top: 0, bottom: 0, right: 12, justifyContent: "center" },
              fadeOutStyle,
            ]}
          >
            <Text numberOfLines={1} style={chipText}>
              {committedLabel}
            </Text>
          </Animated.View>
          <Animated.View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={descriptor.label}
            accessibilityValue={{ text: levelLabel(descriptor.options[index]) }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(event) =>
              step(event.nativeEvent.actionName === "increment" ? 1 : -1)
            }
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={(event) => snapTo(event.nativeEvent.locationX)}
            onResponderMove={(event) => snapTo(event.nativeEvent.locationX)}
            style={[
              {
                position: "absolute",
                right: 0,
                top: "50%",
                marginTop: -ROW_HEIGHT / 2,
                width: meterWidth,
                height: ROW_HEIGHT,
                justifyContent: "center",
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[{ position: "absolute", inset: 0, justifyContent: "center" }, fadeInStyle]}
            >
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  // Ends in a cap around the knob, as the bar's own ends are round.
                  width: stopX(index) + KNOB_SIZE / 2 + KNOB_INSET,
                  borderRadius: ROW_HEIGHT / 2,
                  backgroundColor: palette.primaryFill,
                }}
              />
              {meterWidth > 0
                ? descriptor.options.map((level, stop) => (
                    <View
                      key={level.id}
                      style={{
                        position: "absolute",
                        left: stopX(stop) - DOT_SIZE / 2,
                        width: DOT_SIZE,
                        height: DOT_SIZE,
                        borderRadius: DOT_SIZE / 2,
                        backgroundColor: stop < index ? palette.primaryInk : palette.foreground,
                        opacity: stop < index ? 0.25 : 0.35,
                      }}
                    />
                  ))
                : null}
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  left: stopX(index) - KNOB_SIZE / 2,
                  width: KNOB_SIZE,
                  height: KNOB_SIZE,
                  borderRadius: KNOB_SIZE / 2,
                  // The sheet under the header's glass buttons, so the knob's glass matches theirs.
                  backgroundColor: no3ySheetBackground(palette.stageBackground),
                },
                knobInStyle,
              ]}
            >
              <No3yGlassLayer radius={KNOB_SIZE / 2} tint={palette.panelTint} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      ) : null}
      {props.editing && meterWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", left: 0, top: ROW_HEIGHT + 4, width: meterWidth, height: 16 },
            fadeInStyle,
          ]}
        >
          <Text
            numberOfLines={1}
            style={{
              ...NO3Y_FONT.medium,
              position: "absolute",
              left: stopX(index) - LABEL_WIDTH / 2,
              width: LABEL_WIDTH,
              fontSize: 12,
              lineHeight: 16,
              textAlign: "center",
              color: palette.foreground,
            }}
          >
            {descriptor.options[index]?.label}
          </Text>
        </Animated.View>
      ) : null}
      <Pressable
        accessibilityRole={props.editing ? "button" : undefined}
        accessibilityLabel={props.editing ? `Save ${descriptor.label.toLowerCase()}` : undefined}
        accessibilityElementsHidden={!props.editing}
        disabled={!props.editing}
        onPress={save}
        style={({ pressed }) => ({
          width: TRAILING_SIZE,
          height: TRAILING_SIZE,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              inset: 0,
              borderRadius: TRAILING_SIZE / 2,
              backgroundColor: palette.primaryFill,
            },
            saveFillStyle,
          ]}
        />
        <Animated.View style={[{ position: "absolute" }, fadeOutStyle]}>
          <HugeIcon icon={Tick02Icon} size={18} color={palette.foreground} />
        </Animated.View>
        <Animated.View style={[{ position: "absolute" }, saveInkStyle]}>
          <HugeIcon icon={Tick02Icon} size={18} color={palette.primaryInk} />
        </Animated.View>
      </Pressable>
    </Pressable>
  );
}

export function No3yModelPicker(props: {
  readonly session: No3yModelPickerSession;
  readonly onClose: () => void;
}) {
  const { session } = props;
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const choice = session.providerFilter ?? FAVORITES;
  const committed = useRef(false);
  const meter = useSharedValue(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // Leaving an open meter without saving drops its pick.
  const closeMeterNow = () => {
    meter.set(0);
    setEditingKey(null);
  };
  const setChoice = (next: string | null) => {
    closeMeterNow();
    session.setProviderFilter(next);
  };

  // A swipe-down dismissal keeps the pick, as the close button does.
  const commitOnDismiss = useEffectEvent(() => {
    if (!committed.current) session.commitPendingModel();
  });
  useEffect(() => () => commitOnDismiss(), []);
  const close = () => {
    if (!session.commitPendingModel()) return;
    committed.current = true;
    props.onClose();
  };

  const choices = [
    { id: FAVORITES, label: "Favorites" },
    ...session.providerGroups.map((group) => ({
      id: group.providerKey,
      label: group.providerLabel,
    })),
  ];
  const accessLabel =
    session.runtimeModeChoices.find((candidate) => candidate.mode === session.runtimeMode)?.label ??
    "Access";
  const choiceLabel = choices.find((candidate) => candidate.id === choice)?.label ?? "Favorites";
  const choiceDriver =
    choice === FAVORITES
      ? null
      : (session.providerGroups.find((group) => group.providerKey === choice)?.models[0]
          ?.providerDriver ?? null);
  const models = modelsFor(session, choice);

  const effort =
    session.displayedDescriptors.find(
      (descriptor): descriptor is SelectDescriptor =>
        isReasoningSelect(descriptor) && descriptor.options.length > 1,
    ) ?? null;
  // The model's other options (fast mode, context size…), which the upstream sheet lists as rows.
  const otherOptions = session.displayedDescriptors.filter(
    (descriptor) => descriptor.id !== effort?.id,
  );
  // What the provider reports wins, as in the full settings sheet's rows.
  const currentValue = (descriptor: ProviderOptionDescriptor) =>
    getProviderOptionCurrentValue(
      descriptor,
      session.displayedModelSelection,
      session.reportedModelSelection,
    );
  const optionActions: MenuAction[] = otherOptions.map((descriptor) =>
    descriptor.type === "select"
      ? {
          id: descriptor.id,
          title: descriptor.label,
          subactions: descriptor.options.map((option) => ({
            id: `select:${descriptor.id}:${option.id}`,
            title: option.label,
            state: option.id === currentValue(descriptor) ? ("on" as const) : ("off" as const),
          })),
        }
      : {
          id: `toggle:${descriptor.id}`,
          title: descriptor.label,
          state: currentValue(descriptor) === true ? ("on" as const) : ("off" as const),
        },
  );
  const pressOption = (actionId: string) => {
    for (const descriptor of otherOptions) {
      if (descriptor.type === "select") {
        const prefix = `select:${descriptor.id}:`;
        if (actionId.startsWith(prefix)) {
          session.applyOptionChange(descriptor.id, actionId.slice(prefix.length));
          return;
        }
      } else if (actionId === `toggle:${descriptor.id}`) {
        session.applyOptionChange(descriptor.id, currentValue(descriptor) !== true);
        return;
      }
    }
  };
  const effortIsPrimary =
    effort !== null && effort.id === session.promptTraits.primarySelectDescriptor?.id;
  const editingIndex =
    editingKey === null || effort === null
      ? -1
      : models.findIndex(({ option }) => option.key === editingKey && session.isDisplayed(option));
  const editing = editingIndex >= 0;
  const openMeter = (key: string) => {
    setEditingKey(key);
    meter.set(withTiming(1, METER_TIMING));
  };
  const saveMeter = (optionId: string | null) => {
    if (effort && optionId !== null) session.applyOptionChange(effort.id, optionId);
    meter.set(
      withTiming(0, METER_TIMING, (finished) => {
        if (finished) scheduleOnRN(setEditingKey, null);
      }),
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: no3ySheetBackground(palette.stageBackground) }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 8,
        }}
      >
        <No3yCircleButton
          palette={palette}
          accessibilityLabel="Close"
          icon={Cancel01Icon}
          onPress={close}
        />
        <No3yGlassMenuButton
          palette={palette}
          title="Show models from"
          accessibilityLabel={`Showing ${choiceLabel}. Choose favorites or a provider`}
          actions={choices.map((candidate) => ({
            id: candidate.id,
            title: candidate.label,
            state: candidate.id === choice ? ("on" as const) : ("off" as const),
          }))}
          onPressAction={setChoice}
          label={
            <>
              {choiceDriver ? <No3yProviderMark provider={choiceDriver} size={16} /> : null}
              <Text
                numberOfLines={1}
                style={{ ...NO3Y_FONT.medium, fontSize: 14, color: palette.foreground }}
              >
                {choiceLabel}
              </Text>
              <HugeIcon icon={ArrowDown01Icon} size={14} color={palette.quietInk} />
            </>
          }
        />
        <View style={{ flex: 1 }} />
        {optionActions.length > 0 ? (
          <No3yGlassMenuButton
            palette={palette}
            title="Options"
            accessibilityLabel="Model options"
            icon={SlidersHorizontalIcon}
            actions={optionActions}
            onPressAction={pressOption}
          />
        ) : null}
        <No3yAccessMenu
          runtimeMode={session.runtimeMode}
          choices={session.runtimeModeChoices}
          onSelect={session.onUpdateRuntimeMode}
          palette={palette}
          accessibilityLabel={`Access: ${accessLabel}. Choose access`}
          label={
            <>
              <No3yAccessIcon mode={session.runtimeMode} size={16} color={palette.foreground} />
              <Text
                numberOfLines={1}
                style={{ ...NO3Y_FONT.medium, fontSize: 14, color: palette.foreground }}
              >
                {accessLabel}
              </Text>
            </>
          }
        />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        // 24pt clear of the sheet's rounded bottom, as the usage sheet keeps its rows.
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: insets.bottom + 24 }}
        scrollEnabled={!editing}
        showsVerticalScrollIndicator={false}
      >
        {models.length === 0 ? (
          <Text
            style={{
              ...NO3Y_FONT.regular,
              fontSize: 14,
              color: palette.metaInk,
              textAlign: "center",
              paddingVertical: 32,
              paddingHorizontal: 24,
            }}
          >
            {choice === FAVORITES
              ? session.favoritesLoaded
                ? "No favorite models. Pick a provider, then long-press a model to favorite it."
                : "Loading favorites…"
              : "No models available"}
          </Text>
        ) : (
          models.map(({ option, providerLabel }, position) => {
            const rowProps = {
              palette,
              option,
              providerLabel,
              selected: session.isDisplayed(option),
              favorite: session.favoriteKeys.has(option.key),
              showFavorite: choice !== FAVORITES,
              onPress: () => {
                closeMeterNow();
                session.pressModel(option);
              },
              onLongPress: () => session.toggleFavorite(option),
            };
            const row =
              rowProps.selected && effort ? (
                <ReasoningModelRow
                  {...rowProps}
                  descriptor={effort}
                  committedIndex={effortStopIndex(
                    effort,
                    effortIsPrimary && session.promptTraits.ultrathinkPromptControlled,
                  )}
                  disabled={effortIsPrimary && session.promptTraits.ultrathinkInBodyText}
                  meter={meter}
                  editing={editing}
                  onOpen={() => openMeter(option.key)}
                  onSave={saveMeter}
                />
              ) : (
                <ModelRow {...rowProps} />
              );
            return (
              <PushedRow
                key={option.key}
                meter={meter}
                order={editing ? position - editingIndex : 0}
              >
                {row}
              </PushedRow>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
