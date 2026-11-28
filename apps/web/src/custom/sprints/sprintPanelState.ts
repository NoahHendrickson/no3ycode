/**
 * The tabs of a sprint's Threads panel — see `.fork/customizations.yaml#fork-sprints`. The open
 * tab is kept per sprint for the session, so leaving and coming back keeps it.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { FORK_BOT_CREW_FILE } from "@t3tools/shared/forkBotTags";
import { create } from "zustand";

import { readThreadShell } from "~/state/entities";

import { openBotThreadsChild } from "../bots/botThreadsPanelStore";
import { isSprintThread, SPRINT_MEMORY_FILE } from "./sprintThreads";

export const SPRINT_PANEL_TABS = [
  { id: "threads", label: "Threads" },
  { id: "pullRequests", label: "Pull requests" },
  { id: "goal", label: "Goal" },
  { id: "library", label: "Library" },
  { id: "instructions", label: "Instructions" },
  { id: "memory", label: "Memory" },
] as const;

/** Room for the tabs and, on Threads, search, filter and sort beside the close button; a Petal's is 320. */
export const SPRINT_PANEL_DEFAULT_WIDTH = 380;

export type SprintPanelTab = (typeof SPRINT_PANEL_TABS)[number]["id"];

/** The file each editing tab opens, in the sprint's folder. */
export const SPRINT_PANEL_TAB_FILES = {
  // CREW.md: the server adds it to each launched thread's first message, and CLAUDE.md imports it.
  instructions: FORK_BOT_CREW_FILE,
  memory: SPRINT_MEMORY_FILE,
} as const satisfies Partial<Record<SprintPanelTab, string>>;

export function isSprintPanelTab(value: unknown): value is SprintPanelTab {
  return SPRINT_PANEL_TABS.some((tab) => tab.id === value);
}

const useSprintPanelTabStore = create<{
  readonly bySprintKey: Readonly<Record<string, SprintPanelTab>>;
}>(() => ({ bySprintKey: {} }));

export function setSprintPanelTab(sprintKey: string, tab: SprintPanelTab): void {
  useSprintPanelTabStore.setState((state) => ({
    bySprintKey: { ...state.bySprintKey, [sprintKey]: tab },
  }));
}

export function useSprintPanelTab(sprintKey: string): SprintPanelTab {
  return useSprintPanelTabStore((state) => state.bySprintKey[sprintKey]) ?? "threads";
}

/** Opens `target` in the panel of `hostRef` when that conversation is a sprint, so the sprint
    stays on screen; false when it is not one, and the caller opens the thread its own way. */
export function openInSprintPanel(
  hostRef: ScopedThreadRef | null | undefined,
  target: ScopedThreadRef,
): boolean {
  if (hostRef == null || scopedThreadKey(hostRef) === scopedThreadKey(target)) return false;
  const host = readThreadShell(hostRef);
  if (host === null || !isSprintThread(host.source)) return false;
  if (!openBotThreadsChild(hostRef, target)) return false;
  setSprintPanelTab(scopedThreadKey(hostRef), "threads");
  return true;
}
