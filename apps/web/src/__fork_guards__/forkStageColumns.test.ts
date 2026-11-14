// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and `.fork/customizations.yaml#fork-stage-columns`.
 * The panel controls live in the conversation's header (a maximized right panel's while it hides
 * the conversation), each panel's header holds
 * its own close button, and under Inlet the stage is one card whose columns a border divides.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const chatView = readSibling("../components/ChatView.tsx");
const chatRightPanel = readSibling("../components/chat/ChatRightPanel.tsx");
const headerControls = readSibling("../custom/stageColumns/StageHeaderControls.tsx");
const threadsPanel = readSibling("../custom/bots/BotThreadsPanel.tsx");
const inlet = readSibling("../theme.custom.inlet.css");

describe("fork guard: fork-stage-columns", () => {
  it("keeps the whole control cluster in the conversation's header", () => {
    expect(chatView).toMatch(
      /<ChatHeader[\s\S]*?\{forkProjectlessDraft \? null : panelLayoutControls\}[\s\S]*?<\/header>/u,
    );
    // Not pinned to the window, and never split between the header and a panel.
    expect(chatView).not.toContain("<WorkspaceTitlebarControls");
    expect(chatView).not.toContain("<ThreadPanelHeaderControl");
    expect(chatView).not.toContain("showThreadPanelControl=");
    expect(headerControls).not.toMatch(/\bfixed\b/u);
  });

  it("moves the cluster into a maximized right panel's header", () => {
    expect(chatView).toMatch(
      /const panelLayoutControls = rightPanelMaximized \? null : stageControlCluster;/u,
    );
    expect(chatView).toMatch(
      /layoutControls=\{[\s\S]*?\{rightPanelMaximized \? stageControlCluster : null\}\s*<RightPanelMaximizeControl/u,
    );
  });

  it("gives each panel's header its own close button", () => {
    expect(chatView).toMatch(
      /<StagePanelCloseButton\s+label="Close right panel"\s+onClose=\{closePreviewPanelStable\}/u,
    );
    expect(chatRightPanel).toMatch(/mode="inline"[\s\S]*?layoutControls=\{layoutControls\}/u);
    expect(threadsPanel).toContain('label="Close threads panel"');
  });

  it("sets the stage into the frame as one card on Inlet", () => {
    expect(inlet).toMatch(
      /\[data-fork-theme="inlet"\] \[data-fork-workspace-root\] \{[^}]*margin: var\(--fork-inlet-panel-top\)[^}]*border-radius: var\(--fork-inlet-radius\)/u,
    );
    // A panel is a column of the card: no margin or rounding of its own.
    expect(inlet).not.toMatch(/\[data-preview-panel-mode="inline"\] \{\s*border-width: 0;/u);
    expect(inlet).not.toMatch(/> :last-child \{\s*width: auto;\s*margin:/u);
  });
});
