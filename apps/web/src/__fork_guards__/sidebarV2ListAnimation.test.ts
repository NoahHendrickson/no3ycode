// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and
 * `.fork/customizations.yaml#sidebar-v2-list-animation`.
 *
 * The motion's behaviour is tested beside it
 * (`custom/sidebarV2ListAnimation.browser.test.tsx`). This file guards the seam
 * inside `Sidebar.tsx`: that the list mounts the fork's motion and stops it on
 * unmount, and that AutoAnimate, which polled every row's position, stays out.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const sidebar = readSibling("../components/Sidebar.tsx");
const animation = readSibling("../custom/sidebarV2ListAnimation.ts");

describe("fork guard: sidebar-v2-list-animation", () => {
  it("mounts the list motion on the thread list and stops it on unmount", () => {
    expect(sidebar).toContain(
      'import { attachSidebarV2ListMotion } from "~/custom/sidebarV2ListAnimation"',
    );
    expect(sidebar).toContain("const stopListMotion = attachSidebarV2ListMotion(node);");
    expect(sidebar).toContain("stopListMotion();");
    expect(sidebar).toContain("ref={attachListAutoAnimateRef}");
    expect(sidebar).not.toContain("@formkit/auto-animate");
    expect(animation).not.toContain('from "@formkit/auto-animate"');
  });

  it("keeps add as the reverse of remove", () => {
    expect(animation).toContain("SIDEBAR_V2_LIST_REMOVE_KEYFRAMES");
    expect(animation).toContain("SIDEBAR_V2_LIST_ADD_KEYFRAMES");
    expect(animation).toContain('transform: "scale(.98)", opacity: 0');
    expect(animation).toContain('transform: "scale(1)", opacity: 1');
    expect(animation).toContain("prefers-reduced-motion: reduce");
    // No removal is singled out. The card a collapsed group keeps for the
    // open route used to leave instantly because it left in the navigation
    // frame; the keep now reads a deferred route key so it leaves a frame
    // later and takes the same fade as every other row.
    expect(animation).not.toContain("data-fork-collapsed-keep");
    expect(animation).not.toMatch(/duration: \w+ \? 0 : duration/u);
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
