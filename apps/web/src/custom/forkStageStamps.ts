/** Root stamps for conditions the palettes used to read through a :has() on the sidebar wrapper
    or inset. Chromium re-checks such a :has() for every element inserted under it and restyles
    the page, so a thread switch paid for each stamp-free rule. The mounts that own the condition
    stamp :root instead, counted so split panes and the side chat share it. */
import { useLayoutEffect } from "react";

const counts = new Map<string, number>();

function retain(attribute: string) {
  const next = (counts.get(attribute) ?? 0) + 1;
  counts.set(attribute, next);
  if (next === 1) document.documentElement.setAttribute(attribute, "");
  return () => {
    const left = (counts.get(attribute) ?? 1) - 1;
    counts.set(attribute, left);
    if (left === 0) document.documentElement.removeAttribute(attribute);
  };
}

/** A stable ref that stamps `:root[attribute]` while its element is mounted. */
function rootStampRef(attribute: string) {
  return (element: HTMLElement | null) => (element === null ? undefined : retain(attribute));
}

export const forkChatColumnRef = rootStampRef("data-fork-has-chat-column");
/** Usage's and Automations' stage card. */
export const forkStageCardRef = rootStampRef("data-fork-has-stage-card");
export const forkThreadTabsRef = rootStampRef("data-fork-has-thread-tabs");

/** `:root[data-fork-draft-hero-shown]` while a chat column shows the new-agent draft hero. */
export function useForkDraftHeroShownStamp(shown: boolean) {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- stamps :root, outside React
  useLayoutEffect(() => (shown ? retain("data-fork-draft-hero-shown") : undefined), [shown]);
}
