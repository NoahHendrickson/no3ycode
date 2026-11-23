/**
 * Chat: Threads-style header, recent chats as thread cards, and New agent's own draft composer for
 * a No-project chat, carried on this route and served by the new-task flow. A sent chat is pushed
 * over Chat and the route takes a fresh draft — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import { useAtomValue } from "@effect/atom-react";
import MessageSquareTextIcon from "@hugeicons/core-free-icons/MessageSquareTextIcon";
import { LegendList } from "@legendapp/list/react-native";
import { HeaderHeightContext } from "@react-navigation/elements";
import {
  CommonActions,
  StackActions,
  useNavigation,
  type StaticScreenProps,
} from "@react-navigation/native";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { createContext, use, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import { AppText as Text } from "../src/components/ui/AppText";
import { useThreadListActions } from "../src/features/home/useThreadListActions";
import { startOpeningDetail } from "../src/features/layout/workspace/useSelectWorkspaceDetail";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { NewTaskDraftRouteScreen } from "../src/features/threads/NewTaskDraftRouteScreen";
import { resolveNewTaskScratchOption } from "../src/features/threads/new-task-project-selection";
import { ThreadScreenFallback, ThreadScreenHost } from "../src/features/threads/ThreadScreenHost";
import {
  draftRouteIdentity,
  type NewTaskDraftRouteParams,
} from "../src/features/threads/thread-route-state";
import { useThreadRowProviderInstanceResolver } from "../src/features/threads/thread-provider-instance";
import { useOpenThreadPullRequests } from "../src/features/threads/use-open-thread-pull-requests";
import { useThreadListNow } from "../src/features/threads/use-thread-list-now";
import { uuidv4 } from "../src/lib/uuid";
import { useProjects, useServerConfigs } from "../src/state/entities";
import { threadListEnvironmentsAtom } from "../src/state/presentation";
import { projectEnvironment } from "../src/state/projects";
import { steadyNavigationThreadShellsAtom } from "../src/state/threads";
import { useAtomCommand } from "../src/state/use-atom-command";
import { useWorkspaceState } from "../src/state/workspace";
import { tagNo3yChat, useNo3ySentChats } from "./no3yChatTagging";
import { flatGlassPalette, NO3Y_FONT } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { listNo3yChatThreads, resolveNo3yThreadCardStatusKind } from "./mobileStatusGrouping";
import { findNo3yChatProject, resolveNo3yChatDraftParams } from "./no3yChat";
import { No3yBottomTray, useNo3yTrayContentInset } from "./No3yBottomTray";
import { No3yChatDraftContext, type No3yDraftSurface } from "./No3yDraftSurface";
import { No3yChatHeader } from "./No3yScreenHeader";
import { No3yThreadRow } from "./No3yThreadRow";

type No3yChatRouteParams = { readonly draft?: NewTaskDraftRouteParams } | undefined;

interface ChatSearch {
  readonly searching: boolean;
  readonly searchQuery: string;
  readonly setSearching: (searching: boolean) => void;
  readonly setSearchQuery: (query: string) => void;
}

// The header and list read the search here, so typing never re-renders the draft screen.
const ChatSearchContext = createContext<ChatSearch | null>(null);

function ChatHeader() {
  const search = use(ChatSearchContext)!;
  return (
    <No3yChatHeader
      searching={search.searching}
      searchQuery={search.searchQuery}
      onSearchingChange={search.setSearching}
      onSearchQueryChange={search.setSearchQuery}
    />
  );
}

const noop = () => {};

function ChatList(props: { readonly topInset: number; readonly bottomInset: number }) {
  const { searchQuery } = use(ChatSearchContext)!;
  const navigation = useNavigation();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const threads = useAtomValue(steadyNavigationThreadShellsAtom);
  const { providersByEnvironmentId, pinningEnvironmentIds, titleRegenerationEnvironmentIds } =
    useAtomValue(threadListEnvironmentsAtom);
  const resolveProviderInstance = useThreadRowProviderInstanceResolver(providersByEnvironmentId);
  const openThreadPullRequests = useOpenThreadPullRequests();
  const actions = useThreadListActions();
  const openSwipeableRef = useRef<SwipeableMethods | null>(null);

  const sentChatKeys = useNo3ySentChats();
  const nowIso = useThreadListNow(threads);
  const chats = useMemo(
    () => listNo3yChatThreads({ threads, sentChatKeys, searchQuery }),
    [threads, sentChatKeys, searchQuery],
  );

  // Pushed over Chat, as Automations pushes its runs, so back returns here.
  const openChat = (thread: EnvironmentThreadShell) => {
    const detail = {
      name: "Thread",
      params: { environmentId: String(thread.environmentId), threadId: String(thread.id) },
    } as const;
    startOpeningDetail(detail);
    navigation.dispatch(StackActions.push("Thread", detail.params));
  };
  const searchingFor = searchQuery.trim();

  return (
    <LegendList
      data={chats}
      estimatedItemSize={64}
      keyExtractor={(thread) => `${thread.environmentId}:${thread.id}`}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      onScrollBeginDrag={() => openSwipeableRef.current?.close()}
      style={{
        position: "absolute",
        top: props.topInset,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: palette.stageBackground,
      }}
      contentContainerStyle={{ paddingTop: 4, paddingBottom: props.bottomInset, flexGrow: 1 }}
      extraData={themeAppearance}
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
              ...NO3Y_FONT.medium,
              fontSize: 15,
              color: palette.foreground,
              textAlign: "center",
            }}
          >
            {searchingFor.length > 0 ? "No matching chats" : "Quick chats"}
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
            {searchingFor.length > 0
              ? `No chats matching "${searchingFor}".`
              : "Ask a quick question below without picking a project."}
          </Text>
        </View>
      }
      // Chats are one flat list, so a card swipes to archive rather than settle or snooze.
      renderItem={({ item: thread }) => (
        <No3yThreadRow
          thread={thread}
          variant="card"
          statusKind={resolveNo3yThreadCardStatusKind(thread, { now: nowIso })}
          statusSection={undefined}
          selected={false}
          snoozed={false}
          pinned={thread.pinnedAt != null}
          wokeAt={null}
          hasQueuedMessages={false}
          snoozePresetMinute=""
          timeLabel=""
          project={null}
          providerInstance={resolveProviderInstance(thread)}
          providers={providersByEnvironmentId.get(thread.environmentId)}
          environmentLabel={null}
          settlementSupported={false}
          snoozeSupported={false}
          snoozePresets={undefined}
          pinningSupported={pinningEnvironmentIds.has(thread.environmentId)}
          autoSettleOptOutSupported={false}
          titleRegenerationSupported={titleRegenerationEnvironmentIds.has(thread.environmentId)}
          onSelectThread={openChat}
          onOpenThreadPullRequests={openThreadPullRequests}
          onDeleteThread={actions.confirmDeleteThread}
          onArchiveThread={actions.archiveThread}
          onRenameThread={actions.renameThread}
          onRegenerateThreadTitle={actions.regenerateThreadTitle}
          onNewThreadOnBranch={noop}
          onSettleThread={actions.settleThread}
          onSnoozeThread={actions.snoozeThread}
          onUnsnoozeThread={actions.unsnoozeThread}
          onUnsettleThread={actions.unsettleThread}
          onPinThread={actions.pinThread}
          onUnpinThread={actions.unpinThread}
          onSetThreadAutoSettle={actions.setThreadAutoSettle}
          onSwipeableWillOpen={(methods) => {
            if (openSwipeableRef.current !== methods) openSwipeableRef.current?.close();
            openSwipeableRef.current = methods;
          }}
          onSwipeableClose={(methods) => {
            if (openSwipeableRef.current === methods) openSwipeableRef.current = null;
          }}
        />
      )}
    />
  );
}

/** Why no composer shows: no environment offers a No-project workspace, or opening it failed. */
function ChatUnavailableNotice(props: { readonly message: string }) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  return (
    <No3yBottomTray color={palette.stageBackground}>
      <Text
        style={{
          ...NO3Y_FONT.regular,
          fontSize: 14,
          lineHeight: 18,
          color: palette.quietInk,
          textAlign: "center",
          paddingVertical: 12,
        }}
      >
        {props.message}
      </Text>
    </No3yBottomTray>
  );
}

