/**
 * The stage's row can hold two inline panels beside the conversation: a bot's Threads panel and
 * the right panel — see `.fork/customizations.yaml#fork-bot-work-threads`. Each one's widest is
 * the row less the other's width and the conversation's minimum, so together they never squeeze
 * the conversation out.
 */

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
