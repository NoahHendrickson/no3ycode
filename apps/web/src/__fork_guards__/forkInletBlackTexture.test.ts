// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-inlet-black-texture`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { paintPixelTexture } from "../custom/pixelTexture/paintPixelTexture";
import { cssRules } from "./cssRules";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

/** A canvas whose 2D context accepts every call, and a window whose frames are counted. */
function stubPage(focused: boolean) {
  const context = new Proxy({}, { get: () => () => undefined });
  const canvas = () => ({ style: {}, getContext: () => context }) as unknown as HTMLCanvasElement;
  const win = Object.assign(new EventTarget(), {
    devicePixelRatio: 2,
    setTimeout: () => 0,
    clearTimeout: () => undefined,
  });
  const requested = vi.fn(() => 1);
  const cancelled = vi.fn();
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", { createElement: canvas, hasFocus: () => focused });
  vi.stubGlobal("requestAnimationFrame", requested);
  vi.stubGlobal("cancelAnimationFrame", cancelled);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  return { win, canvas: canvas(), requested, cancelled };
}

const GRID = { cols: 12, rows: 10, unit: 2 };
const COLORS = { ground: "#fff", text: "#000" };

describe("fork guard: fork-inlet-black-texture", () => {
  it("mounts the texture in the chat column, on Inlet Black's new-agent screen only", () => {
    expect(read("../components/ChatView.tsx")).toContain(
      "<InletBlackNewAgentTexture shown={isDraftHeroState && !embedded} />",
    );
    expect(read("../custom/InletBlackNewAgentTexture.tsx")).toContain(
      'if (!props.shown || inletColor !== "black") return null;',
    );
  });

  it("draws one still frame under reduced motion", () => {
    const backdrop = read("../custom/pixelTexture/PixelTextureBackdrop.tsx");
    expect(backdrop).toContain('useMediaQuery("(prefers-reduced-motion: reduce)")');
    expect(backdrop).toContain("!reducedMotion);");
    const page = stubPage(true);
    paintPixelTexture(page.canvas, GRID, COLORS, false);
    expect(page.requested).not.toHaveBeenCalled();
  });

  it("pauses while the window is in the background and stops on cleanup", () => {
    const page = stubPage(false);
    const stop = paintPixelTexture(page.canvas, GRID, COLORS, true);
    expect(page.requested).not.toHaveBeenCalled();
    page.win.dispatchEvent(new Event("focus"));
    expect(page.requested).toHaveBeenCalledTimes(1);
    page.win.dispatchEvent(new Event("blur"));
    expect(page.cancelled).toHaveBeenCalledTimes(1);
    stop();
    page.win.dispatchEvent(new Event("focus"));
    expect(page.requested).toHaveBeenCalledTimes(1);
  });

  it("clears the panel's paint over the texture on Inlet Black's new-agent screen", () => {
    const rule = cssRules(read("../theme.custom.inlet-black.css")).find(
      (candidate) =>
        candidate.selector.includes('[data-fork-inlet-color="black"]') &&
        candidate.selector.includes("[data-fork-draft-hero]") &&
        candidate.selector.includes("[data-chat-header]"),
    );
    expect(rule?.body).toContain("background-color: transparent");
  });
});
