import { describe, expect, it } from "vite-plus/test";

import { flatGlassPalette } from "./flatGlassTheme";
import { no3yPullRequestColor, no3yPullRequestTone } from "./no3yPullRequestTone";

describe("no3y pull request tone", () => {
  it("tells open, merged, closed and draft apart, as the Mac does", () => {
    expect(no3yPullRequestTone({ state: "open", isDraft: false })).toBe("open");
    expect(no3yPullRequestTone({ state: "open", isDraft: true })).toBe("draft");
    expect(no3yPullRequestTone({ state: "merged", isDraft: false })).toBe("merged");
    expect(no3yPullRequestTone({ state: "closed", isDraft: false })).toBe("closed");
    // Before its state arrives a pull request reads as open.
    expect(no3yPullRequestTone({ state: null, isDraft: false })).toBe("open");
  });

  it("gives each state its own colour on both appearances", () => {
    for (const appearance of ["dark", "light"] as const) {
      const palette = flatGlassPalette(appearance);
      const colors = (["open", "merged", "closed", "draft"] as const).map((tone) =>
        no3yPullRequestColor(tone, palette),
      );
      expect(new Set(colors).size).toBe(4);
    }
    expect(no3yPullRequestColor("merged", flatGlassPalette("dark"))).toBe(
      "rgba(196, 180, 255, 0.9)",
    );
  });
});
