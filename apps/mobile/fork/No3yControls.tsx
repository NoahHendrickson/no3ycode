/**
 * Small controls the no3y iOS screens share: the 40pt round glass icon button and the usage
 * ring — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { AppText as Text } from "../src/components/ui/AppText";
import { NO3Y_CONTROL_SIZE, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { No3yGlassLayer } from "./No3yGlass";
import { HugeIcon, type HugeIconData } from "./HugeIcon";

/** A 40pt round glass button, the size and material of the native bar buttons. */
export function No3yCircleButton(props: {
  readonly palette: FlatGlassPalette;
  readonly accessibilityLabel: string;
  readonly icon?: HugeIconData;
  readonly children?: ReactNode;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
}) {
  const { palette } = props;
  return (
    <View
      style={{
        width: NO3Y_CONTROL_SIZE,
        height: NO3Y_CONTROL_SIZE,
        borderRadius: NO3Y_CONTROL_SIZE / 2,
        borderWidth: props.selected ? 1.5 : 0,
        borderColor: palette.peekRing,
        opacity: props.disabled ? 0.45 : 1,
      }}
    >
      <No3yGlassLayer radius={NO3Y_CONTROL_SIZE / 2} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        accessibilityState={{ disabled: props.disabled, selected: props.selected }}
        disabled={props.disabled}
        onPress={props.onPress}
        style={({ pressed }) => ({
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        {props.icon ? (
          <HugeIcon icon={props.icon} size={18} color={palette.foreground} filled />
        ) : null}
        {props.children}
      </Pressable>
    </View>
  );
}

const RING_SIZE = 28;
const RING_STROKE = 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2 - 1.33;

/** A 28pt ring: the share of usage left as a green arc from the top, its percentage inside. */
export function No3yUsageRing(props: {
  readonly palette: FlatGlassPalette;
  readonly remainingPercent: number;
}) {
  const { palette } = props;
  const remaining = Math.max(0, Math.min(100, props.remainingPercent));
  const circumference = 2 * Math.PI * RING_RADIUS;
  return (
    <>
      <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={palette.usageRingTrack}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={palette.usageRingRemaining}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${(remaining / 100) * circumference} ${circumference}`}
          fill="none"
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <Text
        style={{
          fontSize: remaining >= 100 ? 9 : 12,
          lineHeight: 14,
          ...NO3Y_FONT.medium,
          fontVariant: ["tabular-nums"],
          color: palette.foreground,
        }}
      >
        {Math.round(remaining)}
      </Text>
    </>
  );
}
