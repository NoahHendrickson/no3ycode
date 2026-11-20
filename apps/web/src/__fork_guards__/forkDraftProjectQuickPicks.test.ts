// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-draft-project-quick-picks`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

const choices = read("../custom/useDraftProjectChoices.ts");
const launchpad = read("../custom/DraftLaunchpad.tsx");

describe("fork guard: fork-draft-project-quick-picks", () => {
  it("ranks the launchpad's projects through the sidebar's own project order", () => {
    expect(choices).toContain("export const QUICK_PICK_LIMIT = 4;");
    expect(choices).toContain("rankRecentProjectEntries(entries, threads, QUICK_PICK_LIMIT)");
    const logic = read("../components/Sidebar.logic.ts");
    const helperAt = logic.indexOf("export function rankRecentProjectEntries<");
    const helper = logic.slice(helperAt, logic.indexOf("fork:end", helperAt));
    expect(helper).toContain("filterSidebarV2VisibleThreads(threads, null, new Set())");
    expect(helper).toContain("sortLogicalProjectsForSidebar(");
  });

  it("picks the unassigned draft's project from the list under the composer", () => {
    expect(read("../custom/DraftProjectPill.tsx")).toContain(
      'if (choices.selection.kind === "unassigned" && !shortWindow) return null;',
    );
    // A short window has no room under its bottom-pinned composer.
    expect(launchpad).toMatch(/const shown =\s*draftId !== null &&\s*!shortWindow &&/u);
    expect(launchpad).toContain("if (!shown || draftId === null) return null;");
    expect(read("../components/ChatView.tsx")).toMatch(
      /isDraftHeroState &&\s*\(composerBannerItems\.length > 0 \|\| isLocalDraftThread\)[\s\S]{0,1600}<DraftLaunchpad/u,
    );
    expect(launchpad).toContain("choices.pick(entry.group.projectKey, event.currentTarget)");
    expect(choices).toMatch(/const pick = \(next: string, pill\?: Element\) => \{/u);
    expect(choices).toMatch(/void assignDraftProject\(draftId, entry\)\.catch\(/u);
  });

  it("opens a picked row into the project chip from where it was", () => {
    // The pick records the row and every chip that mounts plays it, so the
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

  it("offers new work that fills the composer and never opens another thread", () => {
    expect(launchpad).toContain("const suggestions = deriveLaunchpadSuggestions({");
    // Added after anything the user already wrote, never in place of it.
    expect(launchpad).toMatch(
      /written\.trim\(\)\.length > 0\s*\? `\$\{written\}\\n\\n\$\{suggestion\.prompt\}`/u,
    );
    expect(launchpad).not.toMatch(/navigate|useNavigate|router/u);
    expect(read("../custom/draftLaunchpadSuggestions.ts")).toContain(
      "export function deriveLaunchpadSuggestions(",
    );
  });
});
