/**
 * The dock: four filled icon items (Threads, New agent, Chat, Automations) with a soft pill behind
 * the selected one, and a long-press peek card anchored above Threads, Automations and Chat — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. Settings lives in the Threads header.
 */
import { useAtomValue } from "@effect/atom-react";
import MessageSquareTextIcon from "@hugeicons/core-free-icons/MessageSquareTextIcon";
import Navigation03Icon from "@hugeicons/core-free-icons/Navigation03Icon";
import PlusIcon from "@hugeicons/core-free-icons/PlusIcon";
import SourceCodeIcon from "@hugeicons/core-free-icons/SourceCodeIcon";
import ZapIcon from "@hugeicons/core-free-icons/ZapIcon";
import { CommonActions, useNavigation, type NavigationState } from "@react-navigation/native";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import * as Haptics from "expo-haptics";
import { useMemo, useState, type ReactNode } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../src/components/ui/AppText";
import { GlassSurface } from "../src/components/ui/GlassSurface";
import { OverlayPortal } from "../src/components/ui/OverlayPortal";
import { useAdaptiveWorkspaceLayout } from "../src/features/layout/adaptive-workspace-context";
import { isWorkspaceOverlayRoute } from "../src/features/layout/workspace-overlay-routes";
import { openSettings } from "../src/features/settings/settings-navigation";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { useThreadListNow } from "../src/features/threads/use-thread-list-now";
import { isDuoDevice } from "../src/lib/device-type";
import { useDeviceType } from "../src/native/native-layout-metrics";
import { useServerConfigs } from "../src/state/entities";
import { steadyNavigationThreadShellsAtom } from "../src/state/threads";
import {
  flatGlassPalette,
  NO3Y_DOCK_HEIGHT,
  no3yDockBottom,
  type FlatGlassPalette,
} from "./flatGlassTheme";
import { isNo3yChatThread } from "./no3yChatRule";
import { useNo3ySentChats } from "./no3yChatTagging";
import { filterForkRosterVisibleThreads } from "./forkRosterVisibility";
import { sidebarV2StatusBucketForKind } from "./forkStatusGrouping";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import {
  hasNo3yNavPeek,
  listNo3yAutomationRunThreads,
  resolveActiveNo3yNavItem,
  resolveNo3yThreadCardStatusKind,
  selectNo3yNavPeekItems,
  shouldShowNo3yBottomNav,
  type No3yNavItemId,
  type No3yNavPeekEntry,
} from "./mobileStatusGrouping";
import { No3yBottomFade } from "./No3yBottomFade";
import { No3yGlassLayer } from "./No3yGlass";
import { No3yProviderMark } from "./No3yProviderMark";
import { No3yStatusMark } from "./No3yStatusMark";

const DOCK_ITEM_WIDTH = 48;
const DOCK_ITEM_HEIGHT = 36;
const DOCK_GAP = 20;
const PEEK_CARD_MAX_WIDTH = 300;
const PEEK_EDGE = 12;

const DOCK_ITEMS: ReadonlyArray<{
  readonly id: No3yNavItemId;
  readonly label: string;
  readonly icon: HugeIconData;
}> = [
  { id: "threads", label: "Threads", icon: SourceCodeIcon },
  { id: "newAgent", label: "New agent", icon: Navigation03Icon },
  { id: "chat", label: "Chat", icon: MessageSquareTextIcon },
  { id: "automations", label: "Automations", icon: ZapIcon },
];

const PEEK_COPY: Partial<
  Record<No3yNavItemId, { readonly empty: string; readonly create: string }>
> = {
  threads: { empty: "No threads yet", create: "New thread" },
  automations: { empty: "No automation runs yet", create: "New automation" },
  chat: { empty: "No chats yet", create: "New chat" },
};

function DockItem(props: {
  readonly label: string;
  readonly icon: HugeIconData;
  readonly active: boolean;
  readonly peeking: boolean;
  readonly hasPeek: boolean;
  readonly badgeColor: string | null;
  readonly palette: FlatGlassPalette;
  readonly onPress: () => void;
  readonly onLongPress: () => void;
}) {
  const { palette } = props;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={props.label}
      accessibilityHint={props.hasPeek ? "Long-press to peek" : undefined}
      accessibilityState={{ selected: props.active }}
      delayLongPress={300}
      onPress={props.onPress}
      onLongPress={props.hasPeek ? props.onLongPress : undefined}
      style={({ pressed }) => ({
        width: DOCK_ITEM_WIDTH,
        height: DOCK_ITEM_HEIGHT,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: props.peeking ? palette.peekRing : "transparent",
        backgroundColor: pressed && !props.active ? palette.rowPressed : "transparent",
      })}
    >
      {props.active || props.peeking ? <No3yGlassLayer radius={12} /> : null}
      <View>
        <HugeIcon icon={props.icon} size={24} color={palette.foreground} filled />
        {props.badgeColor ? (
          <View
            style={{
              position: "absolute",
              top: -1,
              right: -3,
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: props.badgeColor,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function PeekRow(props: {
  readonly palette: FlatGlassPalette;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly leading: ReactNode;
  readonly title: string;
  readonly muted?: boolean;
  readonly trailing?: ReactNode;
}) {
  const { palette } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        height: 46,
        backgroundColor: pressed ? palette.rowPressed : "transparent",
      })}
    >
      <View style={{ width: 20, alignItems: "center" }}>{props.leading}</View>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          flex: 1,
          fontSize: 15,
          lineHeight: 20,
          color: props.muted ? palette.quietInk : palette.titleInk,
        }}
      >
        {props.title}
      </Text>
      {props.trailing}
    </Pressable>
  );
}

