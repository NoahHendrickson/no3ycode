/**
 * Native RN Flat Glass status indicator marks matching the Mac sidebar's
 * `SidebarV2StatusIndicator.tsx` — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 *
 * Every status resolves to one mark in a fixed 16x16 trailing box so titles
 * stay aligned across rows. No continuously repainting animations are used.
 */
import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { SymbolView } from "../src/components/ui/AppSymbol";
import { flatGlassStatusColor, type FlatGlassPalette } from "./flatGlassTheme";

const BEAD_RING_RADIUS = 5.8;
/** The line's span, then four beads trailing behind it, shrinking (angles in degrees, 0 = right). */
const BEAD_LINE = { from: -82, to: 32 } as const;
const BEADS = [
  { at: -104, r: 0.95 },
  { at: -126, r: 0.85 },
  { at: -150, r: 0.72 },
  { at: -176, r: 0.58 },
] as const;

function ringPoint(degrees: number): readonly [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [8 + BEAD_RING_RADIUS * Math.cos(radians), 8 + BEAD_RING_RADIUS * Math.sin(radians)];
}

/**
 * A still frame of the Mac's bead ring working mark (fork-working-mark): a line round the ring
 * with its tail broken into beads. Drawn still, like every mobile mark, so nothing repaints.
 */
function BeadRingMark(props: { readonly color: string }) {
  const [x1, y1] = ringPoint(BEAD_LINE.from);
  const [x2, y2] = ringPoint(BEAD_LINE.to);
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path
        d={`M${x1} ${y1} A${BEAD_RING_RADIUS} ${BEAD_RING_RADIUS} 0 0 1 ${x2} ${y2}`}
        stroke={props.color}
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
      {BEADS.map((bead) => {
        const [cx, cy] = ringPoint(bead.at);
        return <Circle key={bead.at} cx={cx} cy={cy} r={bead.r} fill={props.color} />;
      })}
    </Svg>
  );
}

/** Half-filled circle matching the Mac sidebar's CircleHalfIcon for blocked-on-you states. */
function HalfCircleMark(props: { readonly color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 12 12">
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
}) {
  const color = flatGlassStatusColor(props.kind, props.palette);
  const label = statusAccessibilityLabel(props.kind, props.idleMode);

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        width: 16,
        height: 16,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {props.kind === "working" ? (
        <BeadRingMark color={color} />
      ) : props.kind === "approval" ||
        props.kind === "input" ||
        props.kind === "request" ||
        props.kind === "limited" ? (
        <HalfCircleMark color={color} />
      ) : props.kind === "woke" ? (
        <SymbolView name="clock" size={11} tintColor={color} type="monochrome" weight="semibold" />
      ) : props.kind === "done" ||
        props.kind === "failed" ||
        props.kind === "monitoring" ||
        props.kind === "waiting" ? (
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: color,
          }}
        />
      ) : props.idleMode === "draft" ? (
        <SymbolView
          name="pencil"
          size={11}
          tintColor={props.palette.quietInk}
          type="monochrome"
          weight="medium"
        />
      ) : (
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            borderWidth: 1.25,
            borderColor: props.palette.statusIdleBorder,
          }}
        />
      )}
    </View>
  );
}
