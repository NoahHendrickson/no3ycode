import { describe, expect, it } from "vite-plus/test";

import { nextSprintFileDraft, sprintFileEditorView } from "./sprintFileEditor.logic";

describe("sprintFileEditorView", () => {
  it.each([
    {
      name: "shows the file when nobody is editing",
      input: { disk: "A", draft: null, saved: null, reading: false },
      view: { value: "A", dirty: false, stale: false },
    },
    {
      name: "shows the owner's edit, unsaved",
      input: { disk: "A", draft: { text: "AB", base: "A" }, saved: null, reading: false },
      view: { value: "AB", dirty: true, stale: false },
    },
    {
      name: "flags an edit the sprint has since overwritten on disk",
      input: { disk: "S", draft: { text: "AB", base: "A" }, saved: null, reading: false },
      view: { value: "AB", dirty: true, stale: true },
    },
    {
      name: "keeps the saved text until the read after the save lands",
      input: { disk: "A", draft: null, saved: "AB", reading: true },
      view: { value: "AB", dirty: false, stale: false },
    },
    {
      name: "follows the disk once that read lands, even if the sprint wrote since",
      input: { disk: "S", draft: null, saved: "AB", reading: false },
      view: { value: "S", dirty: false, stale: false },
    },
    {
      name: "follows the disk when the edit was undone back to where it began",
      input: { disk: "S", draft: { text: "A", base: "A" }, saved: null, reading: false },
      view: { value: "S", dirty: false, stale: false },
    },
  ])("$name", ({ input, view }) => {
    expect(sprintFileEditorView(input)).toEqual(view);
  });
});

describe("nextSprintFileDraft", () => {
  it("keeps the text the owner began from across keystrokes", () => {
    const first = nextSprintFileDraft(null, "A", "AB");
    expect(first).toEqual({ text: "AB", base: "A" });
    expect(nextSprintFileDraft(first, "AB", "ABC")).toEqual({ text: "ABC", base: "A" });
  });
});
