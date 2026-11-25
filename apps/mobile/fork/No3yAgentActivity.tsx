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
  // Null is work in flight, drawn with the app's bead ring.
  const symbol = (phase: Phase): SFName | null => {
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
        return null;
    }
  };
  // Project labels and separators: a fixed ink on the card's own tint, not the wallpaper's.
  const quiet: Foreground = plain ? secondary : light ? "#0000009E" : "#FFFFFF9E";

  // Past the stale date nothing in flight is known to still be running.
  const rows: ReadonlyArray<No3yLiveActivityRow> = environment.isStale
    ? props.rows.map((row) =>
        row.phase === "completed" || row.phase === "failed" ? row : { ...row, phase: "stale" },
      )
    : props.rows;
  const hero = rows[0];

  const deepLink =
    hero && hero.deepLink.startsWith("/") && !hero.deepLink.startsWith("//")
      ? `t3code://${hero.deepLink.slice(1)}`
      : null;
  const link = deepLink ? [widgetURL(deepLink)] : [];

  // Images ignore frame/foregroundStyle; size and tint them through a container they fill.
  const glyph = (phase: Phase, size: number) => {
    const name = symbol(phase);
    return (
      <HStack modifiers={[frame({ width: size, height: size }), foregroundStyle(tint(phase))]}>
        {name ? (
          <Image systemName={name} modifiers={[resizable()]} />
        ) : (
          <Image assetName="No3yBeadRing" modifiers={[resizable()]} />
        )}
      </HStack>
    );
  };
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
        {withProject && item.projectTitle !== "" ? (
          <Text modifiers={[font({ size: 13 }), foregroundStyle(quiet), lineLimit(1)]}>
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
          padding({ vertical: 10, horizontal: 16 }),
          // iOS 26 glass tinted to Flat Glass ink at about half, so it reads on any wallpaper; older
          // systems keep the standard surface.
          activityBackgroundTint(
            environment.isLiquidGlassAvailable ? (light ? "#F2F2F285" : "#12121285") : null,
          ),
          ...link,
        ]}
      >
        {row(r0, true)}
        {divided(r1)}
        {row(r1, true)}
        {divided(r2)}
        {row(r2, true)}
        {strip}
      </VStack>
    ),
    bannerSmall: (
      <VStack alignment="leading" modifiers={[padding({ all: 10 }), ...link]}>
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
    expandedLeading: null,
    expandedTrailing: null,
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
