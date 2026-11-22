/**
 * The half-height sheet the no3y thread status pill opens (`.fork/customizations.yaml#no3y-mobile-redesign`):
 * everything the pill counts, grouped by kind, with the upstream control's actions, read live
 * from no3yStatusSheetStore.ts.
 */
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import ComputerTerminal01Icon from "@hugeicons/core-free-icons/ComputerTerminal01Icon";
import Globe02Icon from "@hugeicons/core-free-icons/Globe02Icon";
import LeftToRightListNumberIcon from "@hugeicons/core-free-icons/LeftToRightListNumberIcon";
import PuzzleIcon from "@hugeicons/core-free-icons/PuzzleIcon";
import Radar01Icon from "@hugeicons/core-free-icons/Radar01Icon";
import Robot01Icon from "@hugeicons/core-free-icons/Robot01Icon";
import SmartPhone01Icon from "@hugeicons/core-free-icons/SmartPhone01Icon";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import type {
  FloatingStatusAction,
  FloatingWorkingStatus,
} from "../src/features/threads/floating-working-status";
import { useVisibleSecondClock } from "../src/features/threads/use-visible-second-clock";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import { No3yCircleButton } from "./No3yControls";
import { No3yStatusGlyph } from "./No3yStatusPill";
import { statusAccessibilityLabel, No3yStatusMark } from "./No3yStatusMark";
import { no3yElapsedLabel } from "./no3yStatusSegments";
import { useNo3yStatusSheetModel, type No3yStatusOpener } from "./no3yStatusSheetStore";

