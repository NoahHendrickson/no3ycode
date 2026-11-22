/**
 * Bots at the top of the no3y iOS Threads screen — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. Petal tiles (mascot on its tinted tile, name,
 * status mark) wrap left to right; a tap opens the bot's conversation, a long press offers the
 * thread actions that suit a bot. Nothing renders when there are no bots.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { Pressable, useWindowDimensions, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { AppText as Text } from "../src/components/ui/AppText";
import { Menu } from "../src/components/ui/Menu";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import {
  botMascotBaseColor,
  botMascotSprite,
  type BotMascotMood,
  type BotMascotShape,
} from "./botMascotArt";
import { flatGlassPalette, NO3Y_FONT } from "./flatGlassTheme";
import { no3yBotMascotMood, no3yBotMascotShape } from "./forkBots";
import { resolveNo3yThreadCardStatusKind } from "./mobileStatusGrouping";
import { No3yGlassLayer } from "./No3yGlass";
import { No3yStatusMark } from "./No3yStatusMark";

const GRID_INSET = 16;
const GRID_GAP = 8;
const TILE_MIN_WIDTH = 104;
const MASCOT_TILE = 36;

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

function BotTile(props: {
  readonly bot: EnvironmentThreadShell;
  readonly width: number;
  readonly now: string;
  readonly onOpen: (bot: EnvironmentThreadShell) => void;
  readonly onRename: (bot: EnvironmentThreadShell) => void;
  readonly onArchive: (bot: EnvironmentThreadShell) => void;
  readonly onDelete: (bot: EnvironmentThreadShell) => void;
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const { bot } = props;
  const kind = resolveNo3yThreadCardStatusKind(bot, { now: props.now });
  const shape = no3yBotMascotShape({ id: bot.id, tags: bot.source?.tags });
  return (
    <Menu
      shouldOpenOnLongPress
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
        accessibilityLabel={`${bot.title}, bot`}
        onPress={() => props.onOpen(bot)}
        style={({ pressed }) => ({
          width: props.width,
          borderRadius: 16,
          padding: 10,
          gap: 8,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <No3yGlassLayer radius={16} />
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View
            style={{
              width: MASCOT_TILE,
              height: MASCOT_TILE,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              // The mascot's own colour at half strength, as on the Mac's Petal tile.
              backgroundColor: `${botMascotBaseColor(shape)}80`,
              borderWidth: 1,
              borderColor:
                themeAppearance === "dark" ? "rgba(255, 255, 255, 0.24)" : "rgba(0, 0, 0, 0.24)",
            }}
          >
            <BotMascot shape={shape} mood={no3yBotMascotMood(kind)} fit={24} />
          </View>
          <View style={{ marginLeft: "auto" }}>
            <No3yStatusMark kind={kind} palette={palette} idleMode="dot" />
          </View>
        </View>
        <Text
          numberOfLines={1}
          style={{ ...NO3Y_FONT.medium, fontSize: 14, lineHeight: 18, color: palette.titleInk }}
        >
          {bot.title}
        </Text>
      </Pressable>
    </Menu>
  );
}

export function No3yBotsGrid(props: {
  readonly bots: ReadonlyArray<EnvironmentThreadShell>;
  readonly now: string;
  readonly onOpen: (bot: EnvironmentThreadShell) => void;
  readonly onRename: (bot: EnvironmentThreadShell) => void;
  readonly onArchive: (bot: EnvironmentThreadShell) => void;
  readonly onDelete: (bot: EnvironmentThreadShell) => void;
}) {
  const window = useWindowDimensions();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  if (props.bots.length === 0) return null;
  const span = window.width - GRID_INSET * 2;
  const columns = Math.max(1, Math.floor((span + GRID_GAP) / (TILE_MIN_WIDTH + GRID_GAP)));
  const tileWidth = (span - GRID_GAP * (columns - 1)) / columns;
  return (
    <View style={{ paddingHorizontal: GRID_INSET, paddingTop: 10, gap: 8 }}>
      <Text
        accessibilityRole="header"
        style={{ ...NO3Y_FONT.medium, fontSize: 14, lineHeight: 24, color: palette.sectionInk }}
      >
        Bots
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP }}>
        {props.bots.map((bot) => (
          <BotTile
            key={`${bot.environmentId}:${bot.id}`}
            bot={bot}
            width={tileWidth}
            now={props.now}
            onOpen={props.onOpen}
            onRename={props.onRename}
            onArchive={props.onArchive}
            onDelete={props.onDelete}
          />
        ))}
      </View>
    </View>
  );
}
