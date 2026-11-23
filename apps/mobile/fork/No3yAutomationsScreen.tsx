/**
 * The no3y Automations screen (`.fork/customizations.yaml#no3y-mobile-redesign`): an
 * "Automations | Runs" switch in the header beside filter and +, automations as two-column tiles
 * with an on/off switch, and runs as the Mac's compact runs table, needs-you first.
 */
import ListFilterIcon from "@hugeicons/core-free-icons/ListFilterIcon";
import PlusIcon from "@hugeicons/core-free-icons/PlusIcon";
import GitPullRequestIcon from "@hugeicons/core-free-icons/GitPullRequestIcon";
import { useAtomValue } from "@effect/atom-react";
import { StackActions, useNavigation } from "@react-navigation/native";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import { resolveThreadActivityTimestamp } from "@t3tools/client-runtime/state/thread-sort";
import {
  AuthOrchestrationOperateScope,
  scheduledTaskThreadMode,
  type EnvironmentId,
  type ProjectId,
  type ScheduledTask,
} from "@t3tools/contracts";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../src/components/ui/AppText";
import type { AppBarMenu } from "../src/components/ui/AppBar.types";
import * as Dialog from "../src/components/ui/Dialog";
import { Menu } from "../src/components/ui/Menu";
import { useThreadListActions } from "../src/features/home/useThreadListActions";
import { startOpeningDetail } from "../src/features/layout/workspace/useSelectWorkspaceDetail";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import type { SettingsTarget } from "../src/features/settings/settings-environment-filter";
import { useThreadListNow } from "../src/features/threads/use-thread-list-now";
import { relativeTime } from "../src/lib/time";
import { NativeStackScreenOptions } from "../src/native/StackHeader";
import { useProjects } from "../src/state/entities";
import { useEnvironmentQuery } from "../src/state/query";
import { serverEnvironment } from "../src/state/server";
import { readEnvironmentScope } from "../src/state/session";
import { steadyNavigationThreadShellsAtom } from "../src/state/threads";
import { useAtomCommand } from "../src/state/use-atom-command";
import { useThreadPr } from "../src/state/use-thread-pr";
import {
  flatGlassPalette,
  NO3Y_BOTTOM_NAV_CLEARANCE,
  NO3Y_FONT,
  type FlatGlassPalette,
} from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import {
  listNo3yAutomationRunThreads,
  resolveNo3yThreadCardStatusKind,
} from "./mobileStatusGrouping";
import { groupNo3yRuns, no3yAutomationTileStatus, NO3Y_RUNS_PAGE } from "./no3yAutomationRuns";
import { No3yCircleButton } from "./No3yControls";
import { useNo3yDockEnterStyle } from "./no3yDockMotion";
import { NO3Y_FADE_IN, NO3Y_FADE_OUT, NO3Y_LAYOUT, useNo3yToggleProgress } from "./no3yMotion";
import { No3yGlassLayer } from "./No3yGlass";
import { findMenuItem, menuActions } from "./No3yScreenHeader";
import { No3yStatusMark } from "./No3yStatusMark";

/** The fork's Switch: success green when on, a white thumb. */
const SWITCH_ON = "#00bc7d";
const SEGMENT_HEIGHT = 38;

type AutomationsTab = "automations" | "runs";
// The tab outlives the screen for this session, so returning from a run lands on Runs.
let lastTab: AutomationsTab = "automations";

export interface No3yAutomationsScreenProps {
  readonly environments: ReadonlyArray<SettingsTarget>;
  /** The selected project filter's ids in an environment, or null for every project. */
  readonly projectIdsFor: (environmentId: EnvironmentId) => ReadonlyArray<ProjectId> | null;
  readonly projectKeys: ReadonlySet<string> | null;
  readonly now: number;
  readonly describeSchedule: (task: ScheduledTask, timeZone?: string) => string;
  readonly onEdit: (environment: SettingsTarget, task: ScheduledTask) => void;
  readonly onNew: () => void;
  readonly environmentMenu: AppBarMenu;
  readonly emptyMessage: string;
}

