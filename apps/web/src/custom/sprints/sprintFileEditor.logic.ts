/**
 * What a sprint file tab shows while the owner and the sprint both write the file — see
 * `.fork/customizations.yaml#fork-sprints`.
 */

/** The owner's edit, and the file's text on disk when they began it. */
export interface SprintFileDraft {
  readonly text: string;
  readonly base: string;
}

export interface SprintFileEditorView {
  readonly value: string;
  /** The owner has changes that are not on disk. */
  readonly dirty: boolean;
  /** The file changed on disk since the owner began editing, so a save would overwrite that. */
  readonly stale: boolean;
}

/**
 * `disk` is null until the first read. `saved` is the text just written, shown until the read
 * that follows the save lands, so the editor never flashes back to the old text.
 */
export function sprintFileEditorView(input: {
  readonly disk: string | null;
  readonly draft: SprintFileDraft | null;
  readonly saved: string | null;
  readonly reading: boolean;
}): SprintFileEditorView {
  const { disk, draft, saved } = input;
  if (draft !== null && draft.text !== draft.base) {
    return {
      value: draft.text,
      dirty: draft.text !== disk,
      stale: disk !== null && disk !== draft.base && disk !== draft.text,
    };
  }
  const value = saved !== null && (input.reading || disk === null) ? saved : (disk ?? "");
  return { value, dirty: false, stale: false };
}

/** The draft after a keystroke: its base stays the text the owner began from. */
export function nextSprintFileDraft(
  draft: SprintFileDraft | null,
  shown: string,
  text: string,
): SprintFileDraft {
  return { text, base: draft !== null && draft.text !== draft.base ? draft.base : shown };
}
