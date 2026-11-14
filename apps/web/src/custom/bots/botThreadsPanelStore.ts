/**
 * Whether a bot's Threads panel is open, per thread and device like the right panel's — see
 * `.fork/customizations.yaml#fork-bot-work-threads`. Where the right panel is a sheet there is one
 * slot: the panel opened last wins and the other closes.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "~/lib/storage";
import { RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY } from "~/rightPanelLayout";
import { useRightPanelStore } from "~/rightPanelStore";

interface BotThreadsPanelState {
  readonly openByThreadKey: Readonly<Record<string, true>>;
}

export const useBotThreadsPanelStore = create<BotThreadsPanelState>()(
  persist((): BotThreadsPanelState => ({ openByThreadKey: {} }), {
    name: "t3code:fork:bot-threads-panel:v1",
    version: 1,
    storage: createJSONStorage(() =>
      resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
    ),
  }),
);

function isSheetLayout(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY).matches
  );
}

function setOpen(threadKey: string, open: boolean): void {
  useBotThreadsPanelStore.setState((state) => {
    if ((state.openByThreadKey[threadKey] === true) === open) return state;
    const { [threadKey]: _closed, ...rest } = state.openByThreadKey;
    return { openByThreadKey: open ? { ...rest, [threadKey]: true } : rest };
  });
}

export function closeBotThreadsPanel(ref: ScopedThreadRef): void {
  setOpen(scopedThreadKey(ref), false);
}

export function toggleBotThreadsPanel(ref: ScopedThreadRef): void {
  const threadKey = scopedThreadKey(ref);
  const open = useBotThreadsPanelStore.getState().openByThreadKey[threadKey] !== true;
  setOpen(threadKey, open);
  if (open && isSheetLayout()) useRightPanelStore.getState().close(ref);
}

// The right panel opening in the sheet layout closes the Threads panel, wherever it was opened
// from (its toggle, a keybinding, a link that opens a surface).
useRightPanelStore.subscribe((next, previous) => {
  if (next.byThreadKey === previous.byThreadKey) return;
  const open = useBotThreadsPanelStore.getState().openByThreadKey;
  for (const threadKey of Object.keys(open)) {
    if (
      next.byThreadKey[threadKey]?.isOpen === true &&
      previous.byThreadKey[threadKey]?.isOpen !== true &&
      isSheetLayout()
    ) {
      setOpen(threadKey, false);
    }
  }
});