const renderChatList = (headerInset: number, bottomInset: number) => (
  <ChatList topInset={headerInset} bottomInset={bottomInset} />
);

export function No3yChatRouteScreen(props: StaticScreenProps<No3yChatRouteParams>) {
  const navigation = useNavigation();
  const trayContentInset = useNo3yTrayContentInset();
  const projects = useProjects();
  const serverConfigs = useServerConfigs();
  const { environments } = useWorkspaceState();
  const openScratch = useAtomCommand(projectEnvironment.openScratch, {
    label: "open no-project chat",
    reportFailure: false,
  });
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openFailure, setOpenFailure] = useState<string | null>(null);

  const scratchOption = resolveNewTaskScratchOption({
    environments: environments.map((env) => ({
      environmentId: env.environmentId,
      connectionState: env.connectionState,
    })),
    serverConfigs,
    selectedEnvironmentId: null,
  });
  const environmentId = scratchOption?.ready ? scratchOption.environmentId : null;
  const project = findNo3yChatProject({
    environmentId,
    projects,
    scratchWorkspaceRoot:
      environmentId === null ? null : serverConfigs.get(environmentId)?.scratchWorkspaceRoot,
  });
  const routeDraft = props.route.params?.draft;
  const draft = resolveNo3yChatDraftParams(routeDraft, project, uuidv4);

  const openedEnvironmentRef = useRef<EnvironmentId | null>(null);
  useEffect(() => {
    if (environmentId === null || project !== null) return;
    if (openedEnvironmentRef.current === environmentId) return;
    openedEnvironmentRef.current = environmentId;
    void openScratch({ environmentId, input: {} }).then((result) => {
      if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
        const error = squashAtomCommandFailure(result);
        setOpenFailure(
          error instanceof Error ? error.message : "Could not open the No-project workspace.",
        );
      }
    });
  }, [environmentId, project, openScratch]);

  useEffect(() => {
    if (draft !== null && draft !== routeDraft) {
      navigation.dispatch(CommonActions.setParams({ draft }));
    }
  }, [draft, routeDraft, navigation]);

  const surface: No3yDraftSurface = {
    header: <ChatHeader />,
    content: renderChatList,
    controls: null,
    onSubmitted: (submittedEnvironmentId, threadId) => {
      const detail = {
        name: "Thread",
        params: { environmentId: submittedEnvironmentId, threadId },
      } as const;
      tagNo3yChat(EnvironmentId.make(submittedEnvironmentId), ThreadId.make(threadId));
      startOpeningDetail(detail);
      navigation.dispatch(StackActions.push("Thread", detail.params));
      navigation.dispatch(
        CommonActions.setParams({ draft: resolveNo3yChatDraftParams(undefined, project, uuidv4) }),
      );
    },
  };
  const unavailable =
    openFailure ??
    (scratchOption === null
      ? "Connect an environment with a No-project workspace to start a chat."
      : scratchOption.ready
        ? null
        : "Connect an environment to start a chat.");

  return (
    <ChatSearchContext value={{ searching, searchQuery, setSearching, setSearchQuery }}>
      <No3yChatDraftContext value={surface}>
        {/* The header lays out above the draft body, which starts at its top. */}
        <HeaderHeightContext value={0}>
          <ThreadScreenHost>
            {draft !== null && draft === routeDraft ? (
              <NewTaskDraftRouteScreen
                key={draftRouteIdentity(draft)}
                route={{ ...props.route, params: draft }}
              />
            ) : (
              <ThreadScreenFallback header={<ChatHeader />}>
                <View style={{ flex: 1 }}>
                  <ChatList topInset={0} bottomInset={trayContentInset} />
                  {unavailable === null ? null : <ChatUnavailableNotice message={unavailable} />}
                </View>
              </ThreadScreenFallback>
            )}
          </ThreadScreenHost>
        </HeaderHeightContext>
      </No3yChatDraftContext>
    </ChatSearchContext>
  );
}
