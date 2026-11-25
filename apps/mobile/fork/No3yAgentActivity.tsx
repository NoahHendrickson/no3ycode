/**
 * The no3y Live Activity card — see `.fork/customizations.yaml#no3y-live-activity`. Flat Glass
 * status colours and marks, the pixel leaf, and Claude/Codex marks from the widget catalog
 * (fork/plugins/withNo3yWidgetAssets.cjs). The Mac push service fills it with
 * `No3yLiveActivityProps`; upstream's AgentActivity card stays for upstream-identity builds.
 */
import { Divider, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  activityBackgroundTint,
  background,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  resizable,
  shapes,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import type { ComponentProps } from "react";
import {
  createLiveActivity,
  type LiveActivityComponent,
  type LiveActivityLayout,
} from "expo-widgets";

import {
  NO3Y_LIVE_ACTIVITY_NAME,
  type No3yLiveActivityProps,
  type No3yLiveActivityRow,
} from "./no3yLiveActivity";

type Environment = Parameters<LiveActivityComponent<No3yLiveActivityProps>>[1];

// Serialized into the widget extension: only imported view and modifier factories may be used.
function No3yAgentActivity(
  props: No3yLiveActivityProps,
  environment: Environment,
): LiveActivityLayout {
  "widget";

  type Foreground = Parameters<typeof foregroundStyle>[0];
  type Phase = No3yLiveActivityRow["phase"];
  type SFName = NonNullable<ComponentProps<typeof Image>["systemName"]>;
  const primary = { type: "hierarchical", style: "primary" } as const;
  const secondary = { type: "hierarchical", style: "secondary" } as const;
  const light = environment.colorScheme === "light";
  const plain =
    environment.isLuminanceReduced ||
    environment.widgetRenderingMode === "accented" ||
    environment.widgetRenderingMode === "vibrant";

  // flatGlassTheme.ts status colours, dark and light.
  const tint = (phase: Phase): Foreground => {
    if (plain) return primary;
    switch (phase) {
      case "waiting_for_approval":
      case "waiting_for_input":
        return light ? "#D97706" : "#FFCD59";
      case "failed":
        return light ? "#DC2626" : "#FF6B60";
      case "completed":
        return "#2498FE";
      case "stale":
        return secondary;
      default:
        return light ? "#059669" : "#24FE8A";
    }
  };
  const symbol = (phase: Phase): SFName => {
    switch (phase) {
      case "waiting_for_approval":
      case "waiting_for_input":
        return "circle.lefthalf.filled";
      case "completed":
      case "failed":
        return "circle.fill";
      case "stale":
        return "clock";
      default:
        return "circle.dotted";
    }
  };

  // Past the stale date nothing in flight is known to still be running.
  const rows: ReadonlyArray<No3yLiveActivityRow> = environment.isStale
    ? props.rows.map((row) =>
        row.phase === "completed" || row.phase === "failed" ? row : { ...row, phase: "stale" },
      )
    : props.rows;
  // Totals over every thread: the card shows three rows, the header counts the rest too.
  const waiting = environment.isStale ? 0 : props.waitingCount;
  const failed = props.failedCount;
  const done = props.doneCount;
  const working = environment.isStale ? 0 : props.activeCount - props.waitingCount;
  const hero = rows[0];

  const deepLink =
    hero && hero.deepLink.startsWith("/") && !hero.deepLink.startsWith("//")
      ? `t3code://${hero.deepLink.slice(1)}`
      : null;
  const link = deepLink ? [widgetURL(deepLink)] : [];

  // Images ignore frame/foregroundStyle; size and tint them through a container they fill.
  const glyph = (phase: Phase, size: number) => (
    <HStack modifiers={[frame({ width: size, height: size }), foregroundStyle(tint(phase))]}>
      <Image systemName={symbol(phase)} modifiers={[resizable()]} />
    </HStack>
  );
  const asset = (name: string, size: number) => (
    <HStack modifiers={[frame({ width: size, height: size })]}>
      <Image assetName={name} modifiers={[resizable()]} />
    </HStack>
  );
  const providerMark = (provider: string) =>
    provider === "claudeAgent"
      ? asset("No3yClaude", 15)
      : provider === "codex"
        ? asset("No3yCodex", 15)
        : null;

  const brand = (
    <HStack spacing={6} alignment="center">
      {asset("No3yLeaf", 18)}
      <Text modifiers={[font({ weight: "medium", size: 14 }), foregroundStyle(primary)]}>no3y</Text>
    </HStack>
  );

  const parts: Array<{ readonly text: string; readonly color: Foreground }> = [];
  if (environment.isStale) parts.push({ text: "Out of date", color: secondary });
  if (working > 0) parts.push({ text: `${working} working`, color: primary });
  if (waiting > 0)
    parts.push({
      text: `${waiting} need${waiting === 1 ? "s" : ""} you`,
      color: primary,
    });
  if (props.activeCount === 0 && failed > 0)
    parts.push({ text: `${failed} failed`, color: primary });
  if (props.activeCount === 0 && done > 0) parts.push({ text: `${done} done`, color: primary });
  const part0 = parts[0];
  const part1 = parts[1];
  const summaryText = (text: string, color: Foreground) => (
    <Text modifiers={[font({ weight: "regular", size: 13 }), foregroundStyle(color), lineLimit(1)]}>
      {text}
    </Text>
  );
  const summary = (
    <HStack spacing={5} alignment="center">
      {part0 ? summaryText(part0.text, part0.color) : null}
      {part1 ? <Text modifiers={[font({ size: 13 }), foregroundStyle(secondary)]}>·</Text> : null}
      {part1 ? summaryText(part1.text, part1.color) : null}
    </HStack>
  );

  const row = (item: No3yLiveActivityRow | undefined, withProject: boolean) =>
    item ? (
      <HStack spacing={9} alignment="center" modifiers={[frame({ minHeight: 28 })]}>
        {glyph(item.phase, 13)}
        <Text
          modifiers={[
            font({ weight: "regular", size: 15 }),
            foregroundStyle(primary),
            lineLimit(1),
          ]}
        >
          {item.threadTitle}
        </Text>
        {withProject ? (
          <Text modifiers={[font({ size: 13 }), foregroundStyle(secondary), lineLimit(1)]}>
            {item.projectTitle}
          </Text>
        ) : null}
        <Spacer minLength={6} />
        {providerMark(item.provider)}
      </HStack>
    ) : null;
  const divided = (item: No3yLiveActivityRow | undefined) =>
    item ? <Divider modifiers={[padding({ leading: 22 })]} /> : null;

  // The builder already chose the rows (three, or two above tiles) and counted the rest.
  const r0 = rows[0];
  const r1 = rows[1];
  const r2 = rows[2];
  const tiles = props.tiles;
  const tile = (item: (typeof tiles)[number] | undefined) =>
    item ? (
      <HStack
        spacing={7}
        alignment="center"
        modifiers={[
          frame({ maxWidth: Infinity, minHeight: 32, maxHeight: 32 }),
          background(
            light ? "#0000000F" : "#FFFFFF12",
            shapes.roundedRectangle({ cornerRadius: 10 }),
          ),
        ]}
      >
        {glyph(
          environment.isStale && item.phase !== "failed" && item.phase !== "completed"
            ? "stale"
            : item.phase,
          13,
        )}
        <Text modifiers={[font({ size: 15 }), foregroundStyle(primary), monospacedDigit()]}>
          {`${item.count}`}
        </Text>
      </HStack>
    ) : null;
  const strip =
    tiles.length > 0 ? (
      <HStack spacing={6} modifiers={[padding({ top: 4 })]}>
        {tile(tiles[0])}
        {tile(tiles[1])}
        {tile(tiles[2])}
        {tile(tiles[3])}
      </HStack>
    ) : null;

  return {
    banner: (
      <VStack
        alignment="leading"
        spacing={4}
        modifiers={[
          padding({ top: 14, bottom: 10, leading: 16, trailing: 16 }),
          // A clear tint shows iOS 26's glass; older systems keep the standard surface.
          activityBackgroundTint(environment.isLiquidGlassAvailable ? "clear" : null),
          ...link,
        ]}
      >
        <HStack alignment="center" modifiers={[padding({ bottom: 4 })]}>
          {brand}
          <Spacer minLength={8} />
          {summary}
        </HStack>
        {row(r0, true)}
        {divided(r1)}
        {row(r1, true)}
        {divided(r2)}
        {row(r2, true)}
        {strip}
      </VStack>
    ),
    bannerSmall: (
      <VStack alignment="leading" spacing={5} modifiers={[padding({ all: 10 }), ...link]}>
        <HStack spacing={6} alignment="center">
          {asset("No3yLeaf", 14)}
          <Spacer minLength={4} />
          {summary}
        </HStack>
        {row(r0, false)}
      </VStack>
    ),
    compactLeading: <HStack modifiers={link}>{asset("No3yLeaf", 18)}</HStack>,
    compactTrailing: (
      <HStack modifiers={[padding({ trailing: 2 }), ...link]}>
        {hero ? glyph(hero.phase, 16) : null}
      </HStack>
    ),
    minimal: hero ? (
      <HStack modifiers={link}>{glyph(hero.phase, 14)}</HStack>
    ) : (
      asset("No3yLeaf", 14)
    ),
    expandedLeading: <HStack modifiers={[padding({ leading: 6, top: 4 })]}>{brand}</HStack>,
    expandedTrailing: <HStack modifiers={[padding({ trailing: 6, top: 4 })]}>{summary}</HStack>,
    expandedCenter: null,
    expandedBottom: (
      <VStack
        alignment="leading"
        spacing={2}
        modifiers={[padding({ horizontal: 8, top: 4 }), ...link]}
      >
        {row(r0, false)}
        {row(r1, false)}
        {row(r2, false)}
        {strip}
      </VStack>
    ),
  };
}

export default createLiveActivity<No3yLiveActivityProps>(
  NO3Y_LIVE_ACTIVITY_NAME,
  No3yAgentActivity,
);