export function No3yStatusSheet({ route }: StaticScreenProps<{ readonly threadKey: string }>) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const model = useNo3yStatusSheetModel(route.params.threadKey);
  const close = () => navigation.goBack();
  // Navigating rows leave the sheet first so their screen opens over the thread.
  const leaveThen = (open: () => void) => () => {
    close();
    open();
  };
  const sections: ReactNode[] = [];
  if (model !== null) {
    if (model.childInputs.length > 0) {
      sections.push(
        <Section key="needs" palette={palette} title="Needs you">
          {model.childInputs.map((child) => (
            <Row
              key={child.id}
              palette={palette}
              leading={<No3yStatusMark kind={child.needs} palette={palette} />}
              title={child.title}
              meta={statusAccessibilityLabel(child.needs)}
              onPress={leaveThen(child.onOpen)}
              chevron
            />
          ))}
        </Section>,
      );
    }
    const status = model.status;
    if (status !== null && status.kind !== "background" && status.kind !== "child-input") {
      sections.push(
        <Section key="status" palette={palette} title="Status">
          <StatusRow palette={palette} status={status} />
        </Section>,
      );
    }
    const background = model.background;
    const backgroundItems = background?.items.filter((item) => item.kind !== "subagent") ?? [];
    if (background !== null && backgroundItems.length > 0) {
      sections.push(
        <Section
          key="background"
          palette={palette}
          title="Background"
          action={{
            label: "Details",
            accessibilityLabel: "Open background work",
            onPress: leaveThen(background.onOpenDetails),
          }}
        >
          {backgroundItems.map((item) => (
            <Row
              key={item.taskId}
              palette={palette}
              leading={
                <HugeIcon
                  icon={item.kind === "monitor" ? Radar01Icon : ComputerTerminal01Icon}
                  size={16}
                  color={palette.foreground}
                />
              }
              title={item.label}
              titleLines={3}
              meta={item.kind === "monitor" ? "Monitor" : "Process"}
            />
          ))}
          {background.stop !== null ? (
            <Row
              palette={palette}
              title={
                backgroundItems.length === 1 ? "Stop this process" : "Stop all background work"
              }
              action={background.stop}
              destructive
            />
          ) : null}
        </Section>,
      );
    }
    const backgroundSubagents =
      model.subagents.length === 0
        ? (background?.items.filter((item) => item.kind === "subagent") ?? [])
        : [];
    if (model.subagents.length > 0 || backgroundSubagents.length > 0) {
      const openAgents = model.onOpenAgents ?? background?.onOpenDetails ?? null;
      sections.push(
        <Section
          key="subagents"
          palette={palette}
          title="Subagents"
          action={
            openAgents === null
              ? undefined
              : {
                  label: "All agents",
                  accessibilityLabel: "Open this turn's subagents",
                  onPress: leaveThen(openAgents),
                }
          }
        >
          {model.subagents.map((agent) => (
            <Row
              key={agent.id}
              palette={palette}
              leading={<HugeIcon icon={Robot01Icon} size={16} color={palette.foreground} />}
              title={agent.title}
              trailing={<No3yStatusMark kind={agent.mark} palette={palette} />}
              onPress={openAgents === null ? undefined : leaveThen(openAgents)}
            />
          ))}
          {backgroundSubagents.map((item) => (
            <Row
              key={item.taskId}
              palette={palette}
              leading={<HugeIcon icon={Robot01Icon} size={16} color={palette.foreground} />}
              title={item.label}
              trailing={<No3yStatusMark kind="working" palette={palette} />}
              onPress={openAgents === null ? undefined : leaveThen(openAgents)}
            />
          ))}
        </Section>,
      );
    }
    const others: ReactNode[] = [];
    if (model.extension !== null) {
      others.push(
        <Row
          key="extension"
          palette={palette}
          leading={<HugeIcon icon={PuzzleIcon} size={16} color={palette.foreground} />}
          title={model.extension.label}
          titleLines={3}
          onPress={model.extension.onPress}
        />,
      );
    }
    const openers: ReadonlyArray<readonly [string, No3yStatusOpener | null, HugeIconData, string]> =
      [
        ["queue", model.queue, LeftToRightListNumberIcon, "queued"],
        ["devices", model.devicePreview, SmartPhone01Icon, "device preview"],
        ["browser", model.browserPreview, Globe02Icon, "browser tab"],
      ];
    for (const [key, opener, icon, noun] of openers) {
      if (opener === null) continue;
      others.push(
        <Row
          key={key}
          palette={palette}
          leading={<HugeIcon icon={icon} size={16} color={palette.foreground} />}
          title={
            key === "queue"
              ? `${opener.count} queued`
              : `${opener.count} ${noun}${opener.count === 1 ? "" : "s"}`
          }
          onPress={leaveThen(opener.onPress)}
          chevron
        />,
      );
    }
    if (others.length > 0) {
      sections.push(
        <Section key="others" palette={palette} title="Also open">
          {others}
        </Section>,
      );
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: palette.stageBackground }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 8,
        }}
      >
        <No3yCircleButton
          palette={palette}
          accessibilityLabel="Close"
          icon={Cancel01Icon}
          onPress={close}
        />
        <Text
          accessibilityRole="header"
          style={{ flex: 1, ...NO3Y_FONT.medium, fontSize: 16, color: palette.foreground }}
        >
          Activity
        </Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16),
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {sections.length > 0 ? (
          sections
        ) : (
          <Text
            style={{ paddingTop: 24, textAlign: "center", fontSize: 14, color: palette.metaInk }}
          >
            Nothing running.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function Section(props: {
  readonly palette: FlatGlassPalette;
  readonly title: string;
  readonly action?: {
    readonly label: string;
    readonly accessibilityLabel: string;
    readonly onPress: () => void;
  };
  readonly children: ReactNode;
}) {
  const { palette } = props;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", paddingBottom: 4 }}>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, ...NO3Y_FONT.medium, fontSize: 13, color: palette.sectionInk }}
        >
          {props.title}
        </Text>
        {props.action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.action.accessibilityLabel}
            hitSlop={8}
            onPress={props.action.onPress}
          >
            <Text style={{ ...NO3Y_FONT.medium, fontSize: 14, color: palette.peekRing }}>
              {props.action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {props.children}
    </View>
  );
}

function Row(props: {
  readonly palette: FlatGlassPalette;
  readonly title: string;
  readonly titleLines?: number;
  readonly meta?: string;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  readonly chevron?: boolean;
  readonly onPress?: () => void;
  readonly action?: FloatingStatusAction | null;
  readonly destructive?: boolean;
}) {
  const { palette, action } = props;
  const body = (
    <>
      {props.leading ? (
        <View style={{ width: 20, alignItems: "center" }}>{props.leading}</View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          numberOfLines={props.titleLines ?? 1}
          style={{ ...NO3Y_FONT.medium, fontSize: 15, color: palette.titleInk }}
        >
          {props.title}
        </Text>
        {props.meta ? (
          <Text numberOfLines={2} style={{ fontSize: 13, color: palette.metaInk }}>
            {props.meta}
          </Text>
        ) : null}
      </View>
      {props.trailing}
      {props.chevron ? (
        <Text style={{ fontSize: 15, color: palette.faintInk }} importantForAccessibility="no">
          ›
        </Text>
      ) : null}
    </>
  );
  const rowStyle = {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.hairline,
  } as const;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {props.onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={props.onPress}
          style={({ pressed }) => [rowStyle, { flex: 1, opacity: pressed ? 0.6 : 1 }]}
        >
          {body}
        </Pressable>
      ) : (
        <View accessible style={[rowStyle, { flex: 1 }]}>
          {body}
          {action ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel}
              accessibilityState={{ disabled: action.disabled }}
              disabled={action.disabled}
              hitSlop={8}
              onPress={action.onPress}
              style={({ pressed }) => ({ opacity: action.disabled ? 0.45 : pressed ? 0.6 : 1 })}
            >
              <Text
                style={{
                  ...NO3Y_FONT.medium,
                  fontSize: 14,
                  color: props.destructive ? palette.statusFailed : palette.peekRing,
                }}
              >
                {action.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

function WorkingSince(props: { readonly startedAt: string; readonly palette: FlatGlassPalette }) {
  const nowMs = useVisibleSecondClock(true);
  return (
    <Row
      palette={props.palette}
      leading={
        <No3yStatusGlyph
          status={{ kind: "working", startedAt: props.startedAt }}
          palette={props.palette}
        />
      }
      title={`Working · ${no3yElapsedLabel(props.startedAt, nowMs)}`}
    />
  );
}

/** The transient status, its full message, and the action the floating control offered. */
function StatusRow(props: {
  readonly palette: FlatGlassPalette;
  readonly status: Exclude<FloatingWorkingStatus, { kind: "background" | "child-input" }>;
}) {
  const { palette, status } = props;
  const leading = <No3yStatusGlyph status={status} palette={palette} />;
  switch (status.kind) {
    case "working":
      return <WorkingSince startedAt={status.startedAt} palette={palette} />;
    case "compacting":
      return <Row palette={palette} leading={leading} title="Compacting…" />;
    case "connection":
      return (
        <Row
          palette={palette}
          leading={leading}
          title={status.label}
          titleLines={4}
          action={{
            label: "Reconnect",
            accessibilityLabel: "Reconnect",
            disabled: false,
            onPress: status.onPress,
          }}
        />
      );
    case "lifecycle":
      return (
        <Row palette={palette} leading={leading} title={status.label} action={status.action} />
      );
    case "stop":
      return (
        <Row
          palette={palette}
          leading={leading}
          title={status.label}
          action={status.action}
          destructive
        />
      );
    case "goal":
      return (
        <Row
          palette={palette}
          leading={leading}
          title={status.label}
          meta={status.accessibilityLabel}
        />
      );
    case "extension":
      return (
        <Row
          palette={palette}
          leading={leading}
          title={status.label}
          titleLines={3}
          onPress={status.onPress}
        />
      );
    case "syncing":
    case "preparing":
      return <Row palette={palette} leading={leading} title={status.label} />;
  }
}
