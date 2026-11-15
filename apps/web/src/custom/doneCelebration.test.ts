import { describe, expect, it } from "vite-plus/test";

import { createDoneTransitions } from "./doneCelebration";

describe("createDoneTransitions", () => {
  it("sees a Done that just followed Working, once", () => {
    const transitions = createDoneTransitions();
    transitions.enter("a", "working", 0);
    // The row sat Working for a minute; its mark leaves Working as it turns Done, or as the
    // finished row unmounts from the Working group.
    transitions.leave("a", "working", 60_000);
    expect(transitions.leftWorking("a", 60_016)).toBe(true);
    transitions.enter("a", "done", 60_016);
    // A second copy of the same thread's mark finds the transition taken.
    expect(transitions.leftWorking("a", 60_020)).toBe(false);
  });

  it("stays still for a row unmounted while Working (a folded section) that comes back Done", () => {
    const transitions = createDoneTransitions();
    transitions.enter("a", "working", 0);
    transitions.leave("a", "working", 1_000);
    expect(transitions.leftWorking("a", 120_000)).toBe(false);
  });

  it("does not see a thread first seen Done", () => {
    expect(createDoneTransitions().leftWorking("a", 0)).toBe(false);
  });
});
