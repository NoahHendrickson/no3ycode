import { useState } from "react";

import { type ResizableWidthHandlers, useResizableWidth } from "./useResizableWidth";
import { observeResize } from "../lib/observeResize";
/* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads */
import {
  inlinePanelRoom,
  otherInlinePanelsWidth,
  stageChatColumn,
} from "../custom/bots/stagePanels";
/* fork:end fork-bot-work-threads */

export interface PreviewPanelInlineSize {
  readonly width: number;
  readonly handlers: ResizableWidthHandlers;
  /** Ref-callback body for the panel host: measures the row the panel shares. */
  readonly observeRow: (host: HTMLElement) => () => void;
}

const PREVIEW_PANEL_WIDTH_STORAGE_KEY = "t3code:preview-panel-width";
const PREVIEW_PANEL_MIN_WIDTH = 360;
const PREVIEW_PANEL_MAX_WIDTH_FRACTION = 0.7;
/** Below this, the sibling chat column's composer overflows. */
const SIBLING_COLUMN_MIN_WIDTH = 360;
const PREVIEW_PANEL_DEFAULT_WIDTH = 540;

export function usePreviewPanelInlineSize(
  options: {
    readonly enabled?: boolean | undefined;
    readonly widthStorageKey?: string | undefined;
    readonly defaultWidth?: number | undefined;
    readonly container?: HTMLElement | null | undefined;
    /* fork:begin fork-design-mode — see .fork/customizations.yaml#fork-design-mode */
    readonly minWidth?: number | undefined;
    /* fork:end fork-design-mode */
    /* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads
       The panel's own minimum: a bot's Threads panel is a list, narrower than the right panel. */
    readonly floorWidth?: number | undefined;
    /* fork:end fork-bot-work-threads */
  } = {},
): PreviewPanelInlineSize {
  const enabled = options.enabled ?? true;
  const container = options.container;
  /* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads */
  const floorWidth = options.floorWidth ?? PREVIEW_PANEL_MIN_WIDTH;
  /* fork:end fork-bot-work-threads */
  const [maxWidth, setMaxWidth] = useState(() =>
    getPreviewPanelMaxWidth(
      typeof window === "undefined" ? 1280 : window.innerWidth,
      undefined,
      /* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads */
      floorWidth,
      /* fork:end fork-bot-work-threads */
    ),
  );
  const { width, handlers } = useResizableWidth({
    storageKey: options.widthStorageKey ?? PREVIEW_PANEL_WIDTH_STORAGE_KEY,
    defaultWidth: options.defaultWidth ?? PREVIEW_PANEL_DEFAULT_WIDTH,
    /* fork:begin fork-design-mode — see .fork/customizations.yaml#fork-design-mode
       A caller's floor (design mode's chrome) yields to the cap, so the sibling column
       keeps its own minimum on a window too narrow for both. */
    minWidth: Math.max(PREVIEW_PANEL_MIN_WIDTH, Math.min(options.minWidth ?? 0, maxWidth)),
    /* fork:end fork-design-mode */
    /* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads */
    ...(options.floorWidth === undefined
      ? {}
      : { minWidth: Math.max(floorWidth, Math.min(options.minWidth ?? 0, maxWidth)) }),
    /* fork:end fork-bot-work-threads */
    maxWidth,
    edge: "left",
  });
  const observeRow = (host: HTMLElement) => {
    const row = container ?? (enabled ? host.parentElement : null) ?? null;
    // Ref callbacks run before paint, so the width is clamped without an over-wide
    // flash on mount. Only the derived cap is stored: the row resizes every frame
    // of a sidebar drag, but an unchanged cap skips re-rendering the owner.
    const measure = () => {
      setMaxWidth(
        getPreviewPanelMaxWidth(
          window.innerWidth,
          /* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads
             The row's other inline panel (a bot's Threads panel, or the right panel) is not room,
             and beside it the conversation keeps 480px. */
          row === null
            ? undefined
            : inlinePanelRoom({
                rowWidth: row.clientWidth,
                otherPanelsWidth: otherInlinePanelsWidth(
                  row,
                  host,
                  options.floorWidth === undefined ? "current" : "minimum",
                ),
                siblingMinWidth: SIBLING_COLUMN_MIN_WIDTH,
              }),
          floorWidth,
          /* fork:end fork-bot-work-threads */
        ),
      );
    };
    measure();
    let frame = 0;
    const onResize = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    window.addEventListener("resize", onResize);
    const stopObserving = row ? observeResize(row, measure) : undefined;
    /* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads
       The other panel opening or resizing moves only the conversation column, not the row. */
    const chatColumn = row === null ? null : stageChatColumn(row);
    const stopObservingChat = chatColumn ? observeResize(chatColumn, measure) : undefined;
    /* fork:end fork-bot-work-threads */
    return () => {
      window.removeEventListener("resize", onResize);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      stopObserving?.();
      /* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads */
      stopObservingChat?.();
      /* fork:end fork-bot-work-threads */
    };
  };
  return { width, handlers, observeRow };
}

function getPreviewPanelMaxWidth(
  viewportWidth: number,
  containerWidth?: number,
  /* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads */
  floorWidth = PREVIEW_PANEL_MIN_WIDTH,
  /* fork:end fork-bot-work-threads */
): number {
  const fractionCap = Math.floor(viewportWidth * PREVIEW_PANEL_MAX_WIDTH_FRACTION);
  const containerCap =
    containerWidth === undefined ? Infinity : Math.floor(containerWidth) - SIBLING_COLUMN_MIN_WIDTH;
  // Keep max >= min; an inverted clamp would overwrite the saved width on drag end.
  return Math.max(
    /* fork:begin fork-bot-work-threads — see .fork/customizations.yaml#fork-bot-work-threads */
    floorWidth,
    /* fork:end fork-bot-work-threads */
    Math.min(fractionCap, containerCap),
  );
}