function TabSegment(props: {
  readonly label: string;
  readonly selected: boolean;
  readonly palette: FlatGlassPalette;
  readonly onPress: () => void;
}) {
  const { palette } = props;
  // The selected wash fades between the segments rather than jumping.
  const on = useNo3yToggleProgress(props.selected);
  const washStyle = useAnimatedStyle(() => ({ opacity: on.get() }));
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={{
        height: SEGMENT_HEIGHT - 6,
        paddingHorizontal: 14,
        justifyContent: "center",
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: (SEGMENT_HEIGHT - 6) / 2,
            backgroundColor: palette.activePillSurface,
          },
          washStyle,
        ]}
      />
      <Text
        style={{
          ...NO3Y_FONT.medium,
          fontSize: 15,
          color: props.selected ? palette.titleInk : palette.quietInk,
        }}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

function TabSwitch(props: {
  readonly tab: AutomationsTab;
  readonly palette: FlatGlassPalette;
  readonly onChange: (tab: AutomationsTab) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{ height: SEGMENT_HEIGHT, flexDirection: "row", alignItems: "center", padding: 3 }}
    >
      <No3yGlassLayer radius={SEGMENT_HEIGHT / 2} />
      <TabSegment
        label="Automations"
        selected={props.tab === "automations"}
        palette={props.palette}
        onPress={() => props.onChange("automations")}
      />
      <TabSegment
        label="Runs"
        selected={props.tab === "runs"}
        palette={props.palette}
        onPress={() => props.onChange("runs")}
      />
    </View>
  );
}

