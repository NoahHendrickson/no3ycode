/**
 * The Activity sheet the no3y thread status pill opens (`.fork/customizations.yaml#no3y-mobile-redesign`):
 * everything the pill counts, one glass card per kind, with the upstream control's actions, read
 * live from no3yStatusSheetStore.ts. It opens at half height and pulls up to full.
 */
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import ComputerTerminal01Icon from "@hugeicons/core-free-icons/ComputerTerminal01Icon";
import Globe02Icon from "@hugeicons/core-free-icons/Globe02Icon";
import LeftToRightListNumberIcon from "@hugeicons/core-free-icons/LeftToRightListNumberIcon";
import PuzzleIcon from "@hugeicons/core-free-icons/PuzzleIcon";
import Radar01Icon from "@hugeicons/core-free-icons/Radar01Icon";
import Robot01Icon from "@hugeicons/core-free-icons/Robot01Icon";
import SmartPhone01Icon from "@hugeicons/core-free-icons/SmartPhone01Icon";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../src/components/ui/AppText";
import { ScreenContent } from "../src/components/ui/ScreenContent";
import { SheetHeader } from "../src/components/ui/SheetHeader";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import type { FloatingStatusAction } from "../src/features/threads/floating-working-status";
import { useOpenSubagentThread } from "../src/features/threads/ThreadAgentsSheet";
import { resolveSubagentRowPresentation } from "../src/features/threads/threadAgentsPresentation";
import { useVisibleSecondClock } from "../src/features/threads/use-visible-second-clock";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import type { No3yPillStatus } from "./no3yPillStatus";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import { No3yAgentsSheetRow, NO3Y_TRAILING_SLOT } from "./No3yAgentsSheetRow";
import { no3yCardDivider, No3yGlassCard } from "./No3yGlassCard";
import { no3ySheetBackground } from "./no3ySheet";
import { No3yStatusGlyph } from "./No3yStatusPill";
import { statusAccessibilityLabel, No3yStatusMark } from "./No3yStatusMark";
import { no3yElapsedLabel, no3ySubagentMarkKind } from "./no3yStatusSegments";
import {
  useNo3yStatusSheetModel,
  type No3yStatusOpener,
  type No3yStatusSheetModel,
} from "./no3yStatusSheetStore";

type Leave = (open: () => void) => () => void;

export function No3yStatusSheet({ route }: StaticScreenProps<{ readonly threadKey: string }>) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const model = useNo3yStatusSheetModel(route.params.threadKey);
  const close = () => navigation.goBack();
  // Navigating rows leave the sheet first so their screen opens over the thread.
  const leaveThen: Leave = (open) => () => {
    close();
    open();
  };
  const sections =
    model === null
      ? []
      : [
          needsYouSection(model, palette, leaveThen),
          model.subagents === null ? (
            backgroundSubagentsSection(model, palette, leaveThen)
          ) : (
            <SubagentsSection
              key="subagents"
              subagents={model.subagents}
              palette={palette}
              leaveThen={leaveThen}
            />
          ),
          backgroundSection(model, palette, leaveThen),
          statusSection(model, palette),
          alsoOpenSection(model, palette, leaveThen),
        ].filter((section) => section !== null);
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

function needsYouSection(model: No3yStatusSheetModel, palette: FlatGlassPalette, leaveThen: Leave) {
  if (model.childInputs.length === 0) return null;
  return (
    <Section key="needs" palette={palette} title="Needs you">
      {model.childInputs.map((child, index) => (
        <Row
          key={child.id}
          palette={palette}
          divider={index > 0}
          leading={<No3yStatusMark kind={child.needs} palette={palette} />}
          title={child.title}
          meta={statusAccessibilityLabel(child.needs)}
          onPress={leaveThen(child.onOpen)}
          chevron
        />
      ))}
    </Section>
  );
}

/** The turn's subagents as the Agents sheet's rows; a workflow opens that sheet's grouped view. */
function SubagentsSection(props: {
  readonly subagents: NonNullable<No3yStatusSheetModel["subagents"]>;
  readonly palette: FlatGlassPalette;
  readonly leaveThen: Leave;
}) {
  const { subagents, palette } = props;
  const openSubagent = useOpenSubagentThread(subagents.thread);
  return (
    <Section palette={palette} title="Subagents" count={subagents.list.length}>
      {subagents.list.map((subagent, index) =>
        subagent.workflow === undefined ? (
          <No3yAgentsSheetRow
            key={subagent.id}
            environmentId={subagents.thread.environmentId}
            subagent={subagent}
            onOpen={openSubagent}
            divider={index > 0}
          />
        ) : (
          <WorkflowRow
            key={subagent.id}
            subagent={subagent}
            palette={palette}
            divider={index > 0}
            onPress={props.leaveThen(subagents.onOpenAll)}
          />
        ),
      )}
    </Section>
  );
}

/** A workflow as one row under its name; the Agents sheet groups its members. */
function WorkflowRow(props: {
  readonly subagent: NonNullable<No3yStatusSheetModel["subagents"]>["list"][number];
  readonly palette: FlatGlassPalette;
  readonly divider: boolean;
  readonly onPress: () => void;
}) {
  const { subagent, palette } = props;
  const presentation = resolveSubagentRowPresentation(subagent);
  const mark = no3ySubagentMarkKind(subagent.status);
  return (
    <Row
      palette={palette}
      divider={props.divider}
      leading={<HugeIcon icon={Robot01Icon} size={18} color={palette.foreground} />}
      title={subagent.workflow?.name ?? presentation.title}
      meta={presentation.statusLabel}
      // A stopped workflow has no mark; the status line speaks for the mark either way.
      trailing={
        mark === null ? null : (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <No3yStatusMark kind={mark} palette={palette} />
          </View>
        )
      }
      onPress={props.onPress}
      chevron
    />
  );
}

