/**
 * The no3y iPhone dock's destinations as tabs of Home: which one shows, and the drafts New agent
 * and Chat keep while you are elsewhere — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * A dock switch only changes this state, so nothing is pushed or popped and nothing slides.
 * Kept free of heavy imports: the root layout and the new-task flow store read it.
 */
import { Atom } from "effect/reactivity";

import {
  draftRouteIdentity,
  isDraftThreadRoute,
  type NewTaskDraftRouteParams,
} from "../src/features/threads/thread-route-state";
import {
  resetRootStack,
  rootStackState,
  type RootStackNavigation,
} from "../src/lib/root-stack-reset";
import { appAtomRegistry } from "../src/state/atom-registry";

export type No3yHomeTab = "threads" | "newAgent" | "chat" | "automations";
export type No3yHomeDraftTab = "newAgent" | "chat";

export const NO3Y_HOME_TABS: ReadonlyArray<No3yHomeTab> = [
  "threads",
  "newAgent",
  "chat",
  "automations",
];

export interface No3yHomeTabsState {
  /** The no3y iPhone layout is on; elsewhere Home keeps upstream's tabs and nothing is served. */
  readonly enabled: boolean;
  readonly tab: No3yHomeTab;
  readonly newAgentDraft: NewTaskDraftRouteParams;
  /** Set once the No-project workspace a chat starts in is listed. */
  readonly chatDraft: NewTaskDraftRouteParams | null;
}

export const INITIAL_NO3Y_HOME_TABS: No3yHomeTabsState = {
  enabled: false,
  tab: "threads",
  newAgentDraft: { requestId: "no3y-new-agent" },
  chatDraft: null,
};

export function no3yHomeDraft(
  state: No3yHomeTabsState,
  tab: No3yHomeDraftTab,
): NewTaskDraftRouteParams | null {
  return tab === "newAgent" ? state.newAgentDraft : state.chatDraft;
}

/** A Home draft's flow key; a new draft (after each send) is a fresh flow. */
export function no3yHomeDraftFlowKey(tab: No3yHomeDraftTab, draft: NewTaskDraftRouteParams) {
  return `no3y-home:${tab}:${draftRouteIdentity(draft)}`;
}

interface RouteLike {
  readonly name: string;
  readonly params?: object | undefined;
}

/**
 * The Home draft the root new-task flow serves: the selected tab's, unless a draft thread is on
 * the stack (it is above Home, so it is the one on screen). Active until a thread covers Home,
 * as a draft route is until a thread is pushed over it.
 */
export function resolveNo3yHomeDraftFlow(
  routes: ReadonlyArray<RouteLike>,
  state: No3yHomeTabsState,
): { readonly flowKey: string; readonly active: boolean } | null {
  if (!state.enabled || (state.tab !== "newAgent" && state.tab !== "chat")) return null;
  if (routes.some(isDraftThreadRoute)) return null;
  const draft = no3yHomeDraft(state, state.tab);
  if (draft === null) return null;
  return {
    flowKey: no3yHomeDraftFlowKey(state.tab, draft),
    active: !routes.some((route) => route.name === "Thread"),
  };
}

/** Both Home drafts' flows outlive a switch to another tab, so a return finds them as left. */
export function liveNo3yHomeDraftFlowKeys(state: No3yHomeTabsState): ReadonlyArray<string> {
  if (!state.enabled) return [];
  const keys = [no3yHomeDraftFlowKey("newAgent", state.newAgentDraft)];
  if (state.chatDraft !== null) keys.push(no3yHomeDraftFlowKey("chat", state.chatDraft));
  return keys;
}

/**
 * Whether a dock tap must first bring Home back: something is pushed over it (a Settings page,
 * an automation's editor) or Home shows Pull requests. Over Home itself it only switches the tab.
 */
export function no3yDockSwitchNeedsHome(input: {
  readonly topRouteName: string | undefined;
  readonly homeShowsThreads: boolean;
}): boolean {
  return (
    (input.topRouteName !== undefined && input.topRouteName !== "Home") || !input.homeShowsThreads
  );
}

/** The project picker opened from New agent's tab sets that tab's project and closes. */
export function isNo3yHomeDraftPickerBase(
  below: RouteLike | undefined,
  state: No3yHomeTabsState,
): boolean {
  return below?.name === "Home" && state.enabled && state.tab === "newAgent";
}

export const no3yHomeTabsAtom = Atom.make<No3yHomeTabsState>(INITIAL_NO3Y_HOME_TABS).pipe(
  Atom.keepAlive,
  Atom.withLabel("mobile:no3y-home-tabs"),
);

export function readNo3yHomeTabs(): No3yHomeTabsState {
  return appAtomRegistry.get(no3yHomeTabsAtom);
}

function update(patch: Partial<No3yHomeTabsState>): void {
  const current = readNo3yHomeTabs();
  if (Object.entries(patch).every(([key, value]) => current[key as keyof typeof patch] === value))
    return;
  appAtomRegistry.set(no3yHomeTabsAtom, { ...current, ...patch });
}

export function setNo3yHomeTab(tab: No3yHomeTab): void {
  update({ tab });
}

export function setNo3yHomeTabsEnabled(enabled: boolean): void {
  update({ enabled });
}

export function setNo3yHomeDraft(
  tab: No3yHomeDraftTab,
  draft: NewTaskDraftRouteParams | null,
): void {
  if (tab === "newAgent") {
    if (draft !== null) update({ newAgentDraft: draft });
  } else {
    update({ chatDraft: draft });
  }
}

interface LentWorkspaceTabs {
  readonly select: (tab: "threads" | "pullRequests") => void;
  readonly isShown: (tab: "threads" | "pullRequests") => boolean;
}

// Home's workspace tab selector, lent by Home (the dock and Settings sit outside its context).
let lentWorkspaceTabs: LentWorkspaceTabs | null = null;

export function lendNo3yWorkspaceTabs(lent: LentWorkspaceTabs): void {
  lentWorkspaceTabs = lent;
}

/**
 * Shows a Home tab on the no3y iPhone layout: over Home only the tab changes; from a page pushed
 * over it (or Pull requests) Home comes back first. False elsewhere, where callers go on as before.
 */
export function showNo3yHomeTab(navigation: RootStackNavigation, tab: No3yHomeTab): boolean {
  if (!readNo3yHomeTabs().enabled) return false;
  setNo3yHomeTab(tab);
  const root = rootStackState(navigation);
  const needsHome = no3yDockSwitchNeedsHome({
    topRouteName: root?.routes[root.index]?.name,
    homeShowsThreads: lentWorkspaceTabs?.isShown("threads") ?? true,
  });
  if (!needsHome) return true;
  if (lentWorkspaceTabs) lentWorkspaceTabs.select("threads");
  else
    resetRootStack(navigation, (state) => ({
      ...state,
      index: 0,
      routes: [state.routes.find((route) => route.name === "Home") ?? { name: "Home" }],
    }));
  return true;
}
