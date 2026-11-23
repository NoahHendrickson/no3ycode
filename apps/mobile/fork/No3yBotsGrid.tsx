/**
 * Petals (the fork's bots) at the top of the no3y iOS Threads screen, as the Mac's Petal cards in
 * two columns: mascot tile, name, the Mac's status line, and a mark that takes the petal's
 * launched work's need of you — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { AppText as Text } from "../src/components/ui/AppText";
import { Menu } from "../src/components/ui/Menu";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { formatNextScheduledTaskRun } from "../src/features/settings/scheduledTaskPresentation";
import {
  resolveThreadListV2Status,
  threadHasUnseenCompletion,
} from "../src/features/threads/threadListV2";
import { useEnvironmentQuery } from "../src/state/query";
import { serverEnvironment } from "../src/state/server";
import {
  botMascotBaseColor,
  botMascotSprite,
  type BotMascotMood,
  type BotMascotShape,
} from "./botMascotArt";
import { flatGlassPalette, NO3Y_FONT } from "./flatGlassTheme";
import {
  no3yBotMascotMood,
  no3yBotMascotShape,
  no3yBotStatusLine,
  no3yBotWorkByBot,
  no3yBotWorkStatusText,
  no3yPetalMark,
  type No3yBotWork,
} from "./forkBots";
import { resolveNo3yThreadCardStatusKind } from "./mobileStatusGrouping";
import { NO3Y_FADE_IN, NO3Y_FADE_OUT, NO3Y_LAYOUT } from "./no3yMotion";
import { No3yStatusMark } from "./No3yStatusMark";

const GRID_INSET = 16;
const GRID_GAP = 8;
const MASCOT_TILE = 32;

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
  const status = resolveThreadListV2Status(bot);
  const ownKind = resolveNo3yThreadCardStatusKind(bot, { now: props.now });
  const mark = no3yPetalMark(ownKind, status, props.work);
  const shape = no3yBotMascotShape({ id: bot.id, tags: bot.source?.tags });
  // One live list per environment, shared by every card on it, as on the Mac.
  const tasks = useEnvironmentQuery(
    serverEnvironment.scheduledTasksLive({ environmentId: bot.environmentId, input: {} }),
  ).data?.tasks;
  const nextWakeAt =
    (tasks ?? [])
      .flatMap((task) =>
        task.threadId === bot.id && task.enabled && task.nextRunAt !== null ? [task.nextRunAt] : [],
      )
      .toSorted()[0] ?? null;
  const line =
    mark.attention !== null
      ? { text: no3yBotWorkStatusText(mark.attention) }
      : no3yBotStatusLine({
          shell: bot.source,
          status,
          isUnread: status === "ready" && threadHasUnseenCompletion(bot),
          nextWakeAt,
        });
  const lineText =
    "text" in line
      ? line.text
      : formatNextScheduledTaskRun(line.nextWakeAt, Date.parse(props.now)).replace(
          /^Next run/,
          "Next check",
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
        accessibilityLabel={`${bot.title}, petal, ${lineText}`}
        onPress={() => props.onOpen(bot)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 10,
          paddingLeft: 10,
          paddingRight: 8,
          borderRadius: 14,
          backgroundColor: pressed ? palette.rowSelected : palette.cardWash,
        })}
      >
        <View
          style={{
            width: MASCOT_TILE,
            height: MASCOT_TILE,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            // The mascot's own colour at half strength behind a 1px 24% edge (Figma Petal card).
            backgroundColor: `${botMascotBaseColor(shape)}80`,
            borderWidth: 1,
            borderColor:
              themeAppearance === "dark" ? "rgba(255, 255, 255, 0.24)" : "rgba(0, 0, 0, 0.24)",
          }}
        >
          <BotMascot shape={shape} mood={no3yBotMascotMood(mark.kind)} fit={22} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{ ...NO3Y_FONT.medium, fontSize: 15, lineHeight: 19, color: palette.titleInk }}
          >
            {bot.title}
          </Text>
          <Text
            numberOfLines={1}
            style={{ ...NO3Y_FONT.regular, fontSize: 13, lineHeight: 16, color: palette.metaInk }}
          >
            {lineText}
          </Text>
        </View>
        <No3yStatusMark kind={mark.kind} palette={palette} idleMode="dot" />
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
  const work = useMemo(
    () =>
      no3yBotWorkByBot(props.threads, resolveThreadListV2Status, (thread) => {
        const status = resolveThreadListV2Status(thread);
        return status === "working" || (status === "waiting" && thread.runtime?.status !== "idle");
      }),
    [props.threads],
  );
  if (props.bots.length === 0) return null;
  const rows: Array<ReadonlyArray<EnvironmentThreadShell>> = [];
  for (let index = 0; index < props.bots.length; index += 2) {
    rows.push(props.bots.slice(index, index + 2));
  }
  return (
    <View style={{ paddingHorizontal: GRID_INSET, paddingTop: 10, gap: GRID_GAP }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        <Text
          accessibilityRole="header"
          style={{ ...NO3Y_FONT.medium, fontSize: 14, lineHeight: 24, color: palette.sectionInk }}
        >
          Petals
        </Text>
        <Text style={{ ...NO3Y_FONT.regular, fontSize: 13, color: palette.faintInk }}>
          {props.bots.length}
        </Text>
      </View>
      {rows.map((row) => (
        <Animated.View
          key={`${row[0]!.environmentId}:${row[0]!.id}`}
          layout={NO3Y_LAYOUT}
          entering={NO3Y_FADE_IN}
          exiting={NO3Y_FADE_OUT}
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
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </Animated.View>
      ))}
    </View>
  );
}
