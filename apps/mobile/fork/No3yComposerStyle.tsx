/**
 * The no3y thread composer card's controls — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * ThreadComposer's surface provides the context on the no3y iPhone layout, and the upstream
 * composer controls (attach, model, dictation, send/stop/resume) draw these instead while it is
 * on, keeping their own behaviour.
 */
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import CornerDownLeftIcon from "@hugeicons/core-free-icons/CornerDownLeftIcon";
import PlayIcon from "@hugeicons/core-free-icons/PlayIcon";
import StopIcon from "@hugeicons/core-free-icons/StopIcon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";
import { createContext, use, type ReactNode } from "react";
import { Pressable, View, type PressableProps } from "react-native";

import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { flatGlassPalette, NO3Y_FONT } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";

const No3yComposerStyleContext = createContext(false);

export function No3yComposerStyleProvider(props: {
  readonly value: boolean;
  readonly children: ReactNode;
}) {
  return <No3yComposerStyleContext value={props.value}>{props.children}</No3yComposerStyleContext>;
}

/** Whether the composer controls draw the no3y card style. */
export function useNo3yComposerStyle(): boolean {
  return use(No3yComposerStyleContext);
}

/** The SF Symbols the composer actions name, as the Hugeicons the card draws. */
const ACTION_ICONS: Readonly<Record<string, HugeIconData>> = {
  "stop.fill": StopIcon,
  play: PlayIcon,
  checkmark: Tick02Icon,
  "arrow.turn.left.up": ArrowRight01Icon,
};

/** A 32pt round composer control; forwards the press props a native Menu injects. */
export function No3yComposerRoundButton(
  props: {
    readonly accessibilityLabel: string;
    readonly icon: HugeIconData | string;
    readonly variant?: "plain" | "primary" | "danger";
    readonly disabled?: boolean;
    /** The row's first control, flush with the card's inset. */
    readonly leading?: boolean;
  } & Pick<PressableProps, "onPress" | "onLongPress" | "onTouchStart">,
) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const variant = props.variant ?? "plain";
  const icon =
    typeof props.icon === "string" ? (ACTION_ICONS[props.icon] ?? CornerDownLeftIcon) : props.icon;
  const background =
    variant === "danger"
      ? palette.statusFailed
      : variant === "primary" && !props.disabled
        ? palette.primaryFill
        : palette.circleFill;
  const ink =
    variant === "danger"
      ? "#FFFFFF"
      : variant === "primary"
        ? props.disabled
          ? palette.faintInk
          : palette.primaryInk
        : palette.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      hitSlop={6}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      onTouchStart={props.onTouchStart}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        marginLeft: props.leading ? 0 : 8,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: background,
        opacity: props.disabled && variant !== "primary" ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <HugeIcon icon={icon} size={16} color={ink} filled={variant !== "primary"} />
    </Pressable>
  );
}

/** The model chip: provider mark, model and effort, 12pt, on a soft pill. */
export function No3yModelChip(props: {
  readonly accessibilityLabel: string;
  readonly icon: ReactNode;
  readonly label: string;
  readonly detail: string;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const text = {
    fontFamily: NO3Y_FONT.regular,
    fontSize: 12,
    color: palette.foreground,
  } as const;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({
        height: 32,
        marginLeft: 8,
        maxWidth: 200,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        borderRadius: 16,
        backgroundColor: palette.circleFill,
        opacity: props.disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}>
        {props.icon}
      </View>
      <Text numberOfLines={1} style={{ ...text, flexShrink: 1 }}>
        {props.label}
      </Text>
      {props.detail ? (
        <Text numberOfLines={1} style={text}>
          {props.detail}
        </Text>
      ) : null}
    </Pressable>
  );
}
