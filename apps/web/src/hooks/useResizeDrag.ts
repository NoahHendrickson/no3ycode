import { type PointerEvent, useState } from "react";

/* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads */
import { useStableCallback } from "./useStableCallback";
/* fork:end fork-bot-work-threads */

export interface ResizeBounds {
  readonly min: number;
  readonly max: number;
}

interface ResizeSession {
  width: number;
  /* fork:begin fork-bot-digest — see .fork/customizations.yaml#fork-bot-digest */
  // A top or bottom edge resizes a height, along the vertical axis.
  edge: "left" | "right" | "top" | "bottom";
  /* fork:end fork-bot-digest */
  /** Pointer widths are clamped to these before `resize` sees them. */
  bounds: ResizeBounds;
  resize: (width: number) => number;
  finish: (width: number, moved: boolean) => void;
  cleanup?: (committed: boolean) => void;
}

function clampToBounds(width: number, bounds: ResizeBounds): number {
  return Math.max(bounds.min, Math.min(bounds.max, width));
}

/* fork:begin fork-bot-digest — see .fork/customizations.yaml#fork-bot-digest */
const isVertical = (edge: ResizeSession["edge"]) => edge === "top" || edge === "bottom";
const along = (event: { clientX: number; clientY: number }, edge: ResizeSession["edge"]) =>
  isVertical(edge) ? event.clientY : event.clientX;
/* fork:end fork-bot-digest */

interface ActiveDrag<T extends HTMLElement> {
  session: ResizeSession;
  target: T;
  pointerId: number;
  startX: number;
  pendingX: number;
  width: number;
  moved: boolean;
  frame: number | null;
  onBlur: () => void;
}

function createResizeDrag<T extends HTMLElement>() {
  let drag: ActiveDrag<T> | null = null;

  const flush = () => {
    const active = drag;
    if (!active) return;
    /* fork:begin fork-bot-digest — see .fork/customizations.yaml#fork-bot-digest */
    const leading = active.session.edge === "left" || active.session.edge === "top";
    const delta = (active.pendingX - active.startX) * (leading ? -1 : 1);
    /* fork:end fork-bot-digest */
    if (Math.abs(delta) > 2) active.moved = true;
    active.width = active.session.resize(
      clampToBounds(active.session.width + delta, active.session.bounds),
    );
  };

  const finish = (commit: boolean) => {
    const active = drag;
    if (!active) return;
    if (active.frame !== null) cancelAnimationFrame(active.frame);
    window.removeEventListener("blur", active.onBlur);
    if (commit) flush();
    // Release can synchronously dispatch lostpointercapture.
    drag = null;
    try {
      if (active.target.hasPointerCapture(active.pointerId)) {
        active.target.releasePointerCapture(active.pointerId);
      }
    } catch {}
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
    active.session.cleanup?.(commit);
    if (commit) active.session.finish(active.width, active.moved);
  };

  const end = (event: PointerEvent<T>, usePosition: boolean) => {
    const active = drag;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    /* fork:begin fork-bot-digest — see .fork/customizations.yaml#fork-bot-digest */
    if (usePosition) active.pendingX = along(event, active.session.edge);
    /* fork:end fork-bot-digest */
    finish(true);
  };

  return {
    ref: (node: T | null) => (node === null ? undefined : () => finish(false)),
    cancel: () => finish(false),
    refresh(bounds?: ResizeBounds) {
      if (!drag) return;
      if (bounds) drag.session.bounds = bounds;
      flush();
    },
    begin(event: PointerEvent<T>, start: (event: PointerEvent<T>) => ResizeSession | null) {
      if (event.button !== 0 || drag) return;
      const session = start(event);
      if (!session) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        session.cleanup?.(false);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      // Leaving the window mid-drag commits where the pointer was.
      const onBlur = () => finish(true);
      window.addEventListener("blur", onBlur);
      drag = {
        session,
        target: event.currentTarget,
        pointerId: event.pointerId,
        /* fork:begin fork-bot-digest — see .fork/customizations.yaml#fork-bot-digest */
        startX: along(event, session.edge),
        pendingX: along(event, session.edge),
        /* fork:end fork-bot-digest */
        width: session.width,
        moved: false,
        frame: null,
        onBlur,
      };
      /* fork:begin fork-bot-digest — see .fork/customizations.yaml#fork-bot-digest */
      document.body.style.cursor = isVertical(session.edge) ? "row-resize" : "col-resize";
      /* fork:end fork-bot-digest */
      document.body.style.userSelect = "none";
    },
    onPointerMove(event: PointerEvent<T>) {
      const active = drag;
      if (!active || active.pointerId !== event.pointerId) return;
      event.preventDefault();
      /* fork:begin fork-bot-digest — see .fork/customizations.yaml#fork-bot-digest */
      const position = along(event, active.session.edge);
      active.pendingX = position;
      if (Math.abs(position - active.startX) > 2) active.moved = true;
      /* fork:end fork-bot-digest */
      if (active.frame !== null) return;
      active.frame = requestAnimationFrame(() => {
        active.frame = null;
        flush();
      });
    },
    onPointerUp: (event: PointerEvent<T>) => end(event, true),
    onPointerCancel: (event: PointerEvent<T>) => end(event, false),
    onLostPointerCapture: (event: PointerEvent<T>) => end(event, false),
  };
}

/**
 * A pointer drag that resizes along one edge. The session `start` returns owns
 * everything the drag needs, so options read at pointer-down hold for the whole
 * drag. Attach `ref` to the handle so unmounting it abandons the drag.
 */
export function useResizeDrag<T extends HTMLElement>(
  start: (event: PointerEvent<T>) => ResizeSession | null,
) {
  // Created once: `ref` must keep its identity, or a re-render mid-drag would run its cleanup.
  const [drag] = useState(createResizeDrag<T>);
  const { begin, ...rest } = drag;
  /* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads
     A stable start, so new bounds alone (the other inline panel resizing) keep the handlers and
     leave the panel's content unrendered. `start` still runs at pointer-down with the latest. */
  const startDrag = useStableCallback(start);
  return { ...rest, onPointerDown: (event: PointerEvent<T>) => begin(event, startDrag) };
  /* fork:end fork-bot-work-threads */
}
