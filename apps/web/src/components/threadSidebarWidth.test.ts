import { describe, expect, it } from "vite-plus/test";

import {
  clampThreadSidebarWidth,
  resolveInitialThreadSidebarWidth,
  resolveThreadSidebarMaximumWidth,
  resolveThreadSidebarMinimumWidth,
} from "./threadSidebarWidth";

function renderedWidth(sidebarWidth: number, viewportWidth: number): number {
  const minimumWidth = resolveThreadSidebarMinimumWidth(0);
  return clampThreadSidebarWidth(
    sidebarWidth,
    minimumWidth,
    resolveThreadSidebarMaximumWidth(viewportWidth, minimumWidth),
  );
}

describe("thread sidebar width", () => {
  it("restores the stored width when the viewport widens after a narrow startup", () => {
    const sidebarWidth = resolveInitialThreadSidebarWidth(350);
    /* fork:begin narrow-workspace-layout — see .fork/customizations.yaml#narrow-workspace-layout */
    // The fork reserves 400px for the chat column, not 640px, so narrow is 600px here.
    expect(renderedWidth(sidebarWidth, 600)).toBe(208);
    /* fork:end narrow-workspace-layout */
    expect(renderedWidth(sidebarWidth, 1638)).toBe(350);
  });

  it("restores the default width when the viewport widens after a narrow startup", () => {
    const sidebarWidth = resolveInitialThreadSidebarWidth(null);
    /* fork:begin narrow-workspace-layout — see .fork/customizations.yaml#narrow-workspace-layout */
    // The fork reserves 400px for the chat column, not 640px, so narrow is 600px here.
    expect(renderedWidth(sidebarWidth, 600)).toBe(208);
    /* fork:end narrow-workspace-layout */
    expect(renderedWidth(sidebarWidth, 1638)).toBe(256);
  });
});
