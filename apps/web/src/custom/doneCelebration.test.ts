import { describe, expect, it } from "vite-plus/test";

import { createDoneTransitions } from "./doneCelebration";

describe("createDoneTransitions", () => {
  it("celebrates a Done that just followed Working, once", () => {
    const transitions = createDoneTransitions();
    transitions.enter("a", "working", 0);
    // The row sat Working for a minute; its mark leaves Working as it turns Done.
    transitions.leave("a", "working", 60_000);
    expect(transitions.enter("a", "done", 60_000)).toBe(true);
    // A second copy of the same thread's mark finds the transition taken.
    expect(transitions.enter("a", "done", 60_010)).toBe(false);
  });

  it("celebrates across a remount, when the finished row moves group", () => {
    const transitions = createDoneTransitions();
    transitions.enter("a", "working", 0);
    transitions.leave("a", "working", 60_000);
    expect(transitions.enter("a", "done", 60_016)).toBe(true);
  });

  it("stays still for a row unmounted while Working (a folded section) that comes back Done", () => {
    const transitions = createDoneTransitions();
    transitions.enter("a", "working", 0);
    transitions.leave("a", "working", 1_000);
    expect(transitions.enter("a", "done", 120_000)).toBe(false);
  });

  it.each(["idle", "approval", "failed"])("does not celebrate Working turning %s", (kind) => {
    const transitions = createDoneTransitions();
    transitions.enter("a", "working", 0);
    transitions.leave("a", "working", 0);
    expect(transitions.enter("a", kind, 0)).toBe(false);
  });

  it("does not celebrate a thread first seen Done", () => {
    expect(createDoneTransitions().enter("a", "done", 0)).toBe(false);
  });
});
