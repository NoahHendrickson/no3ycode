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

import { stageFitsBothPanels, stageRowOf } from "./stagePanels";

interface BotThreadsPanelState {
  /** By the bot's scoped thread key. */
  readonly openByBotKey: Readonly<Record<string, true>>;
}

export const useBotThreadsPanelStore = create<BotThreadsPanelState>()(
  persist((): BotThreadsPanelState => ({ openByBotKey: {} }), {
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
  const open = useBotThreadsPanelStore.getState().openByBotKey[botKey] !== true;
  setOpen(botKey, open);
  if (open && !stageHoldsBothPanels(input.trigger)) {
    useRightPanelStore.getState().close(input.threadRef);
  }
}

// The right panel opening where both do not fit closes the Threads panel beside it, wherever it
// was opened from (its toggle, a keybinding, a link that opens a surface).
useRightPanelStore.subscribe((next, previous) => {
  if (next.byThreadKey === previous.byThreadKey || typeof document === "undefined") return;
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
