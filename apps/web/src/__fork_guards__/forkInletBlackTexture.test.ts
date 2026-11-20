// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-inlet-black-texture`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { BASIC_NEW_AGENT_BACKDROPS } from "../custom/basicNewAgentBackdropSetting";
import {
  DEFAULT_INLET_NEW_AGENT_BACKDROPS,
  INLET_NEW_AGENT_BACKDROPS,
} from "../custom/inletNewAgentBackdropSetting";
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
  it("lets each Inlet colour pick its new-agent background, Black starting on the texture", () => {
    expect(INLET_NEW_AGENT_BACKDROPS).toEqual(["none", ...BASIC_NEW_AGENT_BACKDROPS]);
    expect(DEFAULT_INLET_NEW_AGENT_BACKDROPS).toEqual({ black: "texture", cream: "none" });
    expect(read("../custom/BasicNewAgentBackdrop.tsx")).toContain(
      'if (inletColor !== null && inletBackdrop !== "none") {',
    );
    expect(read("../components/settings/AppearanceSettingsPanel.tsx")).toMatch(
      /appearance === INLET_THEME \? \(\s*<SettingsRow\s*title="New agent background"/u,
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

  it("clears the panel's paint over the picture on either Inlet colour's new-agent screen", () => {
    const rule = cssRules(read("../theme.custom.inlet.css")).find(
      (candidate) =>
        !candidate.selector.includes("data-fork-inlet-color") &&
        candidate.selector.includes("[data-fork-draft-hero]") &&
        candidate.selector.includes("[data-chat-header]"),
    );
    expect(rule?.body).toContain("background-color: transparent");
  });
});
