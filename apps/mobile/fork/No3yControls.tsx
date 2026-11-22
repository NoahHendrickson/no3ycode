/**
 * Small controls the no3y iOS screens share: the 40pt (or 32pt) round icon button and the usage
 * ring — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import type { ReactNode } from "react";
import { Pressable, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { AppText as Text } from "../src/components/ui/AppText";
import { NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";

export function no3yHairline(palette: FlatGlassPalette): ViewStyle {
  return {
    shadowColor: palette.hairlineShadow,
    shadowOpacity: 1,
    shadowRadius: 0.5,
    shadowOffset: { width: 0, height: 0 },
  };
}

export function No3yCircleButton(props: {
  readonly palette: FlatGlassPalette;
  readonly accessibilityLabel: string;
  readonly icon?: HugeIconData;
  readonly children?: ReactNode;
  readonly size?: 32 | 40;
  readonly variant?: "default" | "primary";
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
}) {
  const { palette } = props;
  const size = props.size ?? 40;
  const primary = props.variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ disabled: props.disabled, selected: props.selected }}
      disabled={props.disabled}
      hitSlop={size < 40 ? 4 : 0}
      onPress={props.onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: primary ? palette.primaryFill : palette.circleFill,
          borderWidth: props.selected ? 1.5 : 0,
          borderColor: palette.peekRing,
          opacity: props.disabled ? 0.45 : pressed ? 0.7 : 1,
        },
        size === 40 ? no3yHairline(palette) : null,
      ]}
    >
      {props.icon ? (
        <HugeIcon
          icon={props.icon}
          size={16}
          color={primary ? palette.primaryInk : palette.foreground}
          filled={!primary}
        />
      ) : null}
      {props.children}
    </Pressable>
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
          fontFamily: NO3Y_FONT.medium,
          fontVariant: ["tabular-nums"],
          color: palette.foreground,
        }}
      >
        {Math.round(remaining)}
      </Text>
    </>
  );
}
