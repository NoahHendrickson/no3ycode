// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-inlet-black-texture`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { cssRules } from "./cssRules";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("fork guard: fork-inlet-black-texture", () => {
  it("mounts the texture in the chat column, on the new-agent screen only", () => {
    const chatView = read("../components/ChatView.tsx");
    expect(chatView).toContain(
      "<InletBlackNewAgentTexture shown={isDraftHeroState && !embedded} />",
    );
    const mount = read("../custom/InletBlackNewAgentTexture.tsx");
    expect(mount).toContain('inletColor !== "black"');
  });

  it("settles instead of animating for as long as the screen is open", () => {
    const backdrop = read("../custom/pixelTexture/PixelTextureBackdrop.tsx");
    expect(backdrop).toContain("settleMs = 2500");
    expect(backdrop).toContain("prefers-reduced-motion: reduce");
  });

  it("clears the panel's paint over the texture on Inlet Black's new-agent screen", () => {
    const rule = cssRules(read("../theme.custom.inlet.css")).find(
      (candidate) =>
        candidate.selector.includes('[data-fork-inlet-color="black"]') &&
        candidate.selector.includes("[data-fork-draft-hero]") &&
        candidate.selector.includes("[data-chat-header]"),
    );
    expect(rule?.body).toContain("background-color: transparent");
  });
});