function No3yPeekCard(props: {
  readonly item: No3yNavItemId;
  readonly icon: HugeIconData;
  readonly entries: ReadonlyArray<No3yNavPeekEntry>;
  readonly anchorX: number;
  readonly bottom: number;
  readonly palette: FlatGlassPalette;
  readonly onClose: () => void;
  readonly onOpenThread: (thread: EnvironmentThreadShell) => void;
  readonly onCreate: () => void;
  readonly providerDriverOf: (thread: EnvironmentThreadShell) => string | undefined;
}) {
  const { palette } = props;
  const window = useWindowDimensions();
  const copy = PEEK_COPY[props.item];
  const width = Math.min(PEEK_CARD_MAX_WIDTH, window.width - PEEK_EDGE * 2);
  const left = Math.min(
    Math.max(props.anchorX - width / 2, PEEK_EDGE),
    window.width - PEEK_EDGE - width,
  );
  return (
    <OverlayPortal>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close peek"
          onPress={props.onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.peekBackdrop }]}
        />
        <Animated.View
          entering={FadeIn.duration(140)}
          style={{
            position: "absolute",
            left,
            width,
            bottom: props.bottom,
            borderRadius: 22,
            shadowColor: "#000000",
            shadowOpacity: 0.35,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
          }}
        >
          <GlassSurface
            glassEffectStyle="regular"
            tintColor={palette.panelTint}
            fallbackColor={palette.panelFallback}
            style={{
              borderRadius: 22,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: palette.panelBorder,
              overflow: "hidden",
              paddingVertical: 6,
            }}
          >
            {props.entries.length === 0 && copy ? (
              <PeekRow
                palette={palette}
                accessibilityLabel={copy.empty}
                onPress={props.onClose}
                leading={<HugeIcon icon={props.icon} size={18} color={palette.faintInk} />}
                title={copy.empty}
                muted
              />
            ) : (
              props.entries.map((entry) => (
                <PeekRow
                  key={entry.key}
                  palette={palette}
                  accessibilityLabel={entry.thread.title}
                  onPress={() => {
                    props.onClose();
                    props.onOpenThread(entry.thread);
                  }}
                  leading={
                    <No3yProviderMark provider={props.providerDriverOf(entry.thread)} size={18} />
                  }
                  title={entry.thread.title}
                  trailing={<No3yStatusMark kind={entry.statusKind} palette={palette} />}
                />
              ))
            )}
            {copy ? (
              <PeekRow
                palette={palette}
                accessibilityLabel={copy.create}
                onPress={() => {
                  props.onClose();
                  props.onCreate();
                }}
                leading={
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: palette.foreground,
                    }}
                  >
                    <HugeIcon
                      icon={PlusIcon}
                      size={14}
                      color={palette.stageBackground}
                      strokeWidth={2.2}
                    />
                  </View>
                }
                title={copy.create}
              />
            ) : null}
          </GlassSurface>
        </Animated.View>
      </View>
    </OverlayPortal>
  );
}

