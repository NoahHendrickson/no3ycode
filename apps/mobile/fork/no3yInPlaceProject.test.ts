import { describe, expect, it } from "vite-plus/test";

import {
  NO3Y_PICK_PROJECT_REASON,
  no3yInPlaceSkipsPicker,
  no3yProjectPickBlockReason,
} from "./no3yInPlaceProject";

describe("no3y New agent picks its project in place", () => {
  it("never opens or leaves for the picker, which trapped the user under Home", () => {
    expect(no3yInPlaceSkipsPicker("pick")).toBe(true);
    expect(no3yInPlaceSkipsPicker("dismiss")).toBe(true);
    expect(no3yInPlaceSkipsPicker("preserve")).toBe(false);
    expect(no3yInPlaceSkipsPicker("select")).toBe(false);
  });

  it("blocks send until a project is chosen, never for Chat's own project", () => {
    const block = (draftNamesProject: boolean, selectedProjectKey: string | null, inPlace = true) =>
      no3yProjectPickBlockReason({ inPlace, draftNamesProject, selectedProjectKey });
    expect(block(false, null)).toBe(NO3Y_PICK_PROJECT_REASON);
    expect(block(false, "env-1:a")).toBeNull();
    expect(block(true, null)).toBeNull();
    expect(block(false, null, false)).toBeNull();
  });
});
