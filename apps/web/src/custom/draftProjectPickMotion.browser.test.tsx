import { describe, expect, it, vi } from "vite-plus/test";

import type { DraftId } from "~/composerDraftStore";
import { render } from "../../test/render";
import {
  playDraftProjectPick,
  rememberDraftProjectPick,
  useDraftProjectChipsJoining,
} from "./draftProjectPickMotion";

function Strip(props: { readonly draftId: DraftId }) {
  const joining = useDraftProjectChipsJoining(props.draftId);
  return <div data-testid="strip" data-joining={joining ? "" : undefined} />;
}

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

  it("fades in the chips of a strip that mounts just after a pick, and no other", async () => {
    using _now = vi.spyOn(Date, "now").mockReturnValue(5_000);
    const pill = button(200);
    rememberDraftProjectPick("draft-picked" as DraftId, pill);
    pill.remove();
    await using screen = await render(
      <>
        <Strip draftId={"draft-picked" as DraftId} />
        <Strip draftId={"draft-untouched" as DraftId} />
      </>,
    );
    const [picked, untouched] = screen.getByTestId("strip").elements();
    expect(picked?.hasAttribute("data-joining")).toBe(true);
    expect(untouched?.hasAttribute("data-joining")).toBe(false);
  });
});
