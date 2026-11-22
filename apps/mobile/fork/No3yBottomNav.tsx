/**
 * Always-visible Flat Glass bottom navigation bar (4 items, New agent centered)
 * with long-press peek sheets — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import { useAtomValue } from "@effect/atom-react";
import { CommonActions, useNavigation, type NavigationState } from "@react-navigation/native";
import { filterForkRosterVisibleThreads } from "./forkRosterVisibility";
import { sidebarV2StatusBucketForKind } from "./forkStatusGrouping";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProjectFavicon } from "../src/components/ProjectFavicon";
import { SymbolView, type AppSymbolName } from "../src/components/ui/AppSymbol";
import { AppText as Text } from "../src/components/ui/AppText";
import { GlassSurface } from "../src/components/ui/GlassSurface";
import { OverlayPortal } from "../src/components/ui/OverlayPortal";
import { useAdaptiveWorkspaceLayout } from "../src/features/layout/adaptive-workspace-context";
import { isWorkspaceOverlayRoute } from "../src/features/layout/workspace-overlay-routes";
import { openSettings } from "../src/features/settings/settings-navigation";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { isDuoDevice } from "../src/lib/device-type";
import { uuidv4 } from "../src/lib/uuid";
import { useDeviceType } from "../src/native/native-layout-metrics";
import { useProjects, useServerConfigs } from "../src/state/entities";
import { steadyNavigationThreadShellsAtom } from "../src/state/threads";
import { useThreadListNow } from "../src/features/threads/use-thread-list-now";
import {
  flatGlassPalette,
  NO3Y_BOTTOM_NAV_BAR_HEIGHT,
  NO3Y_BOTTOM_NAV_BOTTOM_MARGIN,
  type FlatGlassPalette,
} from "./flatGlassTheme";
import {
  buildScratchProjectKeySet,
  isNo3yChatThread,
  listNo3yAutomationRunThreads,
  resolveActiveNo3yNavItem,
  resolveNo3yThreadCardStatusKind,
  selectNo3yNavPeekItems,
  shouldShowNo3yBottomNav,
  type No3yNavItemId,
  type No3yNavPeekEntry,
} from "./mobileStatusGrouping";
import { No3yStatusMark } from "./No3yStatusMark";

const PEEK_TITLES: Record<No3yNavItemId, string> = {
  threads: "Working & needs input",
  automations: "Recent automation runs",
  newAgent: "Quick start in project",
  chat: "Recent chats",
};

const PEEK_EMPTY_COPY: Record<No3yNavItemId, string> = {
  threads: "No agents running or waiting for input.",
  automations: "No recent automation runs yet.",
  newAgent: "No projects available yet.",
  chat: "No quick chats yet.",
};

function NavTabButton(props: {
  readonly icon: AppSymbolName;
  readonly label: string;
  readonly active: boolean;
  readonly badgeColor?: string | null;
  readonly palette: FlatGlassPalette;
  readonly onPress: () => void;
  readonly onLongPress: () => void;
}) {
  const { palette, active } = props;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={props.label}
      accessibilityHint="Long-press to peek"
      accessibilityState={{ selected: active }}
      delayLongPress={300}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        height: 46,
        borderRadius: 23,
        paddingHorizontal: 6,
        backgroundColor: active
          ? palette.activePillSurface
          : pressed
            ? palette.rowPressed
            : "transparent",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ position: "relative", alignItems: "center", justifyContent: "center" }}>
        <SymbolView
          name={props.icon}
          size={19}
          tintColor={active ? palette.foreground : palette.quietInk}
          type="monochrome"
          weight={active ? "semibold" : "regular"}
        />
        {props.badgeColor ? (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -7,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: props.badgeColor,
            }}
          />
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 2,
          fontSize: 10,
          lineHeight: 12,
          fontWeight: active ? "600" : "500",
          color: active ? palette.foreground : palette.quietInk,
        }}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

function No3yPeekSheet(props: {
  readonly item: No3yNavItemId;
  readonly entries: ReadonlyArray<No3yNavPeekEntry>;
  readonly bottomOffset: number;
  readonly palette: FlatGlassPalette;
  readonly onClose: () => void;
  readonly onOpenThread: (thread: EnvironmentThreadShell) => void;
  readonly onStartInProject: (project: EnvironmentProject) => void;
  readonly footerAction?:
    | { readonly label: string; readonly icon: AppSymbolName; readonly onPress: () => void }
    | undefined;
}) {
  const { palette } = props;
  return (
    <OverlayPortal>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close peek list"
          onPress={props.onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.peekBackdrop }]}
        />
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: props.bottomOffset,
          }}
        >
          <GlassSurface
            glassEffectStyle="regular"
            tintColor={palette.panelTint}
            fallbackColor={palette.panelFallback}
            style={{
              borderRadius: 20,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: palette.panelBorder,
              maxHeight: 340,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 16,
                  fontWeight: "600",
                  color: palette.quietInk,
                }}
              >
                {PEEK_TITLES[props.item]}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close peek"
                hitSlop={10}
                onPress={props.onClose}
              >
                <SymbolView
                  name="xmark.circle.fill"
                  size={18}
                  tintColor={palette.faintInk}
                  type="monochrome"
                />
              </Pressable>
            </View>
            {/* Full-width edge-to-edge divider per fork design defaults. */}
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.hairline }} />
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {props.entries.length === 0 ? (
                <View style={{ paddingHorizontal: 16, paddingVertical: 20 }}>
                  <Text style={{ fontSize: 13, lineHeight: 18, color: palette.quietInk }}>
                    {PEEK_EMPTY_COPY[props.item]}
                  </Text>
                </View>
              ) : (
                props.entries.map((entry, index) => (
                  <View key={entry.key}>
                    {index > 0 ? (
                      <View
                        style={{
                          height: StyleSheet.hairlineWidth,
                          backgroundColor: palette.hairline,
                        }}
                      />
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        props.onClose();
                        if (entry.kind === "thread") props.onOpenThread(entry.thread);
                        else props.onStartInProject(entry.project);
                      }}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingHorizontal: 16,
                        paddingVertical: 11,
                        backgroundColor: pressed ? palette.rowPressed : "transparent",
                      })}
                    >
                      {entry.kind === "project" ? (
                        <ProjectFavicon
                          environmentId={entry.project.environmentId}
                          faviconPath={entry.project.faviconPath}
                          projectIcon={entry.project.projectIcon}
                          size={16}
                          projectTitle={entry.project.title}
                          workspaceRoot={entry.project.workspaceRoot}
                        />
                      ) : null}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 14,
                            lineHeight: 18,
                            fontWeight: "400",
                            color: palette.foreground,
                          }}
                        >
                          {entry.kind === "thread" ? entry.thread.title : entry.project.title}
                        </Text>
                        {entry.subtitle ? (
                          <Text
                            numberOfLines={1}
                            style={{
                              marginTop: 2,
                              fontSize: 12,
                              lineHeight: 15,
                              color: palette.quietInk,
                            }}
                          >
                            {entry.subtitle}
                          </Text>
                        ) : null}
                      </View>
                      {entry.kind === "thread" ? (
                        <No3yStatusMark
                          kind={entry.statusKind}
                          seed={entry.key}
                          palette={palette}
                          idleMode="dot"
                        />
                      ) : (
                        <SymbolView
                          name="plus"
                          size={16}
                          tintColor={palette.quietInk}
                          type="monochrome"
                        />
                      )}
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
            {props.footerAction ? (
              <>
                <View
                  style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.hairline }}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    props.onClose();
                    props.footerAction?.onPress();
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    backgroundColor: pressed ? palette.rowPressed : "transparent",
                  })}
                >
                  <SymbolView
                    name={props.footerAction.icon}
                    size={14}
                    tintColor={palette.foreground}
                    type="monochrome"
                    weight="medium"
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      lineHeight: 16,
                      fontWeight: "600",
                      color: palette.foreground,
                    }}
                  >
                    {props.footerAction.label}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </GlassSurface>
        </View>
      </View>
    </OverlayPortal>
  );
}

