/**
 * Home on the no3y iPhone layout: Threads, New agent, Chat and Automations as tabs the dock
 * switches (fork/no3yHomeTabs.ts) — see `.fork/customizations.yaml#no3y-mobile-redesign`. A tab
 * mounts on its first visit and stays mounted while hidden, so switching back finds its scroll
 * position, search, filters and draft as they were, and nothing is pushed or popped.
 */
import { useAtomValue } from "@effect/atom-react";
import { HeaderHeightContext } from "@react-navigation/elements";
import { StackActions, useNavigation, useRoute } from "@react-navigation/native";
import type { ReactNode } from "react";
import { SafeAreaInsetsContext, type EdgeInsets } from "react-native-safe-area-context";

import { WorkspaceTabPanes } from "../src/features/layout/workspace/WorkspaceTabPanes";
import { startOpeningDetail } from "../src/features/layout/workspace/useSelectWorkspaceDetail";
import { SettingsScheduledTasksRouteScreen } from "../src/features/settings/SettingsScheduledTasksRouteScreen";
import { NewTaskDraftRouteScreen } from "../src/features/threads/NewTaskDraftRouteScreen";
import { ThreadScreenHost } from "../src/features/threads/ThreadScreenHost";
import { draftRouteIdentity } from "../src/features/threads/thread-route-state";
import { uuidv4 } from "../src/lib/uuid";
import { No3yChatTab } from "./No3yChatTab";
import { No3yDraftSurfaceContext, type No3yDraftSurface } from "./No3yDraftSurface";
import { No3yHomeDraftGate } from "./No3yHomeDraftGate";
import {
  NO3Y_HOME_TABS,
  no3yHomeDraftFlowKey,
  no3yHomeTabsAtom,
  setNo3yHomeDraft,
  type No3yHomeTab,
} from "./no3yHomeTabs";
import { NO3Y_NEW_AGENT_TAB_SURFACE } from "./No3yNewAgent";

function No3yNewAgentTab() {
  const navigation = useNavigation();
  const route = useRoute();
  const draft = useAtomValue(no3yHomeTabsAtom).newAgentDraft;
  const surface: No3yDraftSurface = {
    ...NO3Y_NEW_AGENT_TAB_SURFACE,
    // The sent thread is pushed over Home, so back returns here, to a fresh draft.
    onSubmitted: (environmentId, threadId) => {
      const detail = { name: "Thread", params: { environmentId, threadId } } as const;
      startOpeningDetail(detail);
      navigation.dispatch(StackActions.push("Thread", detail.params));
      setNo3yHomeDraft("newAgent", { requestId: uuidv4() });
    },
  };
  return (
    <No3yDraftSurfaceContext value={surface}>
      {/* The header lays out above the draft body, which starts at its top. */}
      <HeaderHeightContext value={0}>
        <ThreadScreenHost>
          <No3yHomeDraftGate flowKey={no3yHomeDraftFlowKey("newAgent", draft)}>
            <NewTaskDraftRouteScreen
              key={draftRouteIdentity(draft)}
              route={{ ...route, params: draft }}
            />
          </No3yHomeDraftGate>
        </ThreadScreenHost>
      </HeaderHeightContext>
    </No3yDraftSurfaceContext>
  );
}

export function No3yHomePanes(props: {
  readonly threads: ReactNode;
  /** The screen's own insets: Home zeroes the bottom one for upstream's tabs, which these lack. */
  readonly insets: EdgeInsets;
}) {
  const tab = useAtomValue(no3yHomeTabsAtom).tab;
  const renderTab = (pane: No3yHomeTab) =>
    pane === "threads" ? (
      props.threads
    ) : (
      <SafeAreaInsetsContext value={props.insets}>
        {pane === "newAgent" ? (
          <No3yNewAgentTab />
        ) : pane === "chat" ? (
          <No3yChatTab />
        ) : (
          <SettingsScheduledTasksRouteScreen />
        )}
      </SafeAreaInsetsContext>
    );
  return <WorkspaceTabPanes tabs={NO3Y_HOME_TABS} selected={tab} renderTab={renderTab} />;
}
