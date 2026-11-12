// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#sidebar-v2-list-animation`. Behaviour is tested
    in custom/sidebarV2ListAnimation.browser.test.tsx; this pins the seams: the list runs upstream's
    engine with the fork's fades, updated after every commit and held through a project drag. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const sidebar = readSibling("../components/Sidebar.tsx");
const engine = readSibling("../components/Sidebar.motion.ts");
const animation = readSibling("../custom/sidebarV2ListAnimation.ts");

describe("fork guard: sidebar-v2-list-animation", () => {
  it("runs upstream's engine on the thread list, updated after every commit", () => {
    expect(sidebar).toContain(
      'import { createSidebarV2ListMotion } from "~/custom/sidebarV2ListAnimation"',
    );
    expect(sidebar).toContain("const motion = createSidebarV2ListMotion(node);");
    expect(sidebar).toContain("motion.dispose();");
    expect(sidebar).toContain("ref={attachThreadListRef}");
    expect(sidebar).toMatch(
      /useLayoutEffect\(\(\) => \{\s*listMotionRef\.current\?\.update\(!projectDragActive\);\s*\}\);/u,
    );
    // The leaving rows' stand-ins are placed against the list.
    expect(sidebar).toContain('"relative flex flex-col",');
    expect(animation).toContain("createSidebarListMotion(list, fadeStyle)");
    expect(sidebar).not.toContain("@formkit/auto-animate");
  });

  it("holds the motion through a project header drag and slides the drop from the pointer", () => {
    expect(sidebar).toMatch(
      /onDragStart=\{\(\) => \{\s*listMotionRef\.current\?\.suspend\(\);\s*setProjectDragActive\(true\);/u,
    );
    expect(sidebar).toMatch(
      /onDragCancel=\{\(\) => \{\s*listMotionRef\.current\?\.release\(\);\s*setProjectDragActive\(false\);/u,
    );
    expect(sidebar).toMatch(
      /handleProjectDragEnd = useCallback\(\s*\(event: DragEndEvent\) => \{[\s\S]{0,200}listMotionRef\.current\?\.release\(\);\s*setProjectDragActive\(false\);/u,
    );
  });

  it("keeps add as the reverse of remove, faded in place, on screen only, uncapped", () => {
    expect(animation).toContain('{ shown: "scale(1)", hidden: "scale(.98)" }');
    expect(animation).toContain("maxFadedRows: Number.POSITIVE_INFINITY");
    expect(animation).toContain("list.closest('[data-slot=\"scroll-area-viewport\"]')");
    // The engine's seam: one pose for both directions, no travel, and the fork's filter and cap.
    expect(engine).toContain("fadeStyle: SidebarListFadeStyle | null = null,");
    expect(engine).toContain("{ opacity: entryProgress, transform: pose(travel, true) },");
    expect(engine).toContain("{ opacity: 0, transform: pose(travel, false) },");
    expect(engine).toContain("{ opacity: 1, transform: pose(travel, true) },");
    expect(engine).toContain("fadeCount <= maxFadedRows;");
    expect(engine).toContain(
      "const fadeTravel = (travel: number) => (fadeStyle === null ? travel : 0);",
    );
    expect(engine).toContain("(prefers-reduced-motion: reduce)");
  });

  it("lets a collapsed group's kept card leave after the navigation frame", () => {
    // Opening another thread is the frame the new chat view mounts. A kept
    // card removed in that frame fades late and the rows below slide up
    // unevenly; deferring the key the keep reads moves the removal into the
    // quiet re-render after it. The highlight stays on the live key. The key is
    // the row's (a subagent's parent card stays lit, upstream's subagent port).
    expect(sidebar).toContain("const keptRouteThreadKey = useDeferredValue(routeRowThreadKey);");
    const keep = /threadsVisibleInProjectSection\(\{([\s\S]*?)\}\)/u.exec(sidebar)?.[1];
    expect(keep).toBeDefined();
    expect(keep).toContain("keptRouteThreadKey");
    expect(keep).not.toMatch(/\brouteRowThreadKey\b|\brouteThreadKey\b/u);
    expect(sidebar).toContain("isActive={routeRowThreadKey === threadKey}");
  });
});
