/**
 * Petals (the fork's bots) at the top of the no3y iOS Threads screen, as the Mac's Petal tiles, up
 * to five to a row (fewer span it), wrapping: the bare mascot, the name under it, and a corner
 * mark that takes the petal's launched work's need of you — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import ChevronDownIcon from "@hugeicons/core-free-icons/ChevronDownIcon";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { AppText as Text } from "../src/components/ui/AppText";
import { Menu } from "../src/components/ui/Menu";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { resolveThreadListV2Status } from "../src/features/threads/threadListV2";
import { botMascotSprite, type BotMascotMood, type BotMascotShape } from "./botMascotArt";
import { flatGlassPalette, NO3Y_FONT } from "./flatGlassTheme";
import {
  no3yBotMascotMood,
  no3yBotMascotShape,
  no3yBotWorkByBot,
  no3yPetalMark,
  type No3yBotWork,
} from "./forkBots";
import { resolveNo3yThreadCardStatusKind } from "./mobileStatusGrouping";
import { HugeIcon } from "./HugeIcon";
import { No3yGlassLayer } from "./No3yGlass";
import { NO3Y_GLASS_RISE_IN, NO3Y_LAYOUT, useNo3yToggleProgress } from "./no3yMotion";
import { No3yStatusMark } from "./No3yStatusMark";

const GRID_INSET = 16;
const GRID_GAP = 8;
const PER_ROW = 5;
const TILE_RADIUS = 12;
const MASCOT_SIZE = 26;

function BotMascot(props: {
  readonly shape: BotMascotShape;
  readonly mood: BotMascotMood;
  readonly fit: number;
}) {
  const sprite = botMascotSprite(props.shape, props.mood);
  const cell = Math.min(props.fit / sprite.width, props.fit / sprite.height);
  return (
    <Svg
      width={sprite.width * cell}
      height={sprite.height * cell}
      viewBox={`0 0 ${sprite.width} ${sprite.height}`}
    >
      {sprite.paths.map((path) => (
        <Path key={path.fill} d={path.d} fill={path.fill} />
      ))}
    </Svg>
  );
}

function PetalCard(props: {
  readonly bot: EnvironmentThreadShell;
  readonly now: string;
  readonly work: No3yBotWork | undefined;
  readonly onOpen: (bot: EnvironmentThreadShell) => void;
  readonly onRename: (bot: EnvironmentThreadShell) => void;
  readonly onArchive: (bot: EnvironmentThreadShell) => void;
  readonly onDelete: (bot: EnvironmentThreadShell) => void;
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const { bot } = props;
  const ownKind = resolveNo3yThreadCardStatusKind(bot, { now: props.now });
  const mark = no3yPetalMark(ownKind, resolveThreadListV2Status(bot), props.work);
  const shape = no3yBotMascotShape({ id: bot.id, tags: bot.source?.tags });
  const content = (
    <>
      <View style={{ position: "absolute", top: 6, right: 6 }}>
        <No3yStatusMark kind={mark.kind} palette={palette} idleMode="dot" />
      </View>
      <View style={{ height: MASCOT_SIZE, justifyContent: "center" }}>
        <BotMascot shape={shape} mood={no3yBotMascotMood(mark.kind)} fit={MASCOT_SIZE} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          ...NO3Y_FONT.regular,
          fontSize: 12,
          lineHeight: 16,
          color: palette.titleInk,
          textAlign: "center",
          alignSelf: "stretch",
        }}
      >
        {bot.title}
      </Text>
    </>
  );
  return (
    <Menu
      shouldOpenOnLongPress
      style={{ flex: 1, minWidth: 0 }}
      actions={[
        { id: "rename", title: "Rename", image: "pencil" },
        { id: "archive", title: "Archive", image: "archivebox" },
        { id: "delete", title: "Delete", image: "trash", attributes: { destructive: true } },
      ]}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === "rename") props.onRename(bot);
        if (nativeEvent.event === "archive") props.onArchive(bot);
        if (nativeEvent.event === "delete") props.onDelete(bot);
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${bot.title}, petal`}
        onPress={() => props.onOpen(bot)}
        style={{
          alignItems: "center",
          gap: 6,
          paddingTop: 10,
          paddingBottom: 10,
          paddingHorizontal: 4,
          borderRadius: TILE_RADIUS,
        }}
      >
        {({ pressed }) => (
          <>
            <No3yGlassLayer radius={TILE_RADIUS} tint={pressed ? palette.rowSelected : undefined} />
            {content}
          </>
        )}
      </Pressable>
    </Menu>
  );
}

export function No3yBotsGrid(props: {
  readonly bots: ReadonlyArray<EnvironmentThreadShell>;
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly now: string;
  readonly onOpen: (bot: EnvironmentThreadShell) => void;
  readonly onRename: (bot: EnvironmentThreadShell) => void;
  readonly onArchive: (bot: EnvironmentThreadShell) => void;
  readonly onDelete: (bot: EnvironmentThreadShell) => void;
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const [collapsed, setCollapsed] = useState(false);
  const open = useNo3yToggleProgress(!collapsed);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(open.get() - 1) * 90}deg` }],
  }));
  const work = useMemo(
    () =>
      no3yBotWorkByBot(props.threads, resolveThreadListV2Status, (thread) => {
        const status = resolveThreadListV2Status(thread);
        return status === "working" || (status === "waiting" && thread.runtime?.status !== "idle");
      }),
    [props.threads],
  );
  if (props.bots.length === 0) return null;
  // Fewer Petals than a full row still span it; more wrap at PER_ROW.
  const perRow = Math.min(props.bots.length, PER_ROW);
  const rows: Array<ReadonlyArray<EnvironmentThreadShell>> = [];
  for (let index = 0; index < props.bots.length; index += perRow) {
    rows.push(props.bots.slice(index, index + perRow));
  }
  return (
    <View style={{ paddingHorizontal: GRID_INSET, paddingTop: 10, gap: GRID_GAP }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Petals, ${props.bots.length} ${props.bots.length === 1 ? "petal" : "petals"}`}
        accessibilityState={{ expanded: !collapsed }}
        hitSlop={{ top: 8, bottom: 8, right: 24 }}
        onPress={() => setCollapsed(!collapsed)}
        style={({ pressed }) => ({
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
          height: 24,
          paddingLeft: 2,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <Text
          accessibilityRole="header"
          style={{ ...NO3Y_FONT.medium, fontSize: 14, lineHeight: 16, color: palette.sectionInk }}
        >
          Petals
        </Text>
        <Animated.View
          style={[
            { width: 20, height: 24, alignItems: "center", justifyContent: "center" },
            chevronStyle,
          ]}
        >
          <HugeIcon icon={ChevronDownIcon} size={14} color={palette.sectionInk} filled />
        </Animated.View>
      </Pressable>
      {collapsed
        ? null
        : rows.map((row) => (
            <Animated.View
              key={`${row[0]!.environmentId}:${row[0]!.id}`}
              layout={NO3Y_LAYOUT}
              entering={NO3Y_GLASS_RISE_IN}
              style={{ flexDirection: "row", gap: GRID_GAP }}
            >
              {row.map((bot) => (
                <PetalCard
                  key={`${bot.environmentId}:${bot.id}`}
                  bot={bot}
                  now={props.now}
                  work={work.get(`${bot.environmentId}:${bot.id}`)}
                  onOpen={props.onOpen}
                  onRename={props.onRename}
                  onArchive={props.onArchive}
                  onDelete={props.onDelete}
                />
              ))}
              {/* A short last row keeps the tiles their full-row width. */}
              {Array.from({ length: perRow - row.length }, (_, index) => (
                <View key={index} style={{ flex: 1 }} />
              ))}
            </Animated.View>
          ))}
    </View>
  );
}
