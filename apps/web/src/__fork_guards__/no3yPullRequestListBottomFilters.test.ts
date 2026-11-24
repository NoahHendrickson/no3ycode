// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#no3y-pr-list-bottom-filters` and
 * `#no3y-pr-project-multiselect`.
 *
 * Pins the iPhone Pull requests list's bottom-tray filters and glass cards, and the project
 * filter's multi-select, which an upstream sync could silently revert.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");
const screen = read("../../../mobile/src/features/pull-requests/PullRequestsScreen.tsx");
const filters = read("../../../mobile/src/features/pull-requests/PullRequestListFilters.tsx");
const list = read("../../../mobile/src/features/pull-requests/pullRequestList.ts");

describe("no3y-pr-list-bottom-filters", () => {
  it("moves the filters from the list header to the bottom tray on the iPhone layout", () => {
    expect(screen).toMatch(/\{no3y \? null : \(\s*<PullRequestListFilters/u);
    expect(screen).toMatch(
      /<No3yBottomTray color=\{palette\.stageBackground\}>\s*<No3yPullRequestFilterBar/u,
    );
  });

  it("draws the rows as glass cards on the iPhone layout", () => {
    expect(screen).toContain("renderItem={no3y ? renderNo3yPullRequest : renderPullRequest}");
  });
});

describe("no3y-pr-project-multiselect", () => {
  it("toggles projects in a menu that stays open", () => {
    expect(filters).toContain("toggledPullRequestProject(projectSelection");
    expect(filters).toContain("attributes: { keepsMenuPresented: true }");
  });

  it("asks each environment for its own selected projects", () => {
    expect(list).toContain("pullRequestProjectIdsFor(pullRequestProjectSelection(controls)");
    expect(screen).toContain("pullRequestListInput(controls, query, environment.environmentId)");
  });
});
