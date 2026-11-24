import { describe, expect, it } from "vite-plus/test";

import {
  claimNo3yKeyboard,
  no3yComposerFollowsKeyboard,
  readNo3yKeyboardOwner,
} from "./no3yKeyboardOwner";

describe("no3y keyboard owner", () => {
  it("lifts the composer only for its own editor, and only on the no3y layout", () => {
    expect(no3yComposerFollowsKeyboard({ no3yLayout: true, owner: "composer" })).toBe(true);
    expect(no3yComposerFollowsKeyboard({ no3yLayout: true, owner: "other" })).toBe(false);
    expect(no3yComposerFollowsKeyboard({ no3yLayout: false, owner: "other" })).toBe(true);
  });

  it("keeps the last owner until another input claims the keyboard", () => {
    claimNo3yKeyboard("other");
    expect(readNo3yKeyboardOwner()).toBe("other");
    claimNo3yKeyboard("composer");
    expect(readNo3yKeyboardOwner()).toBe("composer");
  });
});
