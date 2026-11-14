/**
 * The stage's row can hold two inline panels beside the conversation: a bot's Threads panel and
 * the right panel — see `.fork/customizations.yaml#fork-bot-work-threads`. With one open nothing
 * changes. With both, each one's widest leaves the conversation 480px, and a row too narrow for
 * that and both panels' minimums holds only the panel opened last.
 */

/** The conversation's minimum while both panels are open beside it. */
export const CONVERSATION_MIN_BESIDE_TWO_PANELS = 480;
/** The Threads panel is a list: narrower than the right panel. */
export const BOT_THREADS_PANEL_MIN_WIDTH = 280;
export const BOT_THREADS_PANEL_DEFAULT_WIDTH = 320;
/** The right panel's own minimum (usePreviewPanelInlineSize). */
const RIGHT_PANEL_MIN_WIDTH = 360;

/** Whether the row holds the conversation and both panels at their minimums. */
export function stageFitsBothPanels(rowWidth: number): boolean {
  return (
    rowWidth >=
    CONVERSATION_MIN_BESIDE_TWO_PANELS + RIGHT_PANEL_MIN_WIDTH + BOT_THREADS_PANEL_MIN_WIDTH
  );
}

/** The width a panel's cap is measured against, the sizing hook keeping `siblingMinWidth` of it
    for the conversation: the whole row alone, and beside the other panel, the row less that panel
    and the rest of the conversation's larger minimum. */
export function inlinePanelRoom(input: {
  readonly rowWidth: number;
  readonly otherPanelsWidth: number;
  readonly siblingMinWidth: number;
}): number {
  if (input.otherPanelsWidth <= 0) return input.rowWidth;
  return (
    input.rowWidth -
    input.otherPanelsWidth -
    (CONVERSATION_MIN_BESIDE_TWO_PANELS - input.siblingMinWidth)
  );
}

/** The combined width of the row's inline panels other than `host`. */
export function otherInlinePanelsWidth(row: HTMLElement, host: HTMLElement): number {
  let width = 0;
  for (const child of row.children) {
    if (
      child !== host &&
      child instanceof HTMLElement &&
      child.dataset.previewPanelMode === "inline"
    ) {
      width += child.offsetWidth;
    }
  }
  return width;
}

/** The conversation column, which gives way whenever the other panel opens or resizes. */
export function stageChatColumn(row: HTMLElement): HTMLElement | null {
  return row.querySelector<HTMLElement>(":scope > [data-chat-column]");
}

/** The stage row a control or panel sits in, when it sits in one (a sheet is portalled out). */
export function stageRowOf(element: Element | null): HTMLElement | null {
  return element?.closest<HTMLElement>("[data-fork-workspace-root]") ?? null;
}
