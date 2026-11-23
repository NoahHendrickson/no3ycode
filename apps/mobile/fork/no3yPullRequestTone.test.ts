import type { ThreadPullRequestLink } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { presentThreadLinkedPullRequests } from "../src/state/thread-pr-presentation";
import { flatGlassPalette } from "./flatGlassTheme";
import {
  no3yPullRequestColor,
  no3yPullRequestPill,
  no3yPullRequestTone,
} from "./no3yPullRequestTone";

function linkedPr(
  number: number,
  snapshot: Partial<NonNullable<ThreadPullRequestLink["snapshot"]>> = {},
): ThreadPullRequestLink {
  return {
    host: "github.com",
    repository: "t3tools/t3code",
    number,
    url: `https://github.com/t3tools/t3code/pull/${number}`,
    source: "manual",
    linkedAt: "2026-09-08T00:00:00.000Z",
    stack: null,
    snapshot: {
      state: "open",
      title: `Change ${number}`,
      headBranch: `change-${number}`,
      baseBranch: "main",
      isDraft: false,
      updatedAt: null,
      syncedAt: "2026-09-08T00:00:00.000Z",
      ...snapshot,
    },
  };
}

function pill(links: ReadonlyArray<ThreadPullRequestLink>) {
  const pr = presentThreadLinkedPullRequests(links);
  if (pr === null) throw new Error("no presentation");
  return no3yPullRequestPill(pr, links);
}

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

describe("no3y pull request pill", () => {
  it("shows only the state of a single pull request, never its checks", () => {
    expect(pill([linkedPr(240, { checksState: "failing" })])).toEqual({
      tone: "open",
      several: false,
      more: 0,
    });
  });

  it("counts how many more a stack or several linked pull requests hold", () => {
    // A derived stack: each layer's base is the one below it.
    const stack = [
      linkedPr(1),
      linkedPr(2, { baseBranch: "change-1" }),
      linkedPr(3, { baseBranch: "change-2" }),
      linkedPr(4, { baseBranch: "change-3" }),
    ];
    expect(pill(stack)).toMatchObject({ several: true, more: 3 });
    expect(pill([linkedPr(7), linkedPr(8)])).toMatchObject({ several: true, more: 1 });
  });
});