/** Whether the compact iPhone Flat Glass dock is active for this device/layout. */
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
  const window = useWindowDimensions();
  const keyboardHeight = useKeyboardState((keyboard) => keyboard.height);
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const { openWorkspaceTab, selectDetail, startNewTask } = useAdaptiveWorkspaceLayout();
  const threads = useAtomValue(steadyNavigationThreadShellsAtom);
  const serverConfigs = useServerConfigs();
  const [peekItem, setPeekItem] = useState<No3yNavItemId | null>(null);

  const visibleRoutes = props.state.routes.slice(0, props.state.index + 1);
  const topRoute = visibleRoutes.at(-1);
  const isOverlay = topRoute !== undefined && isWorkspaceOverlayRoute(topRoute.name);
  const visible =
    enabled &&
    keyboardHeight <= 0 &&
    shouldShowNo3yBottomNav({ topRoute, isOverlayRoute: isOverlay });

  const activeItem = resolveActiveNo3yNavItem(visibleRoutes);

  const sentChatKeys = useNo3ySentChats();

  const nowIso = useThreadListNow(threads);
  const threadsBadgeColor = useMemo(() => {
    let hasWorking = false;
    for (const thread of filterForkRosterVisibleThreads(threads)) {
      if (thread.settledOverride === "settled") continue;
      if (isNo3yChatThread(thread, sentChatKeys)) continue;
      const kind = resolveNo3yThreadCardStatusKind(thread, { now: nowIso });
      const bucket = sidebarV2StatusBucketForKind(kind);
      if (bucket === "input") return palette.statusAttention;
      if (bucket === "working") hasWorking = true;
    }
    return hasWorking ? palette.statusWorking : null;
  }, [threads, sentChatKeys, nowIso, palette.statusAttention, palette.statusWorking]);

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

  const peekEntries = useMemo(
    () =>
      peekItem === null
        ? []
        : selectNo3yNavPeekItems({ item: peekItem, threads, sentChatKeys, now: nowIso }),
    [peekItem, threads, sentChatKeys, nowIso],
  );

  if (!visible) return null;

  const dockBottom = no3yDockBottom(insets.bottom);
  const dockRowWidth = DOCK_ITEMS.length * DOCK_ITEM_WIDTH + (DOCK_ITEMS.length - 1) * DOCK_GAP;
  const dockRowStart = (window.width - dockRowWidth) / 2;

  const openPeek = (item: No3yNavItemId) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPeekItem(item);
  };

  const openChat = () => {
    navigation.dispatch((state) => {
      const home = state.routes.find((route) => route.name === "Home") ?? { name: "Home" };
      const existingChat = state.routes.find((route) => route.name === "No3yChat");
      const routes = [home, existingChat ?? { name: "No3yChat" }];
      return CommonActions.reset({ ...state, index: routes.length - 1, routes });
    });
  };

  const press: Record<No3yNavItemId, () => void> = {
    threads: () => openWorkspaceTab("threads"),
    automations: () => openSettings(navigation, "SettingsScheduledTasks"),
    newAgent: startNewTask,
    chat: openChat,
    settings: () => openWorkspaceTab("settings"),
  };

  const create: Partial<Record<No3yNavItemId, () => void>> = {
    threads: startNewTask,
    automations: () => openSettings(navigation, "SettingsScheduledTaskNew"),
    chat: openChat,
  };

  const handleOpenThread = (thread: EnvironmentThreadShell) => {
    selectDetail?.({
      name: "Thread",
      params: { environmentId: String(thread.environmentId), threadId: String(thread.id) },
    });
  };

  const peekIndex = DOCK_ITEMS.findIndex((item) => item.id === peekItem);
  const peekDockItem = DOCK_ITEMS[peekIndex];

  return (
    <>
      {peekItem !== null && peekDockItem ? (
        <No3yPeekCard
          item={peekItem}
          icon={peekDockItem.icon}
          entries={peekEntries}
          anchorX={dockRowStart + peekIndex * (DOCK_ITEM_WIDTH + DOCK_GAP) + DOCK_ITEM_WIDTH / 2}
          bottom={dockBottom + (NO3Y_DOCK_HEIGHT + DOCK_ITEM_HEIGHT) / 2 + 8}
          palette={palette}
          onClose={() => setPeekItem(null)}
          onOpenThread={handleOpenThread}
          onCreate={create[peekItem] ?? (() => {})}
          providerDriverOf={(thread) =>
            serverConfigs
              .get(thread.environmentId)
              ?.providers.find(
                (provider) => provider.instanceId === thread.modelSelection.instanceId,
              )?.driver
          }
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 60 }}
      >
        {/* The fade stays inside the dock so it never dims the bars that sit 8pt above it. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <No3yBottomFade color={palette.stageBackground} />
          <View style={{ flex: 1, backgroundColor: palette.stageBackground }} />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: DOCK_GAP,
            height: NO3Y_DOCK_HEIGHT + dockBottom,
            paddingBottom: dockBottom,
          }}
        >
          {DOCK_ITEMS.map((item) => (
            <DockItem
              key={item.id}
              label={item.label}
              icon={item.icon}
              active={activeItem === item.id}
              peeking={peekItem === item.id}
              hasPeek={hasNo3yNavPeek(item.id)}
              badgeColor={
                item.id === "threads"
                  ? threadsBadgeColor
                  : item.id === "automations"
                    ? automationsBadgeColor
                    : null
              }
              palette={palette}
              onPress={() => {
                Keyboard.dismiss();
                setPeekItem(null);
                press[item.id]();
              }}
              onLongPress={() => openPeek(item.id)}
            />
          ))}
        </View>
      </View>
    </>
  );
}
