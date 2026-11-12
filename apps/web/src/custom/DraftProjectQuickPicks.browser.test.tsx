import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import "~/index.css";

import { render } from "../../test/render";
import { DraftProjectQuickPicks } from "./DraftProjectQuickPicks";

const environmentId = EnvironmentId.make("environment-test");

const recentEntries = ["alpha", "beta", "gamma", "delta", "epsilon"].map((name) => ({
  group: { projectKey: `key:${name}`, displayName: name },
  targetProject: {
    environmentId,
    workspaceRoot: `/${name}`,
    title: name,
    faviconPath: null,
    projectIcon: { kind: "emoji" as const, emoji: "🌱" },
  },
}));

describe("DraftProjectQuickPicks", () => {
  it.each([260, 280])("keeps the full project menu reachable in a %ipx composer", async (width) => {
    const container = document.createElement("div");
    container.style.cssText = `display: flex; width: ${width}px; overflow-x: clip;`;
    await using screen = await render(
      <DraftProjectQuickPicks
        choices={{ entries: [], value: "", pick: vi.fn(), noProjectEnvironmentId: environmentId }}
        recentEntries={recentEntries}
      />,
      { container },
    );
    const chevron = screen.getByRole("button", { name: "All projects" }).element();
    const strip = container.getBoundingClientRect();
    const trigger = chevron.getBoundingClientRect();
    expect(trigger.width).toBeGreaterThan(0);
    expect(trigger.right).toBeLessThanOrEqual(strip.right);
  });
});
