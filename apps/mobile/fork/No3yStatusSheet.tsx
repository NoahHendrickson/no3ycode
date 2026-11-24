/**
 * The half-height sheet the no3y thread status pill opens (`.fork/customizations.yaml#no3y-mobile-redesign`):
 * everything the pill counts, grouped by kind, with the upstream control's actions, read live
 * from no3yStatusSheetStore.ts.
 */
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import ComputerTerminal01Icon from "@hugeicons/core-free-icons/ComputerTerminal01Icon";
import Globe02Icon from "@hugeicons/core-free-icons/Globe02Icon";
import LeftToRightListNumberIcon from "@hugeicons/core-free-icons/LeftToRightListNumberIcon";
import PuzzleIcon from "@hugeicons/core-free-icons/PuzzleIcon";
import Radar01Icon from "@hugeicons/core-free-icons/Radar01Icon";
import Robot01Icon from "@hugeicons/core-free-icons/Robot01Icon";
import SmartPhone01Icon from "@hugeicons/core-free-icons/SmartPhone01Icon";
import { StackActions, useNavigation, type StaticScreenProps } from "@react-navigation/native";
import type { ScopedThreadRef } from "@t3tools/contracts";
import * as Haptics from "expo-haptics";
import { Children, isValidElement, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../src/components/ui/AppText";
import { ScreenContent } from "../src/components/ui/ScreenContent";
import { SheetHeader } from "../src/components/ui/SheetHeader";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import type { FloatingStatusAction } from "../src/features/threads/floating-working-status";
import { useOpenThreadInspector } from "../src/features/threads/thread-inspector-navigation";
import { useThreadTurnSubagents } from "../src/features/threads/ThreadAgentsSheet";
import type { SubagentThreadTarget } from "../src/features/threads/threadAgentsPresentation";
import { useOpenLinkedThreadRead } from "../src/features/threads/useOpenLinkedThread";
import { useVisibleSecondClock } from "../src/features/threads/use-visible-second-clock";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import type { No3yPillStatus } from "./no3yPillStatus";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import { No3yAgentsSheetRow } from "./No3yAgentsSheetRow";
import { no3ySheetBackground } from "./no3ySheet";
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
  const turnSubagents = useThreadTurnSubagents(model?.agents ?? null)?.subagents ?? [];
  const openSubagent = useNo3yOpenSubagent(model?.agents ?? null);
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
    const background = model.background;
    const backgroundSubagents =
      turnSubagents.length === 0
        ? (background?.items.filter((item) => item.kind === "subagent") ?? [])
        : [];
    if (turnSubagents.length > 0 && model.agents !== null) {
      const { environmentId } = model.agents;
      sections.push(
        <Section key="subagents" palette={palette} title="Subagents" count={turnSubagents.length}>
          {turnSubagents.map((subagent) => (
            <No3yAgentsSheetRow
              key={subagent.id}
              environmentId={environmentId}
              subagent={subagent}
              onOpen={openSubagent}
              joined
            />
          ))}
        </Section>,
      );
    } else if (background !== null && backgroundSubagents.length > 0) {
      sections.push(
        <Section
          key="subagents"
          palette={palette}
          title="Subagents"
          count={backgroundSubagents.length}
        >
          {backgroundSubagents.map((item) => (
            <Row
              key={item.taskId}
              palette={palette}
              leading={<HugeIcon icon={Robot01Icon} size={18} color={palette.foreground} />}
              title={item.label}
              trailing={<No3yStatusMark kind="working" palette={palette} />}
              onPress={leaveThen(background.onOpenDetails)}
              chevron
            />
          ))}
        </Section>,
      );
    }
    const backgroundItems = background?.items.filter((item) => item.kind !== "subagent") ?? [];
    if (background !== null && backgroundItems.length > 0) {
      sections.push(
        <Section
          key="background"
          palette={palette}
          title="Background"
          count={backgroundItems.length}
          action={
            background.stop === null
              ? undefined
              : {
                  ...background.stop,
                  // Disabled carries the upstream "Stopping…" while the stop runs.
                  label:
                    backgroundItems.length === 1 || background.stop.disabled
                      ? background.stop.label
                      : "Stop all",
                  destructive: true,
                }
          }
        >
          {backgroundItems.map((item) => (
            <Row
              key={item.taskId}
              palette={palette}
              leading={
                <HugeIcon
                  icon={item.kind === "monitor" ? Radar01Icon : ComputerTerminal01Icon}
                  size={18}
                  color={palette.foreground}
                />
              }
              title={item.label}
              titleLines={0}
              meta={item.kind === "monitor" ? "Monitor" : "Process"}
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
    const others: ReactNode[] = [];
    if (model.extension !== null) {
      others.push(
        <Row
          key="extension"
          palette={palette}
          leading={<HugeIcon icon={PuzzleIcon} size={18} color={palette.foreground} />}
          title={model.extension.label}
          titleLines={3}
          onPress={model.extension.onPress}
          chevron
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
          leading={<HugeIcon icon={icon} size={18} color={palette.foreground} />}
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
    <View
      collapsable={false}
      style={{ flex: 1, backgroundColor: no3ySheetBackground(palette.stageBackground) }}
    >
      <SheetHeader title="Activity" onClose={close} />
      <ScreenContent>
        <ScrollView
          className="flex-1"
          // UIKit insets the content beneath the translucent native header.
          contentInsetAdjustmentBehavior="automatic"
          alwaysBounceVertical
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 18) + 18,
            gap: 20,
          }}
        >
          {sections.length > 0 ? (
            sections
          ) : (
            <Text className="pt-6 text-center text-sm text-foreground-muted">Nothing running.</Text>
          )}
        </ScrollView>
      </ScreenContent>
    </View>
  );
}

/** The Agents sheet's way into a subagent's thread: linked read, the inspector, or the thread. */
function useNo3yOpenSubagent(parent: ScopedThreadRef | null) {
  const navigation = useNavigation();
  const openInspector = useOpenThreadInspector();
  const openLinkedRead = useOpenLinkedThreadRead();
  return (child: SubagentThreadTarget, title: string | null) => {
    if (parent === null) return;
    void Haptics.selectionAsync();
    if (child.linked !== undefined) {
      openLinkedRead(child, child.linked, title, { source: parent, replace: true });
      return;
    }
    if (
      openInspector(parent, {
        type: "thread",
        environmentId: child.environmentId,
        threadId: child.threadId,
      })
    )
      return;
    navigation.dispatch(
      StackActions.replace("Thread", {
        environmentId: child.environmentId,
        threadId: child.threadId,
      }),
    );
  };
}

type HeaderAction = Omit<FloatingStatusAction, "disabled"> & {
  readonly disabled?: boolean;
  readonly destructive?: boolean;
};

function Section(props: {
  readonly palette: FlatGlassPalette;
  readonly title: string;
  readonly count?: number;
  readonly action?: HeaderAction;
  readonly children: ReactNode;
}) {
  const { palette, action } = props;
  return (
    <View>
      <View
        style={{
          minHeight: PILL_HEIGHT,
          flexDirection: "row",
          alignItems: "center",
          marginLeft: 4,
          // The pill's right edge meets the stop buttons in the rows below.
          marginRight: 8,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ flex: 1, fontSize: 13, color: palette.sectionInk }}
        >
          {props.title}
          {props.count === undefined ? null : (
            <Text style={{ color: palette.faintInk, fontVariant: ["tabular-nums"] }}>
              {`  ${props.count}`}
            </Text>
          )}
        </Text>
        {action ? (
          <ActionPill palette={palette} action={action} stopGlyph={action.destructive} />
        ) : null}
      </View>
      <View
        style={{
          marginTop: 8,
          borderRadius: 20,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.controlBorder,
          backgroundColor: palette.controlSurface,
          overflow: "hidden",
        }}
      >
        {Children.toArray(props.children).map((child, index) =>
          index === 0 ? (
            child
          ) : (
            <View
              key={isValidElement(child) ? child.key : index}
              style={{
                borderTopWidth: StyleSheet.hairlineWidth,
                borderColor: palette.controlBorder,
              }}
            >
              {child}
            </View>
          ),
        )}
      </View>
    </View>
  );
}

const PILL_HEIGHT = 28;

/** The sheet's buttons: a quiet pill like the subagent rows' stop button, with its glyph to stop. */
function ActionPill(props: {
  readonly palette: FlatGlassPalette;
  readonly action: HeaderAction;
  readonly stopGlyph?: boolean;
}) {
  const { palette, action } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      hitSlop={8}
      onPress={action.onPress}
      style={({ pressed }) => ({
        minHeight: PILL_HEIGHT,
        borderRadius: PILL_HEIGHT / 2,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingLeft: props.stopGlyph ? 10 : 12,
        paddingRight: 12,
        backgroundColor: pressed ? palette.rowSelected : palette.circleFill,
        opacity: action.disabled ? 0.45 : 1,
      })}
    >
      {props.stopGlyph ? (
        <View
          style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: palette.foreground }}
        />
      ) : null}
      <Text style={{ ...NO3Y_FONT.medium, fontSize: 13, color: palette.foreground }}>
        {action.label}
      </Text>
    </Pressable>
  );
}

const TILE = 32;

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
        <View
          style={{
            width: TILE,
            height: TILE,
            borderRadius: 6,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.circleFill,
          }}
        >
          {props.leading}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          numberOfLines={props.titleLines ?? 1}
          style={{ ...NO3Y_FONT.medium, fontSize: 15, lineHeight: 20, color: palette.titleInk }}
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
        <View style={{ width: PILL_HEIGHT, alignItems: "center" }}>
          <HugeIcon icon={ArrowRight01Icon} size={14} color={palette.faintInk} />
        </View>
      ) : null}
    </>
  );
  const rowStyle = {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 12,
    paddingRight: props.chevron || action ? 8 : 12,
    paddingVertical: 10,
  } as const;
  return props.onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [
        rowStyle,
        { backgroundColor: pressed ? palette.rowSelected : "transparent" },
      ]}
    >
      {body}
    </Pressable>
  ) : (
    <View accessible style={rowStyle}>
      {body}
      {action ? (
        <ActionPill palette={palette} action={action} stopGlyph={props.destructive} />
      ) : null}
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
  readonly status: Exclude<No3yPillStatus, { kind: "background" | "child-input" }>;
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
    case "preparing":
      return <Row palette={palette} leading={leading} title={status.label} />;
  }
}
