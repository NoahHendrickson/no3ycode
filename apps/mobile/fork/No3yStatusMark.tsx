/**
 * Flat Glass status marks matching the Mac sidebar's `SidebarV2StatusIndicator.tsx` — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. One mark per status in a fixed square box so
 * titles stay aligned; drawn for 16pt and scaled whole. Working is the bead ring (No3yBeadRing.tsx).
 */
import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { SymbolView } from "../src/components/ui/AppSymbol";
import {
  flatGlassStatusColor,
  NO3Y_STATUS_MARK_SIZE,
  type FlatGlassPalette,
} from "./flatGlassTheme";
import { No3yBeadRing } from "./No3yBeadRing";

/** Half-filled circle matching the Mac sidebar's CircleHalfIcon for blocked-on-you states. */
function HalfCircleMark(props: { readonly color: string; readonly size: number }) {
  return (
    <Svg width={props.size} height={props.size} viewBox="0 0 12 12">
      <Circle cx={6} cy={6} r={4.75} stroke={props.color} strokeWidth={1.3} fill="none" />
      <Path d="M6 1.25 A4.75 4.75 0 0 1 6 10.75 Z" fill={props.color} />
    </Svg>
  );
}

export function statusAccessibilityLabel(
  kind: SidebarV2CardStatusKind | null,
  idleMode?: "dot" | "draft",
): string {
  switch (kind) {
    case "working":
      return "Working";
    case "waiting":
      return "Waiting";
    case "approval":
      return "Needs approval";
    case "input":
      return "Needs input";
    case "request":
      return "Message request";
    case "limited":
      return "Usage limit reached";
    case "failed":
      return "Failed";
    case "woke":
      return "Woke from snooze";
    case "done":
      return "Completed";
    case "monitoring":
      return "Monitoring";
    case null:
      return idleMode === "draft" ? "Draft" : "Idle";
  }
}

export function No3yStatusMark(props: {
  readonly kind: SidebarV2CardStatusKind | null;
  readonly palette: FlatGlassPalette;
  readonly idleMode?: "dot" | "draft";
  /** The box; defaults to card size. */
  readonly size?: number;
}) {
  const color = flatGlassStatusColor(props.kind, props.palette);
  const label = statusAccessibilityLabel(props.kind, props.idleMode);
  const size = props.size ?? NO3Y_STATUS_MARK_SIZE;
  // Each mark is drawn for a 16pt box; scaling every measure keeps strokes in proportion.
  const scale = size / 16;
  const dot = 10 * scale;

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {props.kind === "working" ? (
        <No3yBeadRing color={color} size={size} />
      ) : props.kind === "approval" ||
        props.kind === "input" ||
        props.kind === "request" ||
        props.kind === "limited" ? (
        <HalfCircleMark color={color} size={13 * scale} />
      ) : props.kind === "woke" ? (
        <SymbolView
          name="clock"
          size={11 * scale}
          tintColor={color}
          type="monochrome"
          weight="semibold"
        />
      ) : props.kind === "done" ||
        props.kind === "failed" ||
        props.kind === "monitoring" ||
        props.kind === "waiting" ? (
        <View
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: color,
          }}
        />
      ) : props.idleMode === "draft" ? (
        <SymbolView
          name="pencil"
          size={11 * scale}
          tintColor={props.palette.quietInk}
          type="monochrome"
          weight="medium"
        />
      ) : (
        <View
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            borderWidth: 1.25 * scale,
            borderColor: props.palette.statusIdleBorder,
          }}
        />
      )}
    </View>
  );
}
