// @effect-diagnostics nodeBuiltinImport:off
/* Fork guard, see `.fork/customizations.yaml#fork-collapsed-thread-tabs`. A sync that drops
   the mount, the header-inset rule or the selected glass loses the tabs or their look. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const panes = readSibling("../custom/splitThreads/SplitThreadPanes.tsx");
const strip = readSibling("../custom/CollapsedThreadTabs.tsx");
const theme = readSibling("../theme.custom.css");
const glassSurfaces = readSibling("../theme.custom.glass-surfaces.css");
const sidebar = readSibling("../components/Sidebar.tsx");
const panelControls = readSibling("../components/chat/PanelLayoutControls.tsx");

describe("fork guard: fork-collapsed-thread-tabs", () => {
  it("mounts the strip once, above every thread pane", () => {
    const stripAt = panes.indexOf("<CollapsedThreadTabs");
    const panesAt = panes.indexOf('data-fork-thread-panes=""');
    expect(stripAt).toBeGreaterThan(-1);
    expect(panesAt).toBeGreaterThan(stripAt);
    // A split hands its threads over, left then right, for the shared capsule.
    expect(panes).toContain(
      "paneThreadRefs={split ? [layout.left, layout.right] : NO_PANE_THREADS}",
    );
  });

  it("starts a new agent through the sidebar's own paths, in the filtered project if any", () => {
    expect(strip).toContain("const startNewAgentDraft = useStartNewAgentDraft();");
    expect(strip).toContain(
      "if (filteredProject && startSidebarThreadInProject(filteredProject.projectKey)) return;",
    );
    expect(strip).toContain("onClick={startNewAgent}");
    expect(sidebar).toContain(
      "() => registerSidebarStartThreadInProject(handleNewThreadInProject),",
    );
  });

  it("renders only while the desktop sidebar is collapsed, holding Completed throughout", () => {
    expect(strip).toContain("if (isMobile) return null;");
    expect(strip).toContain("if (sidebarVisible) return <CompletedHoldObserver />;");
  });

  it("lays the panes under the strip out as beside an open sidebar", () => {
    expect(strip).toContain('data-fork-thread-tabs=""');
    expect(theme).toContain("[data-fork-thread-tabs] + [data-fork-thread-panes] {");
    expect(theme).toContain("--workspace-titlebar-content-left: var(--workspace-gutter-start);");
    // A lone pane's window-fixed controls drop to its header row; contained panes keep theirs.
    expect(theme).toContain("> :not([data-fork-split-pane], [data-fork-float-behind]) {");
    expect(theme).toContain(
      "var(--workspace-topbar-height) - var(--fork-thread-tabs-overlap, 0px)",
    );
    // The header's own thread panel toggle keeps its place, through an explicit stamp.
    expect(panelControls).toContain('data-fork-header-anchored-controls=""');
    expect(theme).toContain("+ [data-fork-thread-panes]\n  [data-fork-header-anchored-controls] {");
  });

  it("opens the sidebar's own thread menu and settles through its own path", () => {
    expect(sidebar).toContain(
      "useEffect(() => registerSidebarThreadMenu(handleThreadContextMenu), [handleThreadContextMenu]);",
    );
    expect(strip).toContain("openSidebarThreadMenu(threadRef, position)");
    expect(strip).toContain("settleAndAdvance(threadRef)");
    expect(sidebar).toContain("if (!isMobile) setSidebarOpen(true);");
  });

  it("dresses the selected tab and project in the selected card's glass", () => {
    const start = glassSurfaces.indexOf("fork:begin fork-collapsed-thread-tabs");
    const block = glassSurfaces.slice(
      start,
      glassSurfaces.indexOf("fork:end fork-collapsed-thread-tabs"),
    );
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('[data-fork-thread-tab][data-active="true"]');
    expect(block).toContain("[data-fork-segmented-tab][data-pressed]");
    for (const token of [
      "--fork-glass-selected-shadow",
      "--fork-glass-selected-glint",
      "--fork-glass-dark-edge",
    ]) {
      expect(block).toContain(`var(${token})`);
    }
  });
});
