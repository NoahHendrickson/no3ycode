/**
 * Chat screen for no-project quick questions: the chat list under the header, and a bottom tray
 * whose prompt bar swaps to a chat search field — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import { useAtomValue } from "@effect/atom-react";
import ArrowUp02Icon from "@hugeicons/core-free-icons/ArrowUp02Icon";
import MessageSquareTextIcon from "@hugeicons/core-free-icons/MessageSquareTextIcon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import XIcon from "@hugeicons/core-free-icons/XIcon";
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

import { AppText as Text } from "../src/components/ui/AppText";
import * as Dialog from "../src/components/ui/Dialog";
import { GlassSurface } from "../src/components/ui/GlassSurface";
import { useBarInset } from "../src/components/ui/useBarInset";
import { useAdaptiveWorkspaceLayout } from "../src/features/layout/adaptive-workspace-context";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
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
import { flatGlassPalette } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import {
  buildScratchProjectKeySet,
  isNo3yChatThread,
  resolveNo3yThreadCardStatusKind,
} from "./mobileStatusGrouping";
import { No3yBottomTray, NO3Y_TRAY_BAR_HEIGHT, useNo3yTrayContentInset } from "./No3yBottomTray";
import { No3yStatusMark } from "./No3yStatusMark";

export function No3yChatRouteScreen() {
  const barInset = useBarInset();
  const trayContentInset = useNo3yTrayContentInset();
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

  const [searching, setSearching] = useState(false);
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
      <LegendList
        data={chatThreads}
        estimatedItemSize={48}
        keyExtractor={(thread) => `${thread.environmentId}:${thread.id}`}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingHorizontal: 8,
          paddingTop: barInset + 4,
          paddingBottom: trayContentInset,
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
            <HugeIcon icon={MessageSquareTextIcon} size={28} color={palette.faintInk} />
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
                <No3yStatusMark kind={statusKind} palette={palette} idleMode="dot" />
              </View>
            </Pressable>
          );
        }}
      />

      <No3yBottomTray color={palette.stageBackground}>
        <GlassSurface
          glassEffectStyle="regular"
          tintColor={palette.panelTint}
          fallbackColor={palette.panelFallback}
          style={{
            height: NO3Y_TRAY_BAR_HEIGHT,
            borderRadius: NO3Y_TRAY_BAR_HEIGHT / 2,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: palette.panelBorder,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 6,
            gap: 6,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={searching ? "Close chat search" : "Search chats"}
            hitSlop={6}
            onPress={() => {
              if (searching) setSearchQuery("");
              setSearching(!searching);
            }}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? palette.rowPressed : palette.controlSurface,
            })}
          >
            <HugeIcon icon={searching ? XIcon : Search01Icon} size={16} color={palette.quietInk} />
          </Pressable>
          {searching ? (
            <TextInput
              key="search"
              accessibilityLabel="Search chats"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search chats"
              placeholderTextColor={palette.faintInk}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={{ flex: 1, fontSize: 15, color: palette.foreground, paddingVertical: 0 }}
            />
          ) : (
            <>
              <TextInput
                key="prompt"
                accessibilityLabel="Quick question"
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
                style={{ flex: 1, fontSize: 15, color: palette.foreground, paddingVertical: 0 }}
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
                  <HugeIcon
                    icon={ArrowUp02Icon}
                    size={16}
                    strokeWidth={2}
                    color={scratchOption?.ready ? palette.centerButtonActiveInk : palette.faintInk}
                  />
                )}
              </Pressable>
            </>
          )}
        </GlassSurface>
      </No3yBottomTray>
    </View>
  );
}
