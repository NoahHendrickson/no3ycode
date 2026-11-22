/**
 * Dedicated Chat screen for no-project quick questions — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`.
 *
 * Layout: top search bar → Flat Glass list of no-project / chat-tagged threads →
 * quick-question prompt bar sitting directly above the always-visible nav bar.
 */
import { useAtomValue } from "@effect/atom-react";
import { useNavigation } from "@react-navigation/native";
import { filterForkRosterVisibleThreads } from "./forkRosterVisibility";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  getThreadSortTimestamp,
  resolveThreadActivityTimestamp,
} from "@t3tools/client-runtime/state/thread-sort";
import { LegendList } from "@legendapp/list/react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { KeyboardStickyView, useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SymbolView } from "../src/components/ui/AppSymbol";
import { AppText as Text } from "../src/components/ui/AppText";
import * as Dialog from "../src/components/ui/Dialog";
import { GlassSurface } from "../src/components/ui/GlassSurface";
import { Toolbar } from "../src/components/ui/Toolbar";
import { useAdaptiveWorkspaceLayout } from "../src/features/layout/adaptive-workspace-context";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { openSettings } from "../src/features/settings/settings-navigation";
import { resolveNewTaskScratchOption } from "../src/features/threads/new-task-project-selection";
import { useThreadListNow } from "../src/features/threads/use-thread-list-now";
import { relativeTime } from "../src/lib/time";
import { NativeStackScreenOptions } from "../src/native/StackHeader";
import { useProjects, useServerConfigs } from "../src/state/entities";
import { isNewTaskDraftKey } from "../src/state/new-task-draft-key";
import { projectEnvironment } from "../src/state/projects";
import { steadyNavigationThreadShellsAtom } from "../src/state/threads";
import { useAtomCommand } from "../src/state/use-atom-command";
import { createNewTaskDraft, setComposerDraftText } from "../src/state/use-composer-drafts";
import { useWorkspaceState } from "../src/state/workspace";
import { flatGlassPalette, NO3Y_BOTTOM_NAV_CLEARANCE } from "./flatGlassTheme";
import {
  buildScratchProjectKeySet,
  isNo3yChatThread,
  resolveNo3yThreadCardStatusKind,
} from "./mobileStatusGrouping";
import { No3yStatusMark } from "./No3yStatusMark";
import { useNo3yBottomNavEnabled } from "./No3yBottomNav";

