/**
 * The no3y Automations screen (`.fork/customizations.yaml#no3y-mobile-redesign`), the Mac's
 * Automations page in the Threads screen's language: a header with filter and +, each automation
 * as a card (schedule, next run or last error, on/off), then its runs, needs-you first, as cards.
 */
import ListFilterIcon from "@hugeicons/core-free-icons/ListFilterIcon";
import MoreHorizontalIcon from "@hugeicons/core-free-icons/MoreHorizontalIcon";
import PlusIcon from "@hugeicons/core-free-icons/PlusIcon";
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
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProjectFavicon } from "../src/components/ProjectFavicon";
import { AppText as Text } from "../src/components/ui/AppText";
import type { AppBarMenu } from "../src/components/ui/AppBar.types";
import * as Dialog from "../src/components/ui/Dialog";
import { Menu } from "../src/components/ui/Menu";
import { useThreadListActions } from "../src/features/home/useThreadListActions";
import { startOpeningDetail } from "../src/features/layout/workspace/useSelectWorkspaceDetail";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import type { SettingsTarget } from "../src/features/settings/settings-environment-filter";
import { formatNextScheduledTaskRun } from "../src/features/settings/scheduledTaskPresentation";
import { useThreadListNow } from "../src/features/threads/use-thread-list-now";
import { relativeTime } from "../src/lib/time";
import { NativeStackScreenOptions } from "../src/native/StackHeader";
import { useProjects } from "../src/state/entities";
import { useEnvironmentQuery } from "../src/state/query";
import { serverEnvironment } from "../src/state/server";
import { readEnvironmentScope } from "../src/state/session";
import { steadyNavigationThreadShellsAtom } from "../src/state/threads";
import { useAtomCommand } from "../src/state/use-atom-command";
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
import { groupNo3yRuns, NO3Y_RUN_GROUP_LABELS, NO3Y_RUNS_PAGE } from "./no3yAutomationRuns";
import { No3yCircleButton } from "./No3yControls";
import { findMenuItem, menuActions } from "./No3yScreenHeader";
import { No3yStatusMark } from "./No3yStatusMark";

const CARD_RADIUS = 16;

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

