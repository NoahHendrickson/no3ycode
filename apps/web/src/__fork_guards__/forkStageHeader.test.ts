// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and `.fork/customizations.yaml#fork-stage-header`.
 * On Inlet the stage's header rows are 36px, the conversation's header shows the thread's title,
 * and a thread with a parent has a back button to it beside the title.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const chatView = readSibling("../components/ChatView.tsx");
const chatHeader = readSibling("../components/chat/ChatHeader.tsx");
const inlet = readSibling("../theme.custom.inlet.css");
const inletMenus = readSibling("../theme.custom.inlet-menus.css");

describe("fork guard: fork-stage-header", () => {
  it("thins the stage's header rows on Inlet, and only the stage's", () => {
    expect(inlet).toContain("--fork-inlet-stage-header-height: 36px;");
    expect(inlet).toMatch(
      /\[data-fork-workspace-root\] \{[^}]*--workspace-topbar-height: var\(--fork-inlet-stage-header-height\);/u,
    );
    // The details popover is portaled out of the stage, so it reads the token itself.
    expect(inletMenus).toMatch(
      /--fork-inlet-details-rise: calc\([\s\S]*?var\(--fork-inlet-stage-header-height\)/u,
    );
  });

  it("shows the thread's title on Inlet, without the project or parent crumbs", () => {
    expect(inlet).toMatch(
      /\[data-chat-header\]\s+nav\s+li:not\(\[aria-current="page"\]\) \{\s*display: none;/u,
    );
    expect(inlet).not.toMatch(
      /nav:has\(\[data-slot="workspace-breadcrumb-text"\]\)[^{]*\{\s*visibility: hidden;/u,
    );
  });

  it("leads back to the parent from beside the title", () => {
    expect(chatView).toMatch(/const headerParentThreadLink =[\s\S]*?useStageHeaderParent\(/u);
    expect(chatHeader).toContain(
      "<StageHeaderBackButton parent={parentThreadLink} onOpen={onOpenThread} />",
    );
    expect(chatHeader.indexOf("<StageHeaderBackButton")).toBeLessThan(
      chatHeader.indexOf("<WorkspaceBreadcrumb"),
    );
  });
});