/** Subagents the pill knows only as background work, when it has no turn list for them. */
function backgroundSubagentsSection(
  model: No3yStatusSheetModel,
  palette: FlatGlassPalette,
  leaveThen: Leave,
) {
  const background = model.background;
  const items = background?.items.filter((item) => item.kind === "subagent") ?? [];
  if (background === null || items.length === 0) return null;
  const onlySubagents = items.length === background.items.length;
  return (
    <Section
      key="subagents"
      palette={palette}
      title="Subagents"
      count={items.length}
      stop={onlySubagents ? background.stop : null}
    >
      {items.map((item, index) => (
        <Row
          key={item.taskId}
          palette={palette}
          divider={index > 0}
          leading={<HugeIcon icon={Robot01Icon} size={18} color={palette.foreground} />}
          title={item.label}
          trailing={<No3yStatusMark kind="working" palette={palette} />}
          onPress={leaveThen(background.onOpenDetails)}
          chevron
        />
      ))}
    </Section>
  );
}

function backgroundSection(
  model: No3yStatusSheetModel,
  palette: FlatGlassPalette,
  leaveThen: Leave,
) {
  const background = model.background;
  const items = background?.items.filter((item) => item.kind !== "subagent") ?? [];
  if (background === null || items.length === 0) return null;
  return (
    <Section
      key="background"
      palette={palette}
      title="Background"
      count={items.length}
      stop={background.stop}
    >
      {items.map((item, index) => (
        <Row
          key={item.taskId}
          palette={palette}
          divider={index > 0}
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
          onPress={leaveThen(background.onOpenDetails)}
          chevron
        />
      ))}
    </Section>
  );
}

function statusSection(model: No3yStatusSheetModel, palette: FlatGlassPalette) {
  const { status } = model;
  if (status === null || status.kind === "background" || status.kind === "child-input") {
    return null;
  }
  return (
    <Section key="status" palette={palette} title="Status">
      <StatusRow palette={palette} status={status} />
    </Section>
  );
}

const OPENERS = [
  ["queue", LeftToRightListNumberIcon, "queued"],
  ["devicePreview", SmartPhone01Icon, "device preview"],
  ["browserPreview", Globe02Icon, "browser tab"],
] as const satisfies ReadonlyArray<readonly [keyof No3yStatusSheetModel, HugeIconData, string]>;

function alsoOpenSection(model: No3yStatusSheetModel, palette: FlatGlassPalette, leaveThen: Leave) {
  const openers = OPENERS.flatMap(([key, icon, noun]) => {
    const opener: No3yStatusOpener | null = model[key];
    return opener === null ? [] : [{ key, icon, noun, opener }];
  });
  if (model.extension === null && openers.length === 0) return null;
  const extension = model.extension;
  return (
    <Section key="others" palette={palette} title="Also open">
      {extension === null ? null : (
        <Row
          palette={palette}
          leading={<HugeIcon icon={PuzzleIcon} size={18} color={palette.foreground} />}
          title={extension.label}
          titleLines={3}
          onPress={extension.onPress}
          chevron
        />
      )}
      {openers.map(({ key, icon, noun, opener }, index) => (
        <Row
          key={key}
          palette={palette}
          divider={extension !== null || index > 0}
          leading={<HugeIcon icon={icon} size={18} color={palette.foreground} />}
          title={
            key === "queue"
              ? `${opener.count} queued`
              : `${opener.count} ${noun}${opener.count === 1 ? "" : "s"}`
          }
          onPress={leaveThen(opener.onPress)}
          chevron
        />
      ))}
    </Section>
  );
}

function Section(props: {
  readonly palette: FlatGlassPalette;
  readonly title: string;
  readonly count?: number;
  /** Stops the background work the section lists. */
  readonly stop?: FloatingStatusAction | null;
  readonly children: ReactNode;
}) {
  const { palette } = props;
  return (
    <View>
      <View
        style={{
          minHeight: NO3Y_TRAILING_SLOT,
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
        {props.stop ? <ActionPill palette={palette} action={props.stop} destructive /> : null}
      </View>
      <No3yGlassCard palette={palette}>{props.children}</No3yGlassCard>
    </View>
  );
}

/** The sheet's buttons: a quiet pill like the subagent rows' stop button, with its glyph to stop. */
function ActionPill(props: {
  readonly palette: FlatGlassPalette;
  readonly action: FloatingStatusAction;
  readonly destructive?: boolean;
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
        minHeight: NO3Y_TRAILING_SLOT,
        borderRadius: NO3Y_TRAILING_SLOT / 2,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingLeft: props.destructive ? 10 : 12,
        paddingRight: 12,
        backgroundColor: pressed ? palette.rowSelected : palette.circleFill,
        opacity: action.disabled ? 0.45 : 1,
      })}
    >
      {props.destructive ? (
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
  readonly divider?: boolean;
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
        <View style={{ width: NO3Y_TRAILING_SLOT, alignItems: "center" }}>
          <HugeIcon icon={ArrowRight01Icon} size={14} color={palette.faintInk} />
        </View>
      ) : null}
    </>
  );
  const rowStyle = [
    {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingLeft: 12,
      paddingRight: props.chevron || action ? 8 : 12,
      paddingVertical: 10,
    } as const,
    no3yCardDivider(palette, props.divider),
  ];
  if (props.onPress) {
    return (
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
    );
  }
  // The pill sits beside the accessible body, not inside it, so VoiceOver reaches both.
  return action ? (
    <View style={rowStyle}>
      <View
        accessible
        style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        {body}
      </View>
      <ActionPill palette={palette} action={action} destructive={props.destructive} />
    </View>
  ) : (
    <View accessible style={rowStyle}>
      {body}
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