export function No3yAutomationsScreen(props: No3yAutomationsScreenProps) {
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  return (
    <View style={{ flex: 1, backgroundColor: palette.stageBackground }}>
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
        <Text
          accessibilityRole="header"
          style={{ flex: 1, ...NO3Y_FONT.medium, fontSize: 20, color: palette.foreground }}
        >
          Automations
        </Text>
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
          props.environments.map((environment) => (
            <EnvironmentAutomations
              key={environment.environmentId}
              environment={environment}
              showEnvironment={props.environments.length > 1}
              palette={palette}
              {...props}
            />
          ))
        )}
      </ScrollView>
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

  return (
    <View style={{ gap: 24 }}>
      <View>
        <SectionLabel palette={palette}>
          {props.showEnvironment ? `Automations · ${environment.label}` : "Automations"}
        </SectionLabel>
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
          <View style={{ gap: 8 }}>
            {visibleTasks.map((task) => (
              <AutomationCard
                key={task.id}
                task={task}
                palette={palette}
                schedule={props.describeSchedule(task, tasks.data?.timeZone)}
                next={
                  !task.enabled
                    ? "Paused"
                    : task.nextRunAt
                      ? formatNextScheduledTaskRun(task.nextRunAt, props.now)
                      : null
                }
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
          </View>
        )}
      </View>
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

function AutomationCard(props: {
  readonly task: ScheduledTask;
  readonly palette: FlatGlassPalette;
  readonly schedule: string;
  readonly next: string | null;
  readonly canOperate: boolean;
  readonly onEdit: () => void;
  readonly onToggle: () => void;
  readonly onRunNow: () => void;
  readonly onDelete: () => void;
  readonly onOpenThread: (() => void) | null;
}) {
  const { task, palette } = props;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        padding: 12,
        borderRadius: CARD_RADIUS,
        backgroundColor: palette.cardWash,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${task.title}`}
        onPress={props.onEdit}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, gap: 3, opacity: pressed ? 0.6 : 1 })}
      >
        <Text
          numberOfLines={1}
          style={{ ...NO3Y_FONT.medium, fontSize: 16, color: palette.titleInk }}
        >
          {task.title}
        </Text>
        <Text numberOfLines={2} style={{ fontSize: 13, color: palette.metaInk }}>
          {[props.schedule, props.next].filter(Boolean).join(" · ")}
        </Text>
        {task.blockedByPolicy ? (
          <Text numberOfLines={2} style={{ fontSize: 13, color: palette.metaInk }}>
            {task.blockedByPolicy}
          </Text>
        ) : null}
        {task.lastRunError ? (
          <Text numberOfLines={2} style={{ fontSize: 13, color: palette.statusFailed }}>
            Last run failed: {task.lastRunError}
          </Text>
        ) : null}
      </Pressable>
      <Switch
        accessibilityLabel={task.enabled ? `Pause ${task.title}` : `Resume ${task.title}`}
        value={task.enabled}
        disabled={!props.canOperate}
        onValueChange={props.onToggle}
        trackColor={{ true: palette.statusWorking, false: palette.controlBorder }}
      />
      <Menu
        accessibilityLabel={`Actions for ${task.title}`}
        actions={[
          { id: "edit", title: "Edit", image: "pencil" },
          ...(props.onOpenThread
            ? [{ id: "thread", title: "Open thread", image: "bubble.left" }]
            : []),
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
        <View
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${task.title}`}
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
        >
          <HugeIcon icon={MoreHorizontalIcon} size={18} color={palette.quietInk} />
        </View>
      </Menu>
    </View>
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
  const groups = groupNo3yRuns(runs, kindOf, limit);
  const projectTitle = (thread: EnvironmentThreadShell) =>
    projects.find(
      (project) =>
        project.environmentId === thread.environmentId && project.id === thread.projectId,
    ) ?? null;
  return (
    <View>
      <SectionLabel palette={palette}>Runs</SectionLabel>
      {runs.length === 0 ? (
        <Text style={{ fontSize: 14, color: palette.metaInk }}>
          No runs yet. Automation runs appear here instead of Threads.
        </Text>
      ) : (
        <View style={{ gap: 16 }}>
          {groups.map(({ group, runs: inGroup }) => (
            <View key={group} style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, ...NO3Y_FONT.medium, color: palette.metaInk }}>
                {NO3Y_RUN_GROUP_LABELS[group]}
              </Text>
              {inGroup.map((thread) => {
                const project = projectTitle(thread);
                const scheduledTaskId = thread.source.scheduledTaskId;
                const meta = [
                  scheduledTaskId === undefined ? undefined : props.taskTitles.get(scheduledTaskId),
                  project?.title,
                  relativeTime(resolveThreadActivityTimestamp(thread) ?? thread.createdAt),
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Menu
                    key={thread.id}
                    accessibilityLabel={`Actions for ${thread.title}`}
                    shouldOpenOnLongPress
                    actions={[
                      { id: "open", title: "Open", image: "arrow.up.right" },
                      { id: "settle", title: "Settle", image: "checkmark.circle" },
                      { id: "rename", title: "Rename", image: "pencil" },
                      { id: "archive", title: "Archive", image: "archivebox" },
                      {
                        id: "delete",
                        title: "Delete",
                        image: "trash",
                        attributes: { destructive: true },
                      },
                    ]}
                    onPressAction={({ nativeEvent }) => {
                      const action = nativeEvent.event;
                      if (action === "open") props.onOpen(thread);
                      else if (action === "settle") void actions.settleThread(thread);
                      else if (action === "rename") actions.renameThread(thread);
                      else if (action === "archive") void actions.archiveThread(thread);
                      else if (action === "delete") actions.confirmDeleteThread(thread);
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={thread.title}
                      onPress={() => props.onOpen(thread)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        padding: 12,
                        borderRadius: CARD_RADIUS,
                        backgroundColor: pressed ? palette.rowSelected : palette.cardWash,
                      })}
                    >
                      {project ? (
                        <ProjectFavicon
                          environmentId={thread.environmentId}
                          faviconPath={project.faviconPath}
                          projectIcon={project.projectIcon}
                          size={18}
                          projectTitle={project.title}
                          workspaceRoot={project.workspaceRoot}
                        />
                      ) : null}
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text
                          numberOfLines={1}
                          style={{ ...NO3Y_FONT.medium, fontSize: 15, color: palette.titleInk }}
                        >
                          {thread.title}
                        </Text>
                        <Text numberOfLines={1} style={{ fontSize: 13, color: palette.metaInk }}>
                          {meta}
                        </Text>
                      </View>
                      <No3yStatusMark kind={kindOf(thread)} palette={palette} idleMode="dot" />
                    </Pressable>
                  </Menu>
                );
              })}
            </View>
          ))}
          {runs.length > limit ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setLimit((current) => current + NO3Y_RUNS_PAGE)}
              style={({ pressed }) => ({
                alignSelf: "center",
                padding: 8,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ ...NO3Y_FONT.medium, fontSize: 14, color: palette.foreground }}>
                Show more ({runs.length - limit})
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}
