/** Fork guard — see `.fork/customizations.yaml#fork-details-card-overlay`. */

import { describe, expect, it } from "vite-plus/test";

import { resolveChatCanvasLayout } from "../components/chat/chatCanvasLayout";

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
});
