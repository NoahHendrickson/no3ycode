/**
 * Native RN Flat Glass status indicator marks matching the Mac sidebar's
 * `SidebarV2StatusIndicator.tsx` — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 *
 * Every status resolves to one mark in a fixed 14x14 trailing box so titles
 * stay aligned across rows. No continuously repainting animations are used.
 */
import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";
import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { SymbolView } from "../src/components/ui/AppSymbol";
import { flatGlassStatusColor, type FlatGlassPalette } from "./flatGlassTheme";

const RAIN_ROWS = 5;
const RAIN_PITCH = 3.8;
const RAIN_CELL = 2.85;
const RAIN_COLUMNS = [
  { speed: 2.5, phase: 0 },
  { speed: 4.504345, phase: 1.961008 },
  { speed: 3.80266, phase: 2.768793 },
] as const;
const RAIN_SPAN = RAIN_ROWS + 3;
const RAIN_NATIVE_WIDTH = (RAIN_COLUMNS.length - 1) * RAIN_PITCH + RAIN_CELL;
const RAIN_NATIVE_HEIGHT = (RAIN_ROWS - 1) * RAIN_PITCH + RAIN_CELL;

function hashSeedSeconds(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return ((hash >>> 0) / 0x1_0000_0000) * 32;
}

function rainAlpha(dy: number): number {
  const alpha = dy >= 0 ? Math.exp(-dy * 0.8) : Math.exp(dy * 8);
  return alpha >= 0.08 ? alpha : 0;
}

/** Deterministic still frame of the 3x5 falling-pixel rain mark (zero GPU loop). */
function WorkingRainMark(props: { readonly seed: string; readonly color: string }) {
  const t = 0.6 + hashSeedSeconds(props.seed);
  const drawHeight = 14;
  const drawWidth = (RAIN_NATIVE_WIDTH / RAIN_NATIVE_HEIGHT) * drawHeight;
  const cells: Array<{
    readonly key: string;
    readonly x: number;
    readonly y: number;
    readonly opacity: number;
  }> = [];
  for (let colIndex = 0; colIndex < RAIN_COLUMNS.length; colIndex += 1) {
    const column = RAIN_COLUMNS[colIndex]!;
    const period = RAIN_SPAN / column.speed;
    const progress = (((t + column.phase / column.speed) % period) + period) % period;
    const head = (progress / period) * RAIN_SPAN - 1.5;
    for (let row = 0; row < RAIN_ROWS; row += 1) {
      const opacity = rainAlpha(head - row);
      if (opacity <= 0) continue;
      cells.push({
        key: `${colIndex}:${row}`,
        x: colIndex * RAIN_PITCH,
        y: row * RAIN_PITCH,
        opacity,
      });
    }
  }
  return (
    <Svg
      width={drawWidth}
      height={drawHeight}
      viewBox={`0 0 ${RAIN_NATIVE_WIDTH} ${RAIN_NATIVE_HEIGHT}`}
    >
      {cells.map((cell) => (
        <Rect
          key={cell.key}
          x={cell.x}
          y={cell.y}
          width={RAIN_CELL}
          height={RAIN_CELL}
          rx={RAIN_CELL * 0.28}
          fill={props.color}
          opacity={cell.opacity}
        />
      ))}
    </Svg>
  );
}

/** Half-filled circle matching the Mac sidebar's CircleHalfIcon for blocked-on-you states. */
function HalfCircleMark(props: { readonly color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 12 12">
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
  readonly seed: string;
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
        width: 14,
        height: 14,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {props.kind === "working" ? (
        <WorkingRainMark seed={props.seed} color={color} />
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
