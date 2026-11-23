/**
 * The no3y iPhone model picker: a half-height sheet with a close button and a Favorites/provider
 * select, the models for that choice, and the effort slider — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. It drives the thread settings session the
 * upstream picker uses (ThreadSettingsSheet.tsx), so picks, favorites and options save the same way.
 */
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import StarIcon from "@hugeicons/core-free-icons/StarIcon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";
import { isReasoningSelect } from "@t3tools/client-runtime/model-traits";
import type { ProviderOptionDescriptor, RuntimeMode } from "@t3tools/contracts";
import { getProviderOptionCurrentValue } from "@t3tools/shared/model";
import * as Haptics from "expo-haptics";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import { No3yGlassMenuButton } from "./No3yGlassMenuButton";
import { no3ySheetBackground } from "./no3ySheet";

/** iPhone gets this picker in a half sheet; iPad and Android keep the full thread settings sheet. */
export const NO3Y_MODEL_SHEET = Platform.OS === "ios" && !Platform.isPad;

type SelectDescriptor = Extract<ProviderOptionDescriptor, { type: "select" }>;

/** The parts of the thread settings session the picker reads and drives. */
export interface No3yModelPickerSession {
  readonly providerGroups: ReadonlyArray<ProviderGroup>;
  readonly favoriteKeys: ReadonlySet<string>;
  readonly favoritesLoaded: boolean;
  readonly toggleFavorite: (option: ModelOption) => void;
  readonly displayedDescriptors: ReadonlyArray<ProviderOptionDescriptor>;
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

const TRACK_HEIGHT = 24;
const THUMB_WIDTH = 20;

/**
 * The model's reasoning levels as a slider, like the Mac's effort bar: a notch per level, a tap
 * jumps to the nearest one, a drag snaps from level to level with a tick, and it writes on release.
 */
function EffortSlider(props: {
  readonly palette: FlatGlassPalette;
  readonly descriptor: SelectDescriptor;
  readonly committedIndex: number;
  readonly disabled: boolean;
  readonly onCommit: (optionId: string) => void;
}) {
  const { palette, descriptor } = props;
  const [width, setWidth] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const lastIndex = descriptor.options.length - 1;
  const index = dragIndex ?? props.committedIndex;
  const option = descriptor.options[index];
  const track = { width, thumbWidth: THUMB_WIDTH, levels: descriptor.options.length };
  const thumbLeft = effortStopX(track, index) - THUMB_WIDTH / 2;
  const snapTo = (x: number) => {
    const next = effortLevelAt(track, x);
    if (next !== index) void Haptics.selectionAsync().catch(() => {});
    setDragIndex(next);
  };
  const commit = (next: number) => {
    setDragIndex(null);
    const picked = descriptor.options[next];
    if (picked && next !== props.committedIndex) props.onCommit(picked.id);
  };
  const text = { ...NO3Y_FONT.regular, fontSize: 12, lineHeight: 16 } as const;

  return (
    <View style={{ gap: 8, opacity: props.disabled ? 0.45 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...text, color: palette.metaInk }}>{descriptor.label}</Text>
        <Text style={{ ...text, ...NO3Y_FONT.medium, color: palette.foreground }}>
          {option?.isDefault ? `${option.label} · Default` : option?.label}
        </Text>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={descriptor.label}
        accessibilityValue={{ text: option?.label ?? "" }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          if (props.disabled) return;
          const step = event.nativeEvent.actionName === "increment" ? 1 : -1;
          commit(Math.max(0, Math.min(lastIndex, props.committedIndex + step)));
        }}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => !props.disabled}
        onMoveShouldSetResponder={() => !props.disabled}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => snapTo(event.nativeEvent.locationX)}
        onResponderMove={(event) => snapTo(event.nativeEvent.locationX)}
        onResponderRelease={(event) => commit(effortLevelAt(track, event.nativeEvent.locationX))}
        onResponderTerminate={() => setDragIndex(null)}
        style={{
          height: TRACK_HEIGHT,
          borderRadius: 6,
          backgroundColor: palette.circleFill,
          justifyContent: "center",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: thumbLeft + THUMB_WIDTH / 2,
            borderRadius: 6,
            backgroundColor: palette.usageRingRemaining,
            opacity: 0.55,
          }}
        />
        {width > 0
          ? descriptor.options.map((level, stop) => (
              <View
                key={level.id}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: effortStopX(track, stop) - 1,
                  width: 2,
                  height: 8,
                  borderRadius: 1,
                  backgroundColor: palette.foreground,
                  opacity: 0.45,
                }}
              />
            ))
          : null}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: thumbLeft,
            width: THUMB_WIDTH,
            height: TRACK_HEIGHT,
            borderRadius: 6,
            backgroundColor: palette.primaryFill,
          }}
        />
      </View>
    </View>
  );
}

function ModelRow(props: {
  readonly palette: FlatGlassPalette;
  readonly option: ModelOption;
  readonly providerLabel: string | null;
  readonly selected: boolean;
  readonly favorite: boolean;
  readonly onPress: () => void;
  readonly onLongPress: () => void;
}) {
  const { palette, option } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[option.label, props.providerLabel, props.favorite ? "Favorite" : null]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint="Long-press to add or remove a favorite"
      accessibilityState={{ selected: props.selected, disabled: option.isUnavailable === true }}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      style={({ pressed }) => ({
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: props.selected
          ? palette.rowSelected
          : pressed
            ? palette.rowPressed
            : "transparent",
        opacity: option.isUnavailable ? 0.45 : 1,
      })}
    >
      <No3yProviderMark
        iconUrl={option.providerIconUrl}
        provider={option.providerDriver}
        size={16}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ ...NO3Y_FONT.regular, fontSize: 15, color: palette.foreground }}
        >
          {option.label}
        </Text>
        {props.providerLabel ? (
          <Text
            numberOfLines={1}
            style={{ ...NO3Y_FONT.regular, fontSize: 12, color: palette.metaInk }}
          >
            {props.providerLabel}
          </Text>
        ) : null}
      </View>
      {props.favorite && props.providerLabel === null ? (
        <HugeIcon icon={StarIcon} size={14} color={palette.statusAttention} filled />
      ) : null}
      {props.selected ? <HugeIcon icon={Tick02Icon} size={16} color={palette.foreground} /> : null}
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
  const [choice, setChoice] = useState(FAVORITES);
  const committed = useRef(false);

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
  const effortIsPrimary =
    effort !== null && effort.id === session.promptTraits.primarySelectDescriptor?.id;

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
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }}
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
          models.map(({ option, providerLabel }) => (
            <ModelRow
              key={option.key}
              palette={palette}
              option={option}
              providerLabel={choice === FAVORITES ? providerLabel : null}
              selected={session.isDisplayed(option)}
              favorite={session.favoriteKeys.has(option.key)}
              onPress={() => session.pressModel(option)}
              onLongPress={() => session.toggleFavorite(option)}
            />
          ))
        )}
      </ScrollView>
      {effort ? (
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            // 24pt clear of the sheet's rounded bottom, as the usage sheet keeps its rows.
            paddingBottom: insets.bottom + 24,
            borderTopWidth: 1,
            borderTopColor: palette.hairline,
          }}
        >
          <EffortSlider
            palette={palette}
            descriptor={effort}
            committedIndex={effortStopIndex(
              effort,
              effortIsPrimary && session.promptTraits.ultrathinkPromptControlled,
            )}
            disabled={effortIsPrimary && session.promptTraits.ultrathinkInBodyText}
            onCommit={(optionId) => session.applyOptionChange(effort.id, optionId)}
          />
        </View>
      ) : null}
    </View>
  );
}