export function No3yChatRouteScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardState((keyboard) => keyboard.height);
  const bottomNavEnabled = useNo3yBottomNavEnabled();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const { selectDetail } = useAdaptiveWorkspaceLayout();

  const threads = useAtomValue(steadyNavigationThreadShellsAtom);
  const projects = useProjects();
  const serverConfigs = useServerConfigs();
  const { environments } = useWorkspaceState();
  const openScratch = useAtomCommand(projectEnvironment.openScratch, {
    label: "open no-project chat",
    reportFailure: false,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [prompt, setPrompt] = useState("");
  const [starting, setStarting] = useState(false);

  const scratchProjectKeys = useMemo(() => {
    const roots = new Map(
      [...serverConfigs.entries()].map(
        ([envId, cfg]) => [envId, cfg.scratchWorkspaceRoot] as const,
      ),
    );
    return buildScratchProjectKeySet(projects, roots);
  }, [projects, serverConfigs]);

  const scratchOption = useMemo(
    () =>
      resolveNewTaskScratchOption({
        environments: environments.map((env) => ({
          environmentId: env.environmentId,
          connectionState: env.connectionState,
        })),
        serverConfigs,
        selectedEnvironmentId: null,
      }),
    [environments, serverConfigs],
  );

  const nowIso = useThreadListNow(threads);
  const chatThreads = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return filterForkRosterVisibleThreads(threads)
      .filter((thread) => {
        if (!isNo3yChatThread(thread, scratchProjectKeys)) return false;
        if (query.length > 0 && !thread.title.toLocaleLowerCase().includes(query)) return false;
        return true;
      })
      .sort(
        (left, right) =>
          getThreadSortTimestamp(right, "updated_at") - getThreadSortTimestamp(left, "updated_at"),
      );
  }, [threads, scratchProjectKeys, searchQuery]);

  const handleOpenThread = (thread: EnvironmentThreadShell) => {
    selectDetail?.({
      name: "Thread",
      params: { environmentId: String(thread.environmentId), threadId: String(thread.id) },
    });
  };

  const handleStartQuickChat = async () => {
    if (starting) return;
    if (!scratchOption || !scratchOption.ready) {
      Dialog.alert(
        "No-project workspace unavailable",
        "Connect an environment with a No-project workspace enabled to start a quick chat.",
      );
      return;
    }
    setStarting(true);
    const result = await openScratch({ environmentId: scratchOption.environmentId, input: {} });
    setStarting(false);
    if (result._tag === "Failure") {
      if (!isAtomCommandInterrupted(result)) {
        const error = squashAtomCommandFailure(result);
        Dialog.alert(
          "Could not start chat",
          error instanceof Error ? error.message : "Could not open the No-project workspace.",
        );
      }
      return;
    }
    const project = result.value;
    const trimmedPrompt = prompt.trim();
    const draftKey = createNewTaskDraft({
      environmentId: project.environmentId,
      projectId: project.id,
    });
    if (trimmedPrompt.length > 0) {
      setComposerDraftText(draftKey, trimmedPrompt);
      setPrompt("");
    }
    const draftId = isNewTaskDraftKey(draftKey) ? draftKey.slice("new-task:".length) : undefined;
    selectDetail?.({
      name: "Thread",
      params: {
        draft: {
          environmentId: String(project.environmentId),
          projectId: String(project.id),
          draftId,
        },
      },
    });
  };

  const restingBottomInset =
    Math.max(insets.bottom, 10) + (bottomNavEnabled ? NO3Y_BOTTOM_NAV_CLEARANCE : 10);

  return (
    <View style={{ flex: 1, backgroundColor: palette.stageBackground }}>
      <NativeStackScreenOptions
        options={{
          title: "Chat",
          headerShown: true,
          headerBackVisible: false,
          unstable_headerLeftItems: () => [],
        }}
      />
      <Toolbar placement="right">
        <Toolbar.Button
          accessibilityLabel="Settings"
          icon="gearshape"
          onPress={() => openSettings(navigation, "SettingsEnvironments")}
        />
      </Toolbar>

      {/* Top search bar */}
      <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            height: 38,
            borderRadius: 12,
            paddingHorizontal: 12,
            backgroundColor: palette.controlSurface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: palette.controlBorder,
          }}
        >
          <SymbolView
            name="magnifyingglass"
            size={14}
            tintColor={palette.faintInk}
            type="monochrome"
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search chats"
            placeholderTextColor={palette.faintInk}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={{
              flex: 1,
              fontSize: 14,
              color: palette.foreground,
              paddingVertical: 0,
            }}
          />
          {searchQuery.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear chat search"
              hitSlop={8}
              onPress={() => setSearchQuery("")}
            >
              <SymbolView
                name="xmark.circle.fill"
                size={15}
                tintColor={palette.faintInk}
                type="monochrome"
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Chat threads list */}
      <LegendList
        data={chatThreads}
        estimatedItemSize={48}
        keyExtractor={(thread) => `${thread.environmentId}:${thread.id}`}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 8,
          paddingTop: 4,
          paddingBottom: restingBottomInset + 72,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 32,
              paddingBottom: 48,
            }}
          >
            <SymbolView
              name="text.bubble"
              size={28}
              tintColor={palette.faintInk}
              type="monochrome"
            />
            <Text
              style={{
                marginTop: 10,
                fontSize: 15,
                fontWeight: "600",
                color: palette.foreground,
                textAlign: "center",
              }}
            >
              {searchQuery.trim().length > 0 ? "No matching chats" : "Quick chats"}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontSize: 13,
                lineHeight: 18,
                color: palette.quietInk,
                textAlign: "center",
              }}
            >
              {searchQuery.trim().length > 0
                ? `No chats matching "${searchQuery.trim()}".`
                : "Ask a quick question below without picking a project."}
            </Text>
          </View>
        }
        renderItem={({ item: thread }) => {
          const statusKind = resolveNo3yThreadCardStatusKind(thread, { now: nowIso });
          const seed = `${thread.environmentId}:${thread.id}`;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={thread.title}
              onPress={() => handleOpenThread(thread)}
              style={({ pressed }) => ({
                borderRadius: 16,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: pressed ? palette.rowPressed : "transparent",
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    lineHeight: 18,
                    fontWeight: "400",
                    color:
                      statusKind === "input" ||
                      statusKind === "approval" ||
                      statusKind === "done" ||
                      statusKind === "failed"
                        ? palette.foreground
                        : palette.quietInk,
                  }}
                >
                  {thread.title}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    lineHeight: 16,
                    fontVariant: ["tabular-nums"],
                    color: palette.faintInk,
                  }}
                >
                  {relativeTime(resolveThreadActivityTimestamp(thread) ?? thread.createdAt)}
                </Text>
                <No3yStatusMark kind={statusKind} seed={seed} palette={palette} idleMode="dot" />
              </View>
            </Pressable>
          );
        }}
      />

      {/* Quick-question prompt bar sitting directly above the bottom nav bar */}
      <KeyboardStickyView
        offset={{
          closed: 0,
          opened: Math.max(0, restingBottomInset - 8),
        }}
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: keyboardHeight > 0 ? 8 : restingBottomInset,
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
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: 14,
            paddingRight: 6,
            paddingVertical: 6,
            gap: 8,
          }}
        >
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder={
              scratchOption?.ready
                ? "Ask a quick question…"
                : "Connect an environment to start a chat"
            }
            placeholderTextColor={palette.faintInk}
            editable={!starting}
            returnKeyType="send"
            onSubmitEditing={() => void handleStartQuickChat()}
            style={{
              flex: 1,
              minHeight: 32,
              maxHeight: 96,
              fontSize: 14,
              lineHeight: 19,
              color: palette.foreground,
              paddingVertical: 4,
            }}
            multiline={false}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start quick chat"
            disabled={starting || !scratchOption?.ready}
            onPress={() => void handleStartQuickChat()}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: scratchOption?.ready
                ? palette.centerButtonActiveSurface
                : palette.controlSurface,
              opacity: pressed ? 0.75 : scratchOption?.ready ? 1 : 0.45,
            })}
          >
            {starting ? (
              <ActivityIndicator size="small" color={palette.centerButtonActiveInk} />
            ) : (
              <SymbolView
                name="arrow.up"
                size={15}
                tintColor={scratchOption?.ready ? palette.centerButtonActiveInk : palette.faintInk}
                type="monochrome"
                weight="semibold"
              />
            )}
          </Pressable>
        </GlassSurface>
      </KeyboardStickyView>
    </View>
  );
}
