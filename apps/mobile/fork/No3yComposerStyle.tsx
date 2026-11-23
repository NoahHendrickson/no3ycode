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
import type { MenuAction } from "@react-native-menu/menu";
import type { RuntimeMode } from "@t3tools/contracts";
import { createContext, use, type ReactNode } from "react";
import { Pressable, View, type PressableProps } from "react-native";

import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { flatGlassPalette, NO3Y_COMPOSER_CONTROL_SIZE, NO3Y_FONT } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import { No3yAccessIcon } from "./No3yAccess";
import { No3yGlassLayer } from "./No3yGlass";
import { No3yGlassMenuButton } from "./No3yGlassMenuButton";

/** What the card tells its controls: set while the no3y card style is on. */
interface No3yComposerCard {
  readonly runtimeMode: RuntimeMode;
}

const No3yComposerStyleContext = createContext<No3yComposerCard | null>(null);

export function No3yComposerStyleProvider(props: {
  readonly value: No3yComposerCard;
  readonly children: ReactNode;
}) {
  return <No3yComposerStyleContext value={props.value}>{props.children}</No3yComposerStyleContext>;
}

/** Whether the composer controls draw the no3y card style. */
export function useNo3yComposerStyle(): boolean {
  return use(No3yComposerStyleContext) !== null;
}

/** The SF Symbols the composer actions name, as the Hugeicons the card draws. */
const ACTION_ICONS: Readonly<Record<string, HugeIconData>> = {
  "stop.fill": StopIcon,
  play: PlayIcon,
  checkmark: Tick02Icon,
  "arrow.turn.left.up": ArrowRight01Icon,
};

/** A 40pt round composer control, glass unless it is Send or Stop; forwards a Menu's press props. */
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
        : null;
  const ink =
    variant === "danger"
      ? "#FFFFFF"
      : variant === "primary"
        ? props.disabled
          ? palette.faintInk
          : palette.primaryInk
        : palette.foreground;
  return (
    <View
      style={{
        width: NO3Y_COMPOSER_CONTROL_SIZE,
        height: NO3Y_COMPOSER_CONTROL_SIZE,
        marginLeft: props.leading ? 0 : 8,
        borderRadius: NO3Y_COMPOSER_CONTROL_SIZE / 2,
        backgroundColor: background ?? undefined,
        opacity: props.disabled && variant !== "primary" ? 0.45 : 1,
      }}
    >
      {background === null ? <No3yGlassLayer radius={NO3Y_COMPOSER_CONTROL_SIZE / 2} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        accessibilityState={{ disabled: props.disabled }}
        disabled={props.disabled}
        hitSlop={4}
        onPress={props.onPress}
        onLongPress={props.onLongPress}
        onTouchStart={props.onTouchStart}
        style={({ pressed }) => ({
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <HugeIcon icon={icon} size={20} color={ink} filled={variant !== "primary"} />
      </Pressable>
    </View>
  );
}

/** A 40pt glass composer control whose menu morphs out of it on iOS 26. */
export function No3yComposerMenuButton(props: {
  readonly accessibilityLabel: string;
  readonly icon: HugeIconData;
  readonly actions: ReadonlyArray<MenuAction>;
  readonly onPressAction: (id: string) => void;
}) {
  const { themeAppearance } = useAppearancePreferences();
  return (
    <No3yGlassMenuButton
      {...props}
      palette={flatGlassPalette(themeAppearance)}
      size={NO3Y_COMPOSER_CONTROL_SIZE}
    />
  );
}

/** The model chip: provider mark, model, effort and the access shield on a 40pt glass pill. */
export function No3yModelChip(props: {
  readonly accessibilityLabel: string;
  readonly icon: ReactNode;
  readonly label: string;
  readonly detail: string;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}) {
  const card = use(No3yComposerStyleContext);
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const text = {
    ...NO3Y_FONT.regular,
    fontSize: 14,
    color: palette.foreground,
  } as const;
  return (
    <View
      style={{
        height: NO3Y_COMPOSER_CONTROL_SIZE,
        marginLeft: 8,
        maxWidth: 220,
        borderRadius: NO3Y_COMPOSER_CONTROL_SIZE / 2,
        opacity: props.disabled ? 0.45 : 1,
      }}
    >
      <No3yGlassLayer radius={NO3Y_COMPOSER_CONTROL_SIZE / 2} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        accessibilityState={{ disabled: props.disabled }}
        disabled={props.disabled}
        onPress={props.onPress}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
          {props.icon}
        </View>
        <Text numberOfLines={1} style={{ ...text, flexShrink: 1 }}>
          {props.label}
        </Text>
        {props.detail ? (
          <Text numberOfLines={1} style={{ ...text, color: palette.quietInk }}>
            {props.detail}
          </Text>
        ) : null}
        {card ? (
          <View accessibilityLabel={`Access: ${card.runtimeMode}`}>
            <No3yAccessIcon mode={card.runtimeMode} size={16} color={palette.quietInk} />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
