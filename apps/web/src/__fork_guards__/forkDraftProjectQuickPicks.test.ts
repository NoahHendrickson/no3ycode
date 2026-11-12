// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-draft-project-quick-picks`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

const choices = read("../custom/useDraftProjectChoices.ts");
const quickPicks = read("../custom/DraftProjectQuickPicks.tsx");

describe("fork guard: fork-draft-project-quick-picks", () => {
  it("ranks the pills through the sidebar's own project order", () => {
    expect(choices).toContain("const QUICK_PICK_LIMIT = 5;");
    expect(choices).toContain("rankRecentProjectEntries(entries, threads, QUICK_PICK_LIMIT)");
    const logic = read("../components/Sidebar.logic.ts");
    const helperAt = logic.indexOf("export function rankRecentProjectEntries<");
    const helper = logic.slice(helperAt, logic.indexOf("fork:end", helperAt));
    expect(helper).toContain("filterSidebarV2VisibleThreads(threads, null, new Set())");
    expect(helper).toContain("sortLogicalProjectsForSidebar(");
  });

  it("assigns a picked pill through the menu's own dispatcher", () => {
    expect(quickPicks).toContain('data-fork-project-quick-pick=""');
    expect(quickPicks).toContain("onPick={choices.pick}");
    expect(quickPicks).toContain("<DraftProjectMenuPopup choices={choices} />");
    expect(choices).toMatch(/const pick = \(next: string, pill\?: Element\) => \{/u);
    expect(choices).toMatch(/void assignDraftProject\(draftId, entry\)\.catch\(/u);
  });

  it("opens a picked pill into the project chip from where it was", () => {
    // The pick records the pill and every chip that mounts plays it, so the
    // slide survives ChatView swapping the fallback strip for BranchToolbar.
    expect(choices).toContain("if (pill) rememberDraftProjectPick(draftId, pill);");
    expect(read("../custom/DraftProjectPill.tsx")).toContain(
      "playDraftProjectPick(props.draftId, chipRef.current);",
    );
    const motion = read("../custom/draftProjectPickMotion.ts");
    expect(motion).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
  });

  it("fades in the chips a pick brings in from the row that renders them", () => {
    const toolbar = read("../components/BranchToolbar.tsx");
    expect(toolbar).toContain("const chipsJoining = useDraftProjectChipsJoining(draftId ?? null);");
    expect(toolbar).toContain('data-fork-chips-joining={chipsJoining ? "" : undefined}');
    const theme = read("../theme.custom.css");
    expect(theme).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{[^@]*\[data-fork-chips-joining\][^{]*:not\(\s*\[data-fork-draft-project-chip\][^{]*\{\s*animation: fork-context-chip-join/u,
    );
  });

  it("stands the pills' tooltips off through the wrapper, in Black's ink", () => {
    expect(quickPicks).toMatch(/<TooltipPopup side="top" forkNubGap=\{4\}/u);
    expect(read("../components/ui/tooltip.tsx")).toContain("FORK_TOOLTIP_NUB_DEPTH + forkNubGap");
    expect(read("../theme.custom.inlet.css")).not.toContain("data-fork-project-quick-pick-tip");
    expect(read("../theme.custom.inlet-black.css")).toMatch(
      /\[data-slot="tooltip-popup"\]\[data-fork-project-quick-pick-tip\] \{\s*--fork-inlet-tooltip: #141414;\s*--fork-inlet-tooltip-foreground: #e8e8e8;/u,
    );
  });
});