export function No3yAutomationsScreen(props: No3yAutomationsScreenProps) {
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const [tab, setTab] = useState(lastTab);
  const dockEnterStyle = useNo3yDockEnterStyle();
  const changeTab = (next: AutomationsTab) => {
    lastTab = next;
    setTab(next);
  };
  return (
    <View style={{ flex: 1, backgroundColor: palette.stageBackground }}>
      <Animated.View style={dockEnterStyle}>
        <NativeStackScreenOptions options={{ headerShown: false }} />
        <View
          style={{
            paddingTop: insets.top,
            height: insets.top + 68,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TabSwitch tab={tab} palette={palette} onChange={changeTab} />
          <View style={{ flex: 1 }} />
          <Menu
            accessibilityLabel={props.environmentMenu.title}
            actions={menuActions(props.environmentMenu.items)}
            onPressAction={({ nativeEvent }) =>
              findMenuItem(props.environmentMenu.items, nativeEvent.event)?.()
            }
          >
            <No3yCircleButton
              palette={palette}
              accessibilityLabel={props.environmentMenu.title}
              icon={ListFilterIcon}
            />
          </Menu>
          <No3yCircleButton
            palette={palette}
            accessibilityLabel="New automation"
            icon={PlusIcon}
            disabled={props.environments.length === 0}
            onPress={props.onNew}
          />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom, 18) + 18 + NO3Y_BOTTOM_NAV_CLEARANCE,
            gap: 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {props.environments.length === 0 ? (
            <Text style={{ fontSize: 15, color: palette.metaInk }}>{props.emptyMessage}</Text>
          ) : (
            // The tab's content fades in as the switch changes.
            <Animated.View key={tab} entering={NO3Y_FADE_IN} style={{ gap: 24 }}>
              {props.environments.map((environment) => (
                <EnvironmentAutomations
                  key={environment.environmentId}
                  environment={environment}
                  showEnvironment={props.environments.length > 1}
                  palette={palette}
                  tab={tab}
                  {...props}
                />
              ))}
            </Animated.View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function SectionLabel(props: { readonly palette: FlatGlassPalette; readonly children: ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        ...NO3Y_FONT.medium,
        fontSize: 13,
        color: props.palette.sectionInk,
        paddingBottom: 8,
      }}
    >
      {props.children}
    </Text>
  );
}

function EnvironmentAutomations(
  props: No3yAutomationsScreenProps & {
    readonly environment: SettingsTarget;
    readonly showEnvironment: boolean;
    readonly palette: FlatGlassPalette;
    readonly tab: AutomationsTab;
  },
) {
  const { environment, palette } = props;
  const environmentId = environment.environmentId;
  const navigation = useNavigation();
  const tasks = useEnvironmentQuery(
    serverEnvironment.scheduledTasksLive({ environmentId, input: {} }),
  );
  const projectIds = props.projectIdsFor(environmentId);
  const visibleTasks =
    tasks.data?.tasks.filter(
      (task) => projectIds === null || projectIds.includes(task.projectId),
    ) ?? [];
  const canOperate = useAtomValue(
    serverEnvironment.upsertScheduledTask.permissionAtom(environmentId),
  );
  const setEnabled = useAtomCommand(serverEnvironment.setScheduledTaskEnabled, {
    label: "scheduled task enabled",
    reportFailure: false,
  });
  const runNow = useAtomCommand(serverEnvironment.runScheduledTaskNow, {
    label: "scheduled task run",
    reportFailure: false,
  });
  const remove = useAtomCommand(serverEnvironment.deleteScheduledTask, {
    label: "scheduled task delete",
    reportFailure: false,
  });
  const failure = (title: string, result: AtomCommandResult<unknown, unknown>) => {
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      Dialog.alert(title, String(squashAtomCommandFailure(result)));
    }
  };
  const act = async (task: ScheduledTask, action: "run" | "toggle" | "delete") => {
    if (!readEnvironmentScope(environmentId, AuthOrchestrationOperateScope)) return;
    const result =
      action === "run"
        ? await runNow({ environmentId, input: { id: task.id } })
        : action === "toggle"
          ? await setEnabled({ environmentId, input: { id: task.id, enabled: !task.enabled } })
          : await remove({ environmentId, input: { id: task.id } });
    failure(`Could not ${action === "toggle" ? "update" : action} automation`, result);
  };
  // A run is pushed over Automations, so back (button or swipe) returns here, scroll and all.
  const openThread = (threadId: string) => {
    const detail = {
      name: "Thread",
      params: { environmentId: String(environmentId), threadId },
    } as const;
    startOpeningDetail(detail);
    navigation.dispatch(StackActions.push("Thread", detail.params));
  };
  const taskTitles = new Map(visibleTasks.map((task) => [task.id, task.title] as const));
  const label = props.tab === "runs" ? "Runs" : "Automations";

  if (props.tab === "runs") {
    return (
      <View>
        {props.showEnvironment ? (
          <SectionLabel palette={palette}>{`${label} · ${environment.label}`}</SectionLabel>
        ) : null}
        <AutomationRuns
          environmentId={environmentId}
          projectKeys={props.projectKeys}
          taskTitles={taskTitles}
          palette={palette}
          onOpen={(thread) => openThread(String(thread.id))}
        />
      </View>
    );
  }

  const rows: Array<ReadonlyArray<ScheduledTask>> = [];
  for (let index = 0; index < visibleTasks.length; index += 2) {
    rows.push(visibleTasks.slice(index, index + 2));
  }
  return (
    <View>
      {props.showEnvironment ? (
        <SectionLabel palette={palette}>{`${label} · ${environment.label}`}</SectionLabel>
      ) : null}
      {tasks.error ? (
        <Text style={{ fontSize: 14, color: palette.statusFailed }}>{tasks.error}</Text>
      ) : !tasks.data ? (
        <Text style={{ fontSize: 14, color: palette.metaInk }}>Loading automations…</Text>
      ) : visibleTasks.length === 0 ? (
        <Text style={{ fontSize: 14, color: palette.metaInk }}>
          {projectIds === null
            ? "No automations yet. Tap + to create one."
            : "No automations in this project."}
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((row) => (
            <Animated.View
              key={row[0]!.id}
              layout={NO3Y_LAYOUT}
              exiting={NO3Y_FADE_OUT}
              style={{ flexDirection: "row", gap: 10 }}
            >
              {row.map((task) => (
                <AutomationTile
                  key={task.id}
                  task={task}
                  palette={palette}
                  schedule={props.describeSchedule(task, tasks.data?.timeZone)}
                  now={props.now}
                  canOperate={canOperate}
                  onEdit={() => props.onEdit(environment, task)}
                  onToggle={() => void act(task, "toggle")}
                  onRunNow={() => void act(task, "run")}
                  onDelete={() =>
                    Dialog.alert("Delete automation?", task.title, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => void act(task, "delete"),
                      },
                    ])
                  }
                  onOpenThread={
                    task.threadId !== null && scheduledTaskThreadMode(task) !== "new_thread"
                      ? () => openThread(String(task.threadId))
                      : null
                  }
                />
              ))}
              {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
}

function AutomationTile(props: {
  readonly task: ScheduledTask;
  readonly palette: FlatGlassPalette;
  readonly schedule: string;
  readonly now: number;
  readonly canOperate: boolean;
  readonly onEdit: () => void;
  readonly onToggle: () => void;
  readonly onRunNow: () => void;
  readonly onDelete: () => void;
  readonly onOpenThread: (() => void) | null;
}) {
  const { task, palette } = props;
  const status = no3yAutomationTileStatus(task, props.now);
  // Off tiles read dimmer; the switch keeps full strength so turning one back on is obvious.
  const dim = task.enabled ? 1 : 0.45;
  return (
    <Menu
      accessibilityLabel={`Actions for ${task.title}`}
      shouldOpenOnLongPress
      style={{ flex: 1, minWidth: 0 }}
      actions={[
        ...(task.schedule.type === "webhook"
          ? []
          : [
              {
                id: "run",
                title: "Run now",
                image: "play",
                attributes: { disabled: !props.canOperate },
              },
            ]),
        { id: "edit", title: "Edit", image: "pencil" },
        ...(props.onOpenThread
          ? [{ id: "thread", title: "Open thread", image: "bubble.left" }]
          : []),
        {
          id: "delete",
          title: "Delete",
          image: "trash",
          attributes: { destructive: true, disabled: !props.canOperate },
        },
      ]}
      onPressAction={({ nativeEvent }) => {
        const action = nativeEvent.event;
        if (action === "edit") props.onEdit();
        else if (action === "thread") props.onOpenThread?.();
        else if (action === "run") props.onRunNow();
        else if (action === "delete") props.onDelete();
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${task.title}`}
        onPress={props.onEdit}
        style={({ pressed }) => ({
          flexGrow: 1,
          gap: 10,
          padding: 14,
          borderRadius: 16,
          backgroundColor: pressed ? palette.rowSelected : palette.cardWash,
        })}
      >
        <View style={{ flexGrow: 1, gap: 4, opacity: dim }}>
          <Text
            numberOfLines={2}
            style={{ ...NO3Y_FONT.medium, fontSize: 15, lineHeight: 20, color: palette.titleInk }}
          >
            {task.title}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 17, color: palette.metaInk }}>
            {props.schedule}
          </Text>
          {task.blockedByPolicy ? (
            <Text numberOfLines={2} style={{ fontSize: 13, color: palette.metaInk }}>
              {task.blockedByPolicy}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              opacity: dim,
            }}
          >
            <No3yStatusMark kind={status.mark} palette={palette} idleMode="dot" />
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontSize: 13,
                color: status.mark === "failed" ? palette.statusFailed : palette.metaInk,
              }}
            >
              {status.line}
            </Text>
          </View>
          <Switch
            accessibilityLabel={task.enabled ? `Pause ${task.title}` : `Resume ${task.title}`}
            value={task.enabled}
            disabled={!props.canOperate}
            onValueChange={props.onToggle}
            trackColor={{ true: SWITCH_ON, false: palette.controlBorder }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={palette.controlBorder}
            style={{ transform: [{ scale: 0.8 }], marginRight: -6 }}
          />
        </View>
      </Pressable>
    </Menu>
  );
}

function RunRow(props: {
  readonly thread: EnvironmentThreadShell;
  readonly kind: ReturnType<typeof resolveNo3yThreadCardStatusKind>;
  readonly automation: string | undefined;
  readonly project: EnvironmentProject | null;
  readonly palette: FlatGlassPalette;
  readonly onOpen: () => void;
  readonly actions: ReturnType<typeof useThreadListActions>;
}) {
  const { thread, palette, actions } = props;
  const pr = useThreadPr(thread);
  const meta = [props.automation, props.project?.title].filter(Boolean).join(" · ");
  return (
    <Menu
      accessibilityLabel={`Actions for ${thread.title}`}
      shouldOpenOnLongPress
      actions={[
        { id: "open", title: "Open", image: "arrow.up.right" },
        { id: "settle", title: "Settle", image: "checkmark.circle" },
        { id: "rename", title: "Rename", image: "pencil" },
        { id: "archive", title: "Archive", image: "archivebox" },
        { id: "delete", title: "Delete", image: "trash", attributes: { destructive: true } },
      ]}
      onPressAction={({ nativeEvent }) => {
        const action = nativeEvent.event;
        if (action === "open") props.onOpen();
        else if (action === "settle") void actions.settleThread(thread);
        else if (action === "rename") actions.renameThread(thread);
        else if (action === "archive") void actions.archiveThread(thread);
        else if (action === "delete") actions.confirmDeleteThread(thread);
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[thread.title, meta].filter(Boolean).join(", ")}
        onPress={props.onOpen}
        style={({ pressed }) => ({
          height: 40,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: palette.hairline,
          backgroundColor: pressed ? palette.rowPressed : "transparent",
        })}
      >
        <No3yStatusMark kind={props.kind} palette={palette} idleMode="dot" />
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontSize: 14, ...NO3Y_FONT.regular, color: palette.titleInk }}
        >
          {thread.title}
        </Text>
        {meta.length > 0 ? (
          <Text
            numberOfLines={1}
            style={{ maxWidth: "38%", fontSize: 13, ...NO3Y_FONT.regular, color: palette.metaInk }}
          >
            {meta}
          </Text>
        ) : null}
        {pr ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <HugeIcon
              icon={GitPullRequestIcon}
              size={12}
              color={pr.state === "open" || pr.state === null ? palette.prOpen : palette.metaInk}
              strokeWidth={1.5}
            />
            <Text
              style={{
                fontSize: 12,
                fontVariant: ["tabular-nums"],
                color: pr.state === "open" || pr.state === null ? palette.prOpen : palette.metaInk,
              }}
            >
              {pr.label}
            </Text>
          </View>
        ) : null}
        <Text
          style={{
            minWidth: 28,
            textAlign: "right",
            fontSize: 12,
            fontVariant: ["tabular-nums"],
            color: palette.faintInk,
          }}
        >
          {relativeTime(resolveThreadActivityTimestamp(thread) ?? thread.createdAt)}
        </Text>
      </Pressable>
    </Menu>
  );
}

function AutomationRuns(props: {
  readonly environmentId: EnvironmentId;
  readonly projectKeys: ReadonlySet<string> | null;
  readonly taskTitles: ReadonlyMap<string, string>;
  readonly palette: FlatGlassPalette;
  readonly onOpen: (thread: EnvironmentThreadShell) => void;
}) {
  const { palette } = props;
  const [limit, setLimit] = useState(NO3Y_RUNS_PAGE);
  const threads = useAtomValue(steadyNavigationThreadShellsAtom);
  const projects = useProjects();
  const actions = useThreadListActions();
  const runs = listNo3yAutomationRunThreads({
    threads,
    environmentIds: new Set([props.environmentId]),
    projectKeys: props.projectKeys,
  });
  const nowIso = useThreadListNow(runs);
  const kindOf = (thread: EnvironmentThreadShell) =>
    resolveNo3yThreadCardStatusKind(thread, { now: nowIso });
  const shown = groupNo3yRuns(runs, kindOf, limit).flatMap((group) => group.runs);
  const projectOf = (thread: EnvironmentThreadShell) =>
    projects.find(
      (project) =>
        project.environmentId === thread.environmentId && project.id === thread.projectId,
    ) ?? null;
  if (runs.length === 0) {
    return (
      <Text style={{ fontSize: 14, color: palette.metaInk }}>
        No runs yet. Automation runs appear here instead of Threads.
      </Text>
    );
  }
  return (
    // The table's dividers run edge to edge, past the screen's side padding.
    <View
      style={{
        marginHorizontal: -16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.hairline,
      }}
    >
      {shown.map((thread) => {
        const scheduledTaskId = thread.source.scheduledTaskId;
        return (
          <Animated.View key={thread.id} layout={NO3Y_LAYOUT} exiting={NO3Y_FADE_OUT}>
            <RunRow
              thread={thread}
              kind={kindOf(thread)}
              automation={
                scheduledTaskId === undefined ? undefined : props.taskTitles.get(scheduledTaskId)
              }
              project={projectOf(thread)}
              palette={palette}
              actions={actions}
              onOpen={() => props.onOpen(thread)}
            />
          </Animated.View>
        );
      })}
      {runs.length > limit ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setLimit((current) => current + NO3Y_RUNS_PAGE)}
          style={({ pressed }) => ({
            alignSelf: "center",
            padding: 10,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ ...NO3Y_FONT.medium, fontSize: 14, color: palette.foreground }}>
            Show more ({runs.length - limit})
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