/** Whether the compact iPhone Flat Glass bottom nav is active for this device/layout. */
export function useNo3yBottomNavEnabled(): boolean {
  const deviceType = useDeviceType();
  const { layout } = useAdaptiveWorkspaceLayout();
  return (
    Platform.OS === "ios" &&
    deviceType !== "pad" &&
    !layout.usesSplitView &&
    !isDuoDevice(deviceType)
  );
}

export function No3yBottomNavHost(props: { readonly state: NavigationState }) {
  const enabled = useNo3yBottomNavEnabled();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardState((keyboard) => keyboard.height);
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const { openWorkspaceTab, selectDetail, startNewTask } = useAdaptiveWorkspaceLayout();
  const threads = useAtomValue(steadyNavigationThreadShellsAtom);
  const projects = useProjects();
  const serverConfigs = useServerConfigs();
  const [peekItem, setPeekItem] = useState<No3yNavItemId | null>(null);

  const visibleRoutes = props.state.routes.slice(0, props.state.index + 1);
  const topRoute = visibleRoutes.at(-1);
  const isOverlay = topRoute !== undefined && isWorkspaceOverlayRoute(topRoute.name);
  const visible =
    enabled &&
    keyboardHeight <= 0 &&
    shouldShowNo3yBottomNav({ topRouteName: topRoute?.name, isOverlayRoute: isOverlay });

  const activeItem = resolveActiveNo3yNavItem(visibleRoutes);

  const scratchProjectKeys = useMemo(() => {
    const roots = new Map(
      [...serverConfigs.entries()].map(
        ([envId, cfg]) => [envId, cfg.scratchWorkspaceRoot] as const,
      ),
    );
    return buildScratchProjectKeySet(projects, roots);
  }, [projects, serverConfigs]);

  const nowIso = useThreadListNow(threads);
  const threadsBadgeColor = useMemo(() => {
    let hasWorking = false;
    for (const thread of filterForkRosterVisibleThreads(threads)) {
      if (thread.settledOverride === "settled") continue;
      if (isNo3yChatThread(thread, scratchProjectKeys)) continue;
      const kind = resolveNo3yThreadCardStatusKind(thread, { now: nowIso });
      const bucket = sidebarV2StatusBucketForKind(kind);
      if (bucket === "input") return palette.statusAttention;
      if (bucket === "working") hasWorking = true;
    }
    return hasWorking ? palette.statusWorking : null;
  }, [threads, scratchProjectKeys, nowIso, palette.statusAttention, palette.statusWorking]);

  const automationsBadgeColor = useMemo(() => {
    let hasWorking = false;
    for (const thread of listNo3yAutomationRunThreads({ threads })) {
      if (thread.pinnedAt != null) continue;
      const kind = resolveNo3yThreadCardStatusKind(thread, { now: nowIso });
      if (kind === "approval" || kind === "input" || kind === "request" || kind === "limited") {
        return palette.statusAttention;
      }
      if (kind === "failed") return palette.statusFailed;
      if (kind === "working" || kind === "waiting") hasWorking = true;
    }
    return hasWorking ? palette.statusWorking : null;
  }, [threads, nowIso, palette.statusAttention, palette.statusFailed, palette.statusWorking]);

  const peekEntries = useMemo(() => {
    if (peekItem === null) return [];
    return selectNo3yNavPeekItems({
      item: peekItem,
      threads,
      projects,
      scratchProjectKeys,
      now: nowIso,
    });
  }, [peekItem, threads, projects, scratchProjectKeys, nowIso]);

  if (!visible) return null;

  const bottomOffset = Math.max(insets.bottom, 10) + NO3Y_BOTTOM_NAV_BOTTOM_MARGIN;

  const openPeek = (item: No3yNavItemId) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPeekItem(item);
  };

  const handlePressThreads = () => {
    Keyboard.dismiss();
    setPeekItem(null);
    openWorkspaceTab("threads");
  };

  const handlePressAutomations = () => {
    Keyboard.dismiss();
    setPeekItem(null);
    openSettings(navigation, "SettingsScheduledTasks");
  };

  const handlePressNewAgent = () => {
    Keyboard.dismiss();
    setPeekItem(null);
    startNewTask();
  };

  const handlePressChat = () => {
    Keyboard.dismiss();
    setPeekItem(null);
    navigation.dispatch((state) => {
      const home = state.routes.find((route) => route.name === "Home") ?? { name: "Home" };
      const existingChat = state.routes.find((route) => route.name === "No3yChat");
      const routes = [home, existingChat ?? { name: "No3yChat" }];
      return CommonActions.reset({ ...state, index: routes.length - 1, routes });
    });
  };

  const handleOpenThread = (thread: EnvironmentThreadShell) => {
    selectDetail?.({
      name: "Thread",
      params: { environmentId: String(thread.environmentId), threadId: String(thread.id) },
    });
  };

  const handleStartInProject = (project: EnvironmentProject) => {
    selectDetail?.({
      name: "Thread",
      params: {
        draft: {
          requestId: uuidv4(),
          environmentId: String(project.environmentId),
          projectId: String(project.id),
          title: project.title,
        },
      },
    });
  };

  const peekFooterAction =
    peekItem === "automations"
      ? {
          label: "New automation",
          icon: "plus" as const,
          onPress: () => openSettings(navigation, "SettingsScheduledTaskNew"),
        }
      : peekItem === "newAgent"
        ? {
            label: "Choose project…",
            icon: "folder" as const,
            onPress: () => navigation.navigate("NewTaskProject"),
          }
        : peekItem === "chat"
          ? {
              label: "Open Chat",
              icon: "text.bubble" as const,
              onPress: handlePressChat,
            }
          : undefined;

  return (
    <>
      {peekItem !== null ? (
        <No3yPeekSheet
          item={peekItem}
          entries={peekEntries}
          bottomOffset={bottomOffset + NO3Y_BOTTOM_NAV_BAR_HEIGHT + 10}
          palette={palette}
          onClose={() => setPeekItem(null)}
          onOpenThread={handleOpenThread}
          onStartInProject={handleStartInProject}
          footerAction={peekFooterAction}
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: bottomOffset,
          zIndex: 60,
        }}
      >
        <GlassSurface
          glassEffectStyle="regular"
          tintColor={palette.panelTint}
          fallbackColor={palette.panelFallback}
          style={{
            height: NO3Y_BOTTOM_NAV_BAR_HEIGHT,
            borderRadius: NO3Y_BOTTOM_NAV_BAR_HEIGHT / 2,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: palette.panelBorder,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 6,
          }}
        >
          {/* Left half: Threads + Automations */}
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 2 }}>
            <NavTabButton
              icon="chevron.left.forwardslash.chevron.right"
              label="Threads"
              active={activeItem === "threads"}
              badgeColor={threadsBadgeColor}
              palette={palette}
              onPress={handlePressThreads}
              onLongPress={() => openPeek("threads")}
            />
            <NavTabButton
              icon="bolt.circle"
              label="Automations"
              active={activeItem === "automations"}
              badgeColor={automationsBadgeColor}
              palette={palette}
              onPress={handlePressAutomations}
              onLongPress={() => openPeek("automations")}
            />
          </View>

          {/* Center: New agent */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New agent"
            accessibilityHint="Starts a new agent thread. Long-press to pick a recent project."
            delayLongPress={300}
            onPress={handlePressNewAgent}
            onLongPress={() => openPeek("newAgent")}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              marginHorizontal: 6,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                activeItem === "newAgent"
                  ? palette.centerButtonActiveSurface
                  : palette.centerButtonSurface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: palette.activePillBorder,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <SymbolView
              name="plus"
              size={20}
              tintColor={
                activeItem === "newAgent" ? palette.centerButtonActiveInk : palette.foreground
              }
              type="monochrome"
              weight="semibold"
            />
          </Pressable>

          {/* Right half: Chat */}
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <NavTabButton
              icon="text.bubble"
              label="Chat"
              active={activeItem === "chat"}
              palette={palette}
              onPress={handlePressChat}
              onLongPress={() => openPeek("chat")}
            />
          </View>
        </GlassSurface>
      </View>
    </>
  );
}
