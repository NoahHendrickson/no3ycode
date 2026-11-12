import { describe, expect, it, vi } from "vite-plus/test";

import type { DraftId } from "~/composerDraftStore";
import { playDraftProjectPick, rememberDraftProjectPick } from "./draftProjectPickMotion";

function button(left: number): HTMLButtonElement {
  const element = document.createElement("button");
  element.style.cssText = `position: fixed; top: 0; left: ${left}px; width: 40px; height: 24px;`;
  document.body.append(element);
  return element;
}

describe("draftProjectPickMotion", () => {
  it("resumes the slide on a chip that remounted mid-pick", () => {
    const draftId = "draft-remount" as DraftId;
    using now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const pill = button(200);
    rememberDraftProjectPick(draftId, pill);
    pill.remove();

    const pendingChip = button(8);
    playDraftProjectPick(draftId, pendingChip);
    expect(pendingChip.getAnimations()).toHaveLength(1);
    pendingChip.remove();

    now.mockReturnValue(1_100);
    const settledChip = button(8);
    playDraftProjectPick(draftId, settledChip);
    const [slide] = settledChip.getAnimations();
    expect(slide?.currentTime).toBe(100);

    now.mockReturnValue(1_400);
    const laterChip = button(8);
    playDraftProjectPick(draftId, laterChip);
    expect(laterChip.getAnimations()).toHaveLength(0);
    for (const element of [settledChip, laterChip]) element.remove();
  });
});
