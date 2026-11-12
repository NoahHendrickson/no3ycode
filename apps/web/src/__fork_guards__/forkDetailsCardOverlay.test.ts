/** Fork guard — see `.fork/customizations.yaml#fork-details-card-overlay`. */

import { describe, expect, it } from "vite-plus/test";

import { resolveChatCanvasModel } from "../components/chat/canvasStore";
import { resolveChatCanvasLayout } from "../components/chat/chatCanvasLayout";

const canvasModel = (width: number) =>
  resolveChatCanvasModel({
    measurements: {
      width,
      height: 900,
      padding: 48,
      maxChatWidth: 736,
      minChatWidth: 640,
      composerHeight: 120,
      timelineGutter: 0,
      findBar: null,
    },
    detailsCardMeasurement: null,
    threadRef: null,
    preview: null,
    detailsCardInlineOpen: false,
  });

describe("fork guard: fork-details-card-overlay", () => {
  it("keeps the chat lane where it would be without the docked details card", () => {
    const container = { width: 1344, height: 988 };
    const without = resolveChatCanvasLayout({ container, maxChatWidth: 736, preview: null });
    const withCard = resolveChatCanvasLayout({
      container,
      maxChatWidth: 736,
      detailsCard: { left: 1052, right: 1332, bottom: 339 },
      preview: null,
    });
    expect(withCard.chat).toEqual(without.chat);
  });

  it("stops the docked card above the composer only where it overlaps the lane", () => {
    // At 1100px the lane spans 182–918 and the card starts at 808.
    const narrow = canvasModel(1100);
    expect(narrow.detailsCardPlacement).toMatchObject({ x: 808, y: 12 });
    expect(narrow.detailsCardPlacement!.y + narrow.detailsCardPlacement!.height).toBe(
      900 - 120 - 12,
    );
    // At 1600px the card clears the lane and keeps the full height.
    expect(canvasModel(1600).detailsCardPlacement?.height).toBe(900 - 12 - 12);
  });
});
