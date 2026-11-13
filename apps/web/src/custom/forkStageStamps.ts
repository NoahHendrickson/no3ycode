/** Stamps for conditions the palettes used to read through a :has() on a large ancestor (:root,
    the sidebar wrapper or inset, the chat column). Chromium re-checks such a :has() for every
    element inserted under it and restyles the page, so a thread switch paid for each one.
    Root stamps are counted, so split panes and the side chat share them. */
import { useLayoutEffect } from "react";

const holders = new Map<string, { count: number }>();

function retain(attribute: string): () => void {
  let holder = holders.get(attribute);
  if (holder === undefined) {
    holder = { count: 0 };
    holders.set(attribute, holder);
  }
  const held = holder;
  held.count += 1;
  if (held.count === 1) document.documentElement.setAttribute(attribute, "");
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held.count -= 1;
    if (held.count === 0) document.documentElement.removeAttribute(attribute);
  };
}

/** A stable ref that stamps `:root[attribute]` while its element is mounted. */
function rootStampRef(attribute: string) {
  return (element: HTMLElement | null) => (element === null ? undefined : retain(attribute));
}

/** A stable ref that stamps its element's chat column with `attribute` while mounted. */
function columnStampRef(attribute: string) {
  return (element: HTMLElement | null) => {
    const column = element?.closest("[data-chat-column]");
    if (!column) return;
    column.setAttribute(attribute, "");
    return () => column.removeAttribute(attribute);
  };
}

export const forkDockedDetailsRef = columnStampRef("data-fork-has-docked-details");
export const forkFindBarRef = columnStampRef("data-fork-has-find-bar");

/** The stage-card pages' card (the guard lists its producers). */
export const forkStageCardRef = rootStampRef("data-fork-has-stage-card");
export const forkThreadTabsRef = rootStampRef("data-fork-has-thread-tabs");

/** ChatView's column, and the draft greeting it renders only while the new-agent draft hero shows. */
export const forkChatColumnRef = rootStampRef("data-fork-has-chat-column");
export const forkDraftHeroShownRef = rootStampRef("data-fork-draft-hero-shown");

/** `data-fork-has-rows` on ChatView's messages wrapper while the timeline renders rows: the
    wrapper is ChatView's, the rows MessagesTimeline's, so neither can say it alone. */
export function useForkTimelineRowsStamp(viewport: HTMLElement | null, hasRows: boolean) {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- stamps an ancestor React renders elsewhere
  useLayoutEffect(() => {
    const wrapper = viewport?.closest("[data-fork-messages-wrapper]");
    if (!hasRows || !wrapper) return;
    wrapper.setAttribute("data-fork-has-rows", "");
    return () => wrapper.removeAttribute("data-fork-has-rows");
  }, [viewport, hasRows]);
}
