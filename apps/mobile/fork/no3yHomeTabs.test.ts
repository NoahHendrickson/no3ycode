import { describe, expect, it } from "vite-plus/test";

import {
  newTaskFlowKey,
  pruneNewTaskFlowStates,
  readNewTaskFlowState,
  updateNewTaskFlowState,
} from "../src/features/threads/new-task-flow-state";
import {
  INITIAL_NO3Y_HOME_TABS,
  isNo3yHomeDraftPickerBase,
  no3yDockSwitchNeedsHome,
  no3yHomeDraftFlowKey,
  readNo3yHomeTabs,
  resolveNo3yHomeDraftFlow,
  setNo3yHomeDraft,
  setNo3yHomeTab,
  setNo3yHomeTabsEnabled,
  type No3yHomeTabsState,
} from "./no3yHomeTabs";

const CHAT_DRAFT = { requestId: "c1", environmentId: "env-1", projectId: "scratch" };
const ON: No3yHomeTabsState = { ...INITIAL_NO3Y_HOME_TABS, enabled: true, chatDraft: CHAT_DRAFT };
const HOME = { key: "home", name: "Home" };

describe("no3y Home tabs", () => {
  it("serves the shown draft tab's flow, and holds it inactive under a pushed thread", () => {
    const newAgent = { ...ON, tab: "newAgent" as const };
    expect(resolveNo3yHomeDraftFlow([HOME], newAgent)).toEqual({
      flowKey: no3yHomeDraftFlowKey("newAgent", ON.newAgentDraft),
      active: true,
    });
    expect(resolveNo3yHomeDraftFlow([HOME, { name: "NewTaskThreadSettings" }], newAgent)).toEqual(
      expect.objectContaining({ active: true }),
    );
    // A sent chat is pushed over Home; its tab's flow stays the one served, not active.
    expect(
      resolveNo3yHomeDraftFlow([HOME, { name: "Thread", params: { threadId: "t1" } }], {
        ...ON,
        tab: "chat",
      }),
    ).toEqual({ flowKey: no3yHomeDraftFlowKey("chat", CHAT_DRAFT), active: false });
  });

  it("serves no Home draft on Threads or Automations, off the layout, or under a draft thread", () => {
    expect(resolveNo3yHomeDraftFlow([HOME], ON)).toBeNull();
    expect(resolveNo3yHomeDraftFlow([HOME], { ...ON, tab: "automations" })).toBeNull();
    expect(resolveNo3yHomeDraftFlow([HOME], { ...ON, enabled: false, tab: "newAgent" })).toBeNull();
    // Chat has no draft until its No-project workspace is listed.
    expect(resolveNo3yHomeDraftFlow([HOME], { ...ON, tab: "chat", chatDraft: null })).toBeNull();
    // A draft thread (New thread on a branch, a draft row) is above Home, so it is the one shown.
    expect(
      resolveNo3yHomeDraftFlow([HOME, { name: "Thread", params: { draft: { requestId: "r" } } }], {
        ...ON,
        tab: "newAgent",
      }),
    ).toBeNull();
  });

  it("keeps both Home drafts' flows across tab switches, and drops one once it is sent", () => {
    setNo3yHomeTabsEnabled(true);
    setNo3yHomeDraft("chat", CHAT_DRAFT);
    setNo3yHomeTab("chat");
    const newAgentKey = no3yHomeDraftFlowKey("newAgent", readNo3yHomeTabs().newAgentDraft);
    const chatKey = no3yHomeDraftFlowKey("chat", CHAT_DRAFT);
    updateNewTaskFlowState(newAgentKey, { draftKey: "new-task:agent" });
    updateNewTaskFlowState(chatKey, { draftKey: "new-task:chat" });

    setNo3yHomeTab("threads");
    pruneNewTaskFlowStates({ routes: [HOME] });
    expect(readNewTaskFlowState(newAgentKey).draftKey).toBe("new-task:agent");
    expect(readNewTaskFlowState(chatKey).draftKey).toBe("new-task:chat");

    // Sending gives the tab a fresh draft; the old flow goes once the stack changes.
    setNo3yHomeDraft("chat", { ...CHAT_DRAFT, requestId: "c2" });
    pruneNewTaskFlowStates({ routes: [HOME, { key: "thread", name: "Thread" }] });
    expect(readNewTaskFlowState(chatKey).draftKey).toBeNull();
    expect(readNewTaskFlowState(newAgentKey).draftKey).toBe("new-task:agent");

    // A draft route's flow still lives exactly as long as its route.
    const draftRoute = { key: "draft", name: "Thread", params: { draft: { requestId: "r" } } };
    const draftKey = newTaskFlowKey(draftRoute)!;
    updateNewTaskFlowState(draftKey, { draftKey: "new-task:route" });
    pruneNewTaskFlowStates({ routes: [HOME] });
    expect(readNewTaskFlowState(draftKey).draftKey).toBeNull();
  });

  it("switches in place over Home and brings Home back from a page pushed over it", () => {
    expect(no3yDockSwitchNeedsHome({ topRouteName: "Home", homeShowsThreads: true })).toBe(false);
    expect(no3yDockSwitchNeedsHome({ topRouteName: undefined, homeShowsThreads: true })).toBe(
      false,
    );
    expect(no3yDockSwitchNeedsHome({ topRouteName: "Home", homeShowsThreads: false })).toBe(true);
    expect(no3yDockSwitchNeedsHome({ topRouteName: "Settings", homeShowsThreads: true })).toBe(
      true,
    );
    expect(
      no3yDockSwitchNeedsHome({
        topRouteName: "SettingsScheduledTaskEdit",
        homeShowsThreads: true,
      }),
    ).toBe(true);
  });

  it("lets the project picker over New agent's tab set that tab's project", () => {
    const newAgent = { ...ON, tab: "newAgent" as const };
    expect(isNo3yHomeDraftPickerBase(HOME, newAgent)).toBe(true);
    expect(isNo3yHomeDraftPickerBase(HOME, { ...newAgent, tab: "threads" })).toBe(false);
    expect(isNo3yHomeDraftPickerBase(HOME, { ...newAgent, enabled: false })).toBe(false);
    expect(isNo3yHomeDraftPickerBase({ name: "Thread" }, newAgent)).toBe(false);
  });
});
