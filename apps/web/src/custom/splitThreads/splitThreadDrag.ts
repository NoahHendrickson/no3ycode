/**
 * Drag a sidebar card or a collapsed thread tab onto another to split them —
 * see `.fork/customizations.yaml#fork-split-threads`.
 *
 * Native drag and drop, so it stays clear of the pinned block's dnd-kit
 * sorting (pinned cards are neither sources nor targets) and of the file
 * drop every row already takes (those handlers only answer `Files` drags).
 * Every drag source is also a drop target: the list listens once for every
 * row, and the target is the source under the pointer. The dragged key is
 * shared, so a card drops on a tab and a tab on a card.
 */
import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { DragEvent, PointerEvent } from "react";

import { useSplitThreadStore } from "./splitThreadStore";

const SPLIT_THREAD_DRAG_TYPE = "application/x-t3code-split-thread";
const SPLIT_ITEM_ATTRIBUTE = "data-fork-split-item";
const DROP_TARGET_ATTRIBUTE = "data-fork-split-drop-target";
// Matched on the DOM target, not its ancestry: a portaled tooltip's link
// still bubbles its React events to the row. A row's own stretched open
// button opts back in with data-fork-split-drag-surface.
const CONTROL_SELECTOR = ":is(button, a, input):not([data-fork-split-drag-surface])";

/** dataTransfer is unreadable during dragover, so the source rides here. */
let draggedThreadKey: string | null = null;

const startsOnControl = (event: { readonly target: EventTarget | null }) =>
  event.target instanceof Element && event.target.closest(CONTROL_SELECTOR) !== null;

export function splitThreadDragSourceProps(threadKey: string, enabled: boolean) {
  return {
    [SPLIT_ITEM_ATTRIBUTE]: threadKey,
    // Decided per press, before the browser can start a drag: a press on the
    // row's hover actions begins the settle sweep, a pointer gesture a native
    // drag would cancel, and touch keeps its long-press menu. Attached even
    // while the row cannot be a source (renaming, pinned), so a press there
    // turns off what an earlier press turned on.
    onPointerDownCapture: (event: PointerEvent<HTMLElement>) => {
      event.currentTarget.draggable =
        enabled && event.pointerType === "mouse" && !startsOnControl(event);
    },
    onDragStart: (event: DragEvent<HTMLElement>) => {
      if (!enabled) {
        event.preventDefault();
        return;
      }
      // A link drags natively and its dragstart bubbles here; it is not a split.
      if (startsOnControl(event)) return;
      draggedThreadKey = threadKey;
      event.dataTransfer.setData(SPLIT_THREAD_DRAG_TYPE, threadKey);
      event.dataTransfer.effectAllowed = "link";
    },
  };
}

function rowUnder(event: DragEvent<HTMLElement>): HTMLElement | null {
  return event.target instanceof Element
    ? (event.target.closest<HTMLElement>(`[${SPLIT_ITEM_ATTRIBUTE}]`) ?? null)
    : null;
}

/** Spread on the list that holds the rows. The row dropped on keeps the left
    pane, and the dragged thread opens unless the route shows one of the two. */
export function makeSplitDropHandlers(input: {
  readonly canPair: (threadKey: string) => boolean;
  readonly openThreadKey: string | null;
  readonly openThread: (threadRef: ScopedThreadRef) => void;
}) {
  const clearTarget = (event: DragEvent<HTMLElement>) => {
    event.currentTarget
      .querySelectorAll(`[${DROP_TARGET_ATTRIBUTE}]`)
      .forEach((element) => element.removeAttribute(DROP_TARGET_ATTRIBUTE));
  };
  const isSplitDrag = (event: DragEvent<HTMLElement>) =>
    draggedThreadKey !== null && event.dataTransfer.types.includes(SPLIT_THREAD_DRAG_TYPE);
  const targetFor = (event: DragEvent<HTMLElement>) => {
    const row = rowUnder(event);
    const targetKey = row?.getAttribute(SPLIT_ITEM_ATTRIBUTE) ?? null;
    if (!row || targetKey === null || targetKey === draggedThreadKey) return null;
    return input.canPair(targetKey) ? { row, targetKey } : null;
  };
  const pair = (draggedKey: string, targetKey: string) => {
    const dragged = parseScopedThreadKey(draggedKey);
    const target = parseScopedThreadKey(targetKey);
    if (!dragged || !target) return;
    useSplitThreadStore.getState().pair(target, dragged);
    if (input.openThreadKey !== draggedKey && input.openThreadKey !== targetKey) {
      input.openThread(dragged);
    }
  };
  return {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!isSplitDrag(event)) return;
      const target = targetFor(event);
      if (!target) {
        clearTarget(event);
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "link";
      if (!target.row.hasAttribute(DROP_TARGET_ATTRIBUTE)) {
        clearTarget(event);
        target.row.setAttribute(DROP_TARGET_ATTRIBUTE, "");
      }
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (!isSplitDrag(event)) return;
      const next = event.relatedTarget;
      if (!(next instanceof Node) || !event.currentTarget.contains(next)) clearTarget(event);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (!isSplitDrag(event)) return;
      const target = targetFor(event);
      const dragged = draggedThreadKey;
      clearTarget(event);
      if (!target || dragged === null) return;
      event.preventDefault();
      pair(dragged, target.targetKey);
    },
    onDragEnd: (event: DragEvent<HTMLElement>) => {
      draggedThreadKey = null;
      clearTarget(event);
    },
  };
}
