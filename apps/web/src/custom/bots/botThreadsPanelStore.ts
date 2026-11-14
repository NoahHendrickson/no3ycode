/**
 * Whether a bot's Threads panel is open: one state per bot, shared by its conversation and its
 * threads, remembered on this device — see `.fork/customizations.yaml#fork-bot-work-threads`.
 * Where the panel and the right panel cannot both fit, the one opened last wins, the other closes.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "~/lib/storage";
import { RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY } from "~/rightPanelLayout";
import { useRightPanelStore } from "~/rightPanelStore";

import type { BotWorkFilter, BotWorkGroupKey, BotWorkSort } from "./botWork";
import { stageFitsBothPanels, stageRowOf } from "./stagePanels";

interface BotThreadsPanelState {
  /** By the bot's scoped thread key. */
  readonly openByBotKey: Readonly<Record<string, true>>;
  /** One order for every bot's panel, as the sidebar keeps one. */
  readonly sort: BotWorkSort;
}

export const useBotThreadsPanelStore = create<BotThreadsPanelState>()(
  persist((): BotThreadsPanelState => ({ openByBotKey: {}, sort: "activity" }), {
    name: "t3code:fork:bot-threads-panel:v2",
    version: 1,
    storage: createJSONStorage(() =>
      resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
    ),
  }),
);

/** On the panel's header: whose panel it is and which thread shows it, so the right panel's
    store can find the panel it displaces. */
const BOT_THREADS_PANEL_BOT_ATTRIBUTE = "data-fork-bot-threads-bot";
const BOT_THREADS_PANEL_THREAD_ATTRIBUTE = "data-fork-bot-threads-thread";

/** Whether the two panels share the stage beside `element`: no sheet layout, and room for both. */
function stageHoldsBothPanels(element: Element | null): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia(RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY).matches) return false;
  const row = stageRowOf(element);
  return row === null || stageFitsBothPanels(row.clientWidth);
}

function setOpen(botKey: string, open: boolean): void {
  useBotThreadsPanelStore.setState((state) => {
    if ((state.openByBotKey[botKey] === true) === open) return state;
    const { [botKey]: _closed, ...rest } = state.openByBotKey;
    return { openByBotKey: open ? { ...rest, [botKey]: true } : rest };
  });
}

export function closeBotThreadsPanel(botRef: ScopedThreadRef): void {
  setOpen(scopedThreadKey(botRef), false);
}

/** Opening it on `threadRef`'s stage closes that thread's right panel where both do not fit. */
export function toggleBotThreadsPanel(input: {
  readonly botRef: ScopedThreadRef;
  readonly threadRef: ScopedThreadRef;
  readonly trigger: Element | null;
}): void {
  const botKey = scopedThreadKey(input.botRef);
  const fitsBoth = stageHoldsBothPanels(input.trigger);
  const rightPanel = useRightPanelStore.getState();
  const rightPanelOpen = rightPanel.byThreadKey[scopedThreadKey(input.threadRef)]?.isOpen === true;
  // Set open but displaced by the right panel (the window narrowed with both open): show it.
  if (useBotThreadsPanelStore.getState().openByBotKey[botKey] === true) {
    if (!fitsBoth && rightPanelOpen) rightPanel.close(input.threadRef);
    else setOpen(botKey, false);
    return;
  }
  setOpen(botKey, true);
  if (!fitsBoth) rightPanel.close(input.threadRef);
}

/** Opened from the bot's sidebar card, before its conversation is on the stage: the stage on
    screen stands in for its width, and where both do not fit the bot's right panel closes. */
export function openBotThreadsPanel(botRef: ScopedThreadRef): void {
  setOpen(scopedThreadKey(botRef), true);
  if (typeof document === "undefined") return;
  if (!stageHoldsBothPanels(document.querySelector("[data-fork-workspace-root]"))) {
    useRightPanelStore.getState().close(botRef);
  }
}

// The right panel opening where both do not fit closes the Threads panel beside it, wherever it
// was opened from (its toggle, a keybinding, a link that opens a surface).
useRightPanelStore.subscribe((next, previous) => {
  if (next.byThreadKey === previous.byThreadKey || typeof document === "undefined") return;
  let opened = false;
  for (const threadKey in next.byThreadKey) {
    if (
      next.byThreadKey[threadKey]?.isOpen === true &&
      previous.byThreadKey[threadKey]?.isOpen !== true
    ) {
      opened = true;
      break;
    }
  }
  if (!opened) return;
  for (const header of document.querySelectorAll(`[${BOT_THREADS_PANEL_THREAD_ATTRIBUTE}]`)) {
    const threadKey = header.getAttribute(BOT_THREADS_PANEL_THREAD_ATTRIBUTE) ?? "";
    const botKey = header.getAttribute(BOT_THREADS_PANEL_BOT_ATTRIBUTE) ?? "";
    if (
      next.byThreadKey[threadKey]?.isOpen === true &&
      previous.byThreadKey[threadKey]?.isOpen !== true &&
      !stageHoldsBothPanels(header)
    ) {
      setOpen(botKey, false);
    }
  }
});

export function setBotThreadsSort(sort: BotWorkSort): void {
  useBotThreadsPanelStore.setState({ sort });
}

/** What a bot's panel is searched and narrowed to. `query` is null while the search field is
    closed. Held for the session only, so a filter never hides threads after a restart. */
export interface BotThreadsView extends Omit<BotWorkFilter, "query"> {
  readonly query: string | null;
}

const NO_GROUPS: ReadonlySet<BotWorkGroupKey> = new Set();
const NO_PROJECTS: ReadonlySet<string> = new Set();
export const EMPTY_BOT_THREADS_VIEW: BotThreadsView = {
  query: null,
  groups: NO_GROUPS,
  projectIds: NO_PROJECTS,
};

/** By the bot's scoped thread key; outside the panel, which remounts as its bot's threads open. */
export const useBotThreadsViewStore = create<{
  readonly byBotKey: Readonly<Record<string, BotThreadsView>>;
}>()(() => ({ byBotKey: {} }));

export function updateBotThreadsView(botKey: string, patch: Partial<BotThreadsView>): void {
  useBotThreadsViewStore.setState((state) => ({
    byBotKey: {
      ...state.byBotKey,
      [botKey]: { ...(state.byBotKey[botKey] ?? EMPTY_BOT_THREADS_VIEW), ...patch },
    },
  }));
}

/** Set by the search button, read once by the field: a panel that remounts with search open
    must not take focus from the composer. */
let searchFocusRequested = false;

export function openBotThreadsSearch(botKey: string): void {
  searchFocusRequested = true;
  updateBotThreadsView(botKey, { query: "" });
}

export function takeBotThreadsSearchFocus(): boolean {
  const requested = searchFocusRequested;
  searchFocusRequested = false;
  return requested;
}

export function clearBotThreadsFilters(botKey: string): void {
  updateBotThreadsView(botKey, { groups: NO_GROUPS, projectIds: NO_PROJECTS });
}
