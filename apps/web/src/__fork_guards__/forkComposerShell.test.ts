// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-composer-shell`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import {
  COMPOSER_FOOTER_COMPACT_BREAKPOINT_PX,
  COMPOSER_FOOTER_WIDE_ACTIONS_COMPACT_BREAKPOINT_PX,
  shouldUseCompactComposerFooter,
} from "../overrides/components/composerFooterLayout";
import {
  COMPOSER_MODEL_SLOT_COMPACT_BREAKPOINT_PX,
  COMPOSER_MODEL_SLOT_WIDE_ACTIONS_COMPACT_BREAKPOINT_PX,
  shouldUseCompactComposerModelSlot,
} from "../custom/composerModelSlotCompact";
import {
  ComposerPromptRow,
  ComposerShell,
  resolveComposerShellVisibility,
} from "../custom/ComposerShell";
import { FORK_MARKER_ATTRIBUTE, FORK_MARKER_VALUE } from "../custom/forkMarker";
import { resolveThreadContextBranch } from "../custom/ThreadContextReadout";
import { cssRules, ruleBodyFor } from "./cssRules";

/** Form ceiling from ChatComposer's `max-w-3xl` — keep compact thresholds below it. */
const COMPOSER_FORM_MAX_WIDTH_PX = 768;

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const MARKER = `:root[${FORK_MARKER_ATTRIBUTE}="${FORK_MARKER_VALUE}"]`;
const theme = readSibling("../theme.custom.css");
const shellCss = readSibling("../custom/ComposerShell.css");
const palettes = `${readSibling("../theme.custom.palettes.css")}\n${readSibling("../theme.custom.basic.css")}`;
const styles = `${theme}\n${shellCss}`;
const rules = cssRules(styles);
const paletteRules = cssRules(palettes);
const chatComposer = readSibling("../components/chat/ChatComposer.tsx");
const chatView = readSibling("../components/ChatView.tsx");
const primaryActions = readSibling("../components/chat/ComposerPrimaryActions.tsx");
// Upstream moved the queued and draft attachment tiles out of ChatComposer.
const attachmentStrip = readSibling("../components/chat/ComposerAttachmentStrip.tsx");
const stageBackdrop = readSibling("../components/SidebarStageBackdrop.tsx");

function shellMarkup(input: { approvalPending?: boolean; collapsedMobile?: boolean } = {}) {
  return renderToStaticMarkup(
    createElement(
      ComposerShell,
      {
        approvalPending: input.approvalPending ?? false,
        collapsedMobile: input.collapsedMobile ?? false,
        context: createElement("span", { "data-test-context": true }),
        mobilePendingActionsVisible: false,
        modeControls: createElement("button", { "data-test-mode": true }),
        modelControls: createElement("button", { "data-test-model": true }),
        readoutControls: createElement("span", { "data-test-readout": true }),
      },
      createElement("div", { "data-test-surface": true }),
    ),
  );
}

function promptMarkup(input: { approvalPending?: boolean; mobilePendingActionsVisible?: boolean }) {
  return renderToStaticMarkup(
    createElement(
      ComposerPromptRow,
      {
        action: createElement("button", { "data-test-primary-action": true }),
        approvalPending: input.approvalPending ?? false,
        mobilePendingActionsVisible: input.mobilePendingActionsVisible ?? false,
      },
      createElement("div", { "data-test-editor": true }),
    ),
  );
}

/** Index of the `</div>` that balances the div whose opening tag contains `openIndex`. */
function balancedDivClose(markup: string, openIndex: number): number {
  const tags = /<div\b|<\/div>/gu;
  tags.lastIndex = markup.lastIndexOf("<div", openIndex);
  let depth = 0;
  for (let match = tags.exec(markup); match !== null; match = tags.exec(markup)) {
    depth += match[0] === "</div>" ? -1 : 1;
    if (depth === 0) return match.index;
  }
  return -1;
}

describe("fork guard: fork-composer-shell", () => {
  it("refuses upstream's resting composer layout through the shadow", async () => {
    // The composerFooterLayout shadow re-exports upstream and owns only this
    // verdict; a sync that lets the predicate through brings the desktop
    // collapse-at-rest layout back.
    const shadow = await import("../overrides/components/composerFooterLayout");
    expect(shadow.FORK_ADOPTS_RESTING_COMPOSER_LAYOUT).toBe(false);
    expect(
      shadow.shouldUseRestingComposerLayout({
        isExistingThread: true,
        isMobileViewport: false,
        isScrollCollapsed: true,
        hasExpandedChrome: false,
        hasMultilinePrompt: false,
        timelineOverflows: true,
      }),
    ).toBe(false);
  });
  it("wraps surface and controls inside the vessel, with context bottom-left", () => {
    const markup = shellMarkup();
    const context = markup.indexOf("data-test-context");
    const vessel = markup.indexOf('data-fork-composer-vessel="true"');
    const surface = markup.indexOf("data-test-surface");
    const controls = markup.indexOf("data-fork-composer-control-row");

    expect(vessel).toBeGreaterThanOrEqual(0);
    expect(vessel).toBeLessThan(surface);
    expect(surface).toBeLessThan(controls);
    expect(controls).toBeGreaterThanOrEqual(0);
    expect(context).toBeGreaterThan(controls);

    // Containment, not just ordering: the surface and the whole control row
    // (open through balanced close) must fall inside the vessel's own close.
    // An indexOf("</div>") from the control row would only find the left
    // slot's close and pass with the controls re-orphaned outside the vessel.
    const vesselClose = balancedDivClose(markup, vessel);
    const controlsClose = balancedDivClose(markup, controls);
    expect(vesselClose).toBeGreaterThan(-1);
    expect(controlsClose).toBeGreaterThan(-1);
    expect(surface).toBeLessThan(vesselClose);
    expect(context).toBeLessThan(controlsClose);
    expect(controlsClose).toBeLessThan(vesselClose);
  });

  it("keeps the vessel paint off the collapsed mobile pill", () => {
    // The collapsed tap target rounds to 12px over the vessel's 8px corners;
    // an unconditional vessel would expose background wedges behind the pill
    // and slab any live readout row onto it.
    const markup = shellMarkup({ collapsedMobile: true });
    expect(markup).not.toContain('data-fork-composer-vessel="true"');
    expect(shellMarkup()).toContain('data-fork-composer-vessel="true"');
  });

  it("gates every interactive control during approvals but keeps readouts", () => {
    expect(
      resolveComposerShellVisibility({
        approvalPending: true,
        collapsedMobile: false,
        mobilePendingActionsVisible: false,
      }),
    ).toEqual({ showInlinePrimaryAction: false, showInteractiveControls: false });

    const markup = shellMarkup({ approvalPending: true });
    expect(markup).not.toContain("data-test-mode");
    expect(markup).not.toContain("data-test-model");
    expect(markup).toContain("data-test-readout");
  });

  it("hides model, mode, and context controls under the collapsed mobile composer", () => {
    const markup = shellMarkup({ collapsedMobile: true });
    expect(markup).not.toContain("data-test-mode");
    expect(markup).not.toContain("data-test-model");
    expect(markup).not.toContain("data-test-context");
    expect(markup).toContain("data-test-readout");
  });

  it("hides model and mode controls behind the mobile pending-answer cluster", () => {
    // Upstream's footer goes `hidden sm:flex` here; the editor's bottom band is
    // reserved for the absolute prev/advance actions.
    expect(
      resolveComposerShellVisibility({
        approvalPending: false,
        collapsedMobile: false,
        mobilePendingActionsVisible: true,
      }),
    ).toEqual({ showInlinePrimaryAction: false, showInteractiveControls: false });
  });

  it("keeps collapsed-mobile controls on upstream theme-role tokens", () => {
    // One placeholder carrier: the collapsed prompt row. Upstream #20391 keeps
    // the composer expanded while a question is pending, which deleted the
    // collapsed-mobile "Write custom answer" row that was the second.
    expect([...chatComposer.matchAll(/text-placeholder/gu)]).toHaveLength(1);
    expect(chatComposer).toContain('prompt.trim() ? "text-foreground" : "text-placeholder",');
    expect(chatComposer).not.toContain("text-muted-foreground/60");
    expect(chatComposer).not.toContain("text-muted-foreground/35");
    expect(chatComposer).toContain(
      "bg-message-action text-message-action-foreground hover:bg-message-action-hover",
    );
    expect(chatComposer).not.toContain("bg-primary/90 text-primary-foreground");
    expect(attachmentStrip).toContain(
      "items-center justify-center px-1 text-center text-3xs text-secondary-label",
    );
    expect(attachmentStrip).not.toContain("text-muted-foreground/60");
    expect(attachmentStrip).not.toContain("text-muted-foreground/35");
  });

  it("fences the compact Nightly artwork seam used by the send button", () => {
    expect(stageBackdrop).toContain("<NightlySkyArt compact />");
    expect(stageBackdrop).toMatch(
      /fork:begin fork-composer-shell[^\n]*\nfunction NightlySkyArt\(\{ compact = false \}: \{ compact\?: boolean \}\) \{\n\s*\/\* fork:end fork-composer-shell/u,
    );
    expect(stageBackdrop).toMatch(
      /fork:begin fork-composer-shell[^\n]*\n\s*viewBox=\{compact \? "96 0 8192 96" : STAGE_BACKDROP_VIEW_BOX\}\n\s*\/\* fork:end fork-composer-shell/u,
    );
  });

  it("renders only one primary-action cluster for a mobile pending answer", () => {
    expect(promptMarkup({})).toContain("data-test-primary-action");
    expect(promptMarkup({ mobilePendingActionsVisible: true })).not.toContain(
      "data-test-primary-action",
    );
    expect(promptMarkup({ approvalPending: true })).not.toContain("data-test-primary-action");
  });

  it("anchors the inline primary action to the bottom of the prompt row", () => {
    const markup = promptMarkup({});
    expect(markup).toContain("items-end");
    expect(markup).toContain("self-end");
    expect(markup).not.toContain("self-start");
  });

  it("keeps one base shell without the removed density machinery", () => {
    expect(chatComposer).not.toContain("composerDensity");
    expect(chatComposer).not.toContain("data-fork-composer-density");
    expect(chatComposer).not.toContain("useComposerPromptWrapLatch");
    expect(styles).not.toContain("data-fork-composer-density");

    const collapsed = rules.find((rule) =>
      rule.selector.includes('[data-chat-composer-mobile-collapsed="true"]'),
    );
    expect(collapsed?.selector).toContain("[data-fork-composer-surface]");
    expect(collapsed?.body).toMatch(/border-radius:\s*12px/u);
  });

  it("centers the draft composer and docks it once the thread starts", () => {
    // One docked className in ChatView; the draft state is the data-draft-hero
    // stamp, and theme.custom.css moves the overlay to the centre line off it
    // (fork-new-agent-draft), so the layout mode has a single owner.
    expect(chatView).toContain(
      'className="pointer-events-none absolute inset-x-0 bottom-0 z-20 pt-1.5 sm:pt-2"',
    );
    expect(chatView).toContain("data-draft-hero={isDraftHeroState || undefined}");
    expect(chatView).not.toMatch(/isDraftHeroState\s*\?\s*"pointer-events-none absolute/u);
    expect(chatView).not.toContain("isDraftHero={isDraftHeroState}");
    // The greeting rides bottom-full above the composer inside the stack, so
    // the composer itself sits on the centre line; no separate greeting layer.
    expect(chatView).toMatch(/bottom-full[\s\S]{0,2400}<DraftHeroHeadline/u);
    expect(chatView).not.toContain(
      'className="pointer-events-none absolute inset-0 z-10 flex items-center"',
    );
    expect(chatView).toContain("<ComposerSurface.Shell");
  });

  it("keeps the context strip mounted when the thread's worktree is gone", () => {
    // A deleted worktree answers "not a repo" for its own cwd rather than
    // failing, so gating on that alone unmounted the strip and stranded the
    // thread there. A worktree path in play must keep the strip rendered.
    // Upstream gates it off inside a side chat pane (`embedded`).
    expect(chatView).toMatch(
      /showComposerContextStrip\s*=\s*!embedded &&\s*shouldShowComposerContextStrip/u,
    );
    expect(chatView).toMatch(/hasActiveProject:\s*activeProject !== null/u);
    expect(chatView).toMatch(/isGitRepo:\s*isGitRepo \|\| activeThreadWorktreePath !== null/u);
  });

  it("shows a server thread's project and branch read-only once the strip retreats", () => {
    // While upstream's strip is hidden, the fallback strip must still lead
    // with the pinned project and branch chips.
    expect(chatView).toMatch(/isServerThread &&\s*activeProject &&\s*!showComposerContextStrip/u);
    // One leading value feeds every site: the BranchToolbar spread, the
    // fallback strip and the Shell's contextRow predicate. (Upstream's hidden
    // measuring strip, and the second fallback beside it, went in #25869.)
    expect(chatView).toContain(
      "const composerContextLeading = draftProjectPill ?? threadContextReadout;",
    );
    expect(chatView.match(/leading: composerContextLeading\b/gu)).toHaveLength(2);
    expect(chatView).toContain("composerContextLeading != null");
    // A worktree thread keeps its saved branch when the directory is gone
    // (git status then reports no repo), as the strip's own predicates do.
    const branch = {
      envMode: "worktree" as const,
      activeThreadBranch: "feature/x",
      currentGitBranch: null,
    };
    expect(
      resolveThreadContextBranch({ ...branch, isGitRepo: false, activeWorktreePath: "/gone" }),
    ).toBe("feature/x");
    expect(
      resolveThreadContextBranch({ ...branch, isGitRepo: false, activeWorktreePath: null }),
    ).toBeNull();
  });

  it("keeps composer styling scoped to the fork marker", () => {
    const composerRules = rules.filter(
      (rule) =>
        rule.selector.includes("[data-fork-composer") ||
        rule.selector.includes("data-chat-composer-overlay") ||
        rule.selector.includes('[data-slot="composer-'),
    );
    expect(composerRules.length).toBeGreaterThan(0);
    for (const rule of composerRules) {
      expect(rule.selector, `unscoped composer rule: ${rule.selector}`).toContain(MARKER);
    }
  });

  it("paints the surface by name and restores drag-over feedback", () => {
    expect(chatComposer).toContain('data-fork-composer-surface="true"');
    expect(chatComposer).toContain("data-fork-composer-drag-over=");
    expect(
      rules.filter((rule) => /\[data-fork-composer-box\]\s*>\s*div/u.test(rule.selector)),
    ).toHaveLength(0);

    const surface = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-surface]") && rule.body.includes("box-shadow"),
    );
    expect(surface?.body).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--fork-composer-border\)/u);
    const drag = rules.find((rule) => rule.selector.includes("[data-fork-composer-drag-over]"));
    expect(drag?.body).toMatch(/background:/u);
    expect(drag?.body).toMatch(/outline:\s*2px solid/u);

    // Upstream glasses the frame (backdrop-filter, shadow, ::after ring) for
    // every attached banner, not only the Questions drawer; the surface's own
    // hairline is the only ring, so the frame sheds all of it unconditionally.
    const frame = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-box]") &&
        !rule.selector.includes(":has(") &&
        rule.body.includes("backdrop-filter"),
    );
    expect(frame?.selector).not.toContain(".dark");
    expect(frame?.body).toMatch(/backdrop-filter:\s*none/u);
    expect(frame?.body).toMatch(/box-shadow:\s*none/u);
    const frameOutline = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-box]::after") &&
        !rule.selector.includes(":has("),
    );
    expect(frameOutline?.body).toMatch(/display:\s*none/u);
  });

  it("moves the desktop scrollport to the prompt wrapper and clips its placeholder", () => {
    const isDesktop = (rule: (typeof rules)[number]) =>
      rule.atRules.some((atRule) => /@media\s*\(\s*width\s*>=\s*40rem\s*\)/u.test(atRule));
    const scrollport = rules.find(
      (rule) =>
        isDesktop(rule) &&
        rule.selector.includes("[data-fork-composer-prompt]") &&
        !rule.selector.includes('[data-testid="composer-editor"]'),
    );
    // The cap holds 12.5rem of prompt over whatever block padding the prompt wears.
    expect(theme).toMatch(
      /--fork-composer-prompt-cap:\s*calc\(12\.5rem \+ 2 \* var\(--fork-composer-prompt-pad-block, 4px\)\)/u,
    );
    expect(scrollport?.body).toMatch(/max-height:\s*var\(--fork-composer-prompt-cap\)/u);
    expect(scrollport?.body).toMatch(/overflow-y:\s*auto/u);

    const editor = rules.find(
      (rule) =>
        isDesktop(rule) &&
        rule.selector.includes("[data-fork-composer-prompt]") &&
        rule.selector.includes('[data-testid="composer-editor"]') &&
        !/~\s*div/u.test(rule.selector),
    );
    expect(editor?.body).toMatch(/max-height:\s*none/u);
    expect(editor?.body).toMatch(/overflow-y:\s*hidden/u);

    const placeholder = rules.find(
      (rule) =>
        isDesktop(rule) &&
        /:has\(>\s*\[data-testid="composer-editor"\]\)\s*~\s*div/u.test(rule.selector) &&
        rule.body.includes("overflow"),
    );
    expect(placeholder?.body).toMatch(/overflow:\s*clip/u);
    expect(styles).not.toMatch(/\[data-testid="composer-editor"\]\s*\+\s*div/u);
  });

  it("keeps the prompt type, one-line minimum, and placeholder treatment", () => {
    const editorMin = rules.find(
      (rule) =>
        rule.selector.includes('[data-testid="composer-editor"]') &&
        rule.body.includes("min-height"),
    );
    expect(editorMin?.body).toMatch(/min-height:\s*0/u);
    const promptType = rules.find(
      (rule) =>
        rule.selector.includes('[data-testid="composer-editor"]') &&
        rule.body.includes("font-size"),
    );
    expect(promptType?.body).toMatch(/font-size:\s*var\(--font-size-prompt, 1rem\)/u);
    expect(promptType?.body).toMatch(/line-height:\s*var\(--fork-composer-prompt-line\)/u);
    expect(theme).toMatch(
      /--fork-composer-prompt-line:\s*calc\(var\(--font-size-prompt, 1rem\) \* 1\.5\)/u,
    );
    const placeholderColor = rules.find(
      (rule) =>
        /:has\(>\s*\[data-testid="composer-editor"\]\)\s*~\s*div/u.test(rule.selector) &&
        rule.body.includes("color"),
    );
    expect(placeholderColor?.body).toMatch(/color:\s*var\(--muted-foreground\)/u);
  });

  it("keeps ghost geometry on the single control-row owner", () => {
    const geometry = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-control-row]") &&
        rule.body.includes("height: 26px"),
    );
    expect(geometry?.selector).not.toContain("data-fork-composer-status");
    expect(geometry?.selector).not.toContain("data-fork-composer-action");
    expect(geometry?.body).toMatch(/border-radius:\s*6px/u);
    expect(geometry?.body).toMatch(/font-size:\s*14px/u);
    expect(geometry?.body).toMatch(/padding-inline:\s*8px/u);
  });

  it("paints the outer vessel that floors the control row", () => {
    const vessel = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-vessel]") && rule.body.includes("background"),
    );
    expect(vessel?.body).toMatch(/border-radius:\s*var\(--fork-composer-radius\)/u);
    expect(vessel?.body).toMatch(/background:\s*var\(--fork-composer-vessel-bg\)/u);
    // Dark-only: the designs are dark-only and a light fork build keeps
    // upstream's unpainted flow.
    expect(vessel?.selector).toContain(".dark");
    expect(styles).toMatch(/--fork-composer-vessel-bg:/u);
  });

  it("hovers the ghost controls on a faint white wash, not upstream's accent", () => {
    // `--accent` is bit-identical to `--fork-composer-bg` on the Cool palettes,
    // so upstream's ghost hover paints the model / effort trigger the colour the
    // composer already wears. The ghosts get their own token: white 4% in dark
    // (the context chips' raised lift read nearly solid on these text-only
    // controls), falling back to the chip lift in light.
    const hover = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-control-row]") &&
        rule.selector.includes(":hover") &&
        rule.body.includes("background"),
    );
    expect(hover?.body).toMatch(/background:\s*var\(--fork-composer-control-hover\)/u);
    const controlHover = rules.find(
      (rule) =>
        rule.selector.endsWith(".dark") && rule.body.includes("--fork-composer-control-hover:"),
    );
    expect(controlHover?.body).toContain("--fork-composer-control-hover: rgb(255 255 255 / 4%)");
    // Open triggers hold the fill; disabled ones never take it.
    expect(hover?.selector).toContain("[data-popup-open]");
    expect(hover?.selector).toContain(":not(:disabled)");
    // The rule reads a per-palette token, so every palette has to declare one
    // on its stage block or that theme falls back to the default dark lift.
    for (const palette of ["basic", "cool-darker", "inlet"]) {
      const stage = paletteRules.find(
        (rule) =>
          rule.selector.includes(`[data-fork-theme="${palette}"]`) &&
          rule.body.includes("--fork-context-chip-bg-hover:"),
      );
      expect(stage, palette).toBeDefined();
    }
    expect(theme).toMatch(/--fork-context-chip-bg-hover:/u);
  });

  it("renders the mode control in the row's control ink on shared geometry", () => {
    const modeInk = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-mode-controls]") &&
        rule.selector.endsWith("[data-fork-composer-mode-chip]"),
    );
    expect(modeInk?.body).toMatch(
      /color:\s*var\(--fork-composer-control-ink,\s*var\(--color-muted-foreground\)\)/u,
    );
    const sharedGeometry = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-control-row]") &&
        rule.body.includes("height: 26px"),
    );
    expect(sharedGeometry?.selector).not.toContain(":not([data-fork-composer-mode-chip])");
  });

  it("places context options in the bottom-left control slot inside the vessel", () => {
    expect(readSibling("../components/chat/ComposerSurface.tsx")).toContain("data-context-row=");
    expect(readSibling("../custom/ComposerShell.tsx")).toContain(
      'data-fork-composer-vessel-context="true"',
    );
    const compactProject = ruleBodyFor(rules, [
      MARKER,
      "[data-fork-composer-vessel-context]",
      '[data-slot="composer-context-strip"][data-compact] > [data-fork-draft-project-chip]',
    ]);
    expect(compactProject).toMatch(/column-gap:\s*0\s*;/u);
  });

  it("combines workspace and branch into one caret-free split menu in the composer strip", () => {
    const branchToolbar = readSibling("../components/BranchToolbar.tsx");
    const branchSelector = readSibling("../components/BranchToolbarBranchSelector.tsx");
    const footer = readSibling("../custom/ComposerWorkspaceFooter.tsx");
    expect(branchToolbar).toContain("ComposerWorkspaceFooter");
    expect(branchToolbar).toContain('data-composer-shortcut="composer.workspace"');
    expect(branchToolbar).toContain("keepTriggerEnabled={!envModeLocked && !forceNewWorktree}");
    expect(branchSelector).toContain("openWorkspace:");
    expect(branchSelector).not.toContain("ChevronDownIcon");
    expect(footer).toContain("<RadioGroup");
    expect(readSibling("../custom/DraftProjectPill.tsx")).not.toContain("ChevronDownIcon");
  });

  it("keeps floating context chips at 24px for ScheduledTaskEditor", () => {
    const context = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-context-row]") &&
        rule.body.includes("height: 24px"),
    );
    expect(context?.body).toMatch(/border-radius:\s*6px/u);
    expect(context?.body).toMatch(/padding-inline:\s*8px/u);
    const chipPad = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-context-row]") &&
        rule.selector.includes('[data-slot="select-trigger"]') &&
        rule.selector.includes('[data-slot="combobox-trigger"]') &&
        rule.selector.includes("[data-fork-context-chip]"),
    );
    expect(chipPad?.body).toMatch(/padding-inline:\s*8px/u);
    const triggerBefore = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-context-row]") &&
        rule.selector.includes('[data-slot="select-trigger"]::before'),
    );
    expect(triggerBefore?.body).toMatch(/display:\s*none/u);
    const chipInk = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-context-row]") &&
        rule.selector.includes("[data-fork-context-chip]") &&
        rule.body.includes("color:"),
    );
    expect(chipInk?.body).toMatch(/color:\s*#ffffff/u);
    expect(chipInk?.selector).toContain(".dark");
    expect(readSibling("../components/BranchToolbarEnvironmentSelector.tsx")).toContain(
      "data-fork-context-chip",
    );
  });

  it("lets the PR chip keep its state colour", () => {
    // Upstream inks the glyph emerald / violet / red by PR state and grays #N; the chip above the
    // composer fills by that same state and inks the glyph and #N to match.
    const branchSelector = readSibling("../components/BranchToolbarBranchSelector.tsx");
    const prChip = readSibling("../custom/ComposerPullRequestChip.tsx");
    expect(prChip).toContain("data-fork-pr-chip");
    expect(prChip).toContain("data-pr-state={state}");
    expect(prChip).toContain("resolvePullRequestChipState(");
    expect(branchSelector).toContain("data-fork-branch-group");
    expect(shellCss).toMatch(
      /\[data-pr-state="open"\],\s*\[data-pr-state="merged"\],\s*\[data-pr-state="closed"\]/u,
    );
    expect(shellCss).toMatch(/\.fork-pr-tone\s*\{\s*color:\s*var\(--fork-pr-chip-ink\)/u);
    for (const state of ["open", "merged", "closed"]) {
      expect(shellCss.split(`&[data-pr-state="${state}"]`).length - 1).toBe(2);
    }
    expect(
      ruleBodyFor(rules, [
        MARKER,
        ":is([data-fork-pr-chip], [data-fork-sidebar-pr-badge])",
        ".text-secondary-label",
      ]),
    ).toMatch(/color:\s*inherit/u);
    // #N inherits through upstream's tone wrapper; a reshaped badge regrays it.
    expect(readSibling("../components/ThreadStatusIndicators.tsx")).toMatch(
      /presentation\.toneClassName\)\}\s*>\s*<presentation\.Icon[^>]*\/>\s*<span className="text-secondary-label">\{presentation\.text\}<\/span>/u,
    );
    const grow = rules.find(
      (rule) =>
        rule.selector.includes('[data-slot="composer-context-strip"]') &&
        rule.selector.includes("[data-fork-branch-group]"),
    );
    expect(grow?.body).toMatch(/flex:\s*1 1 auto/u);
    expect(grow?.body).toMatch(/justify-content:\s*space-between/u);
  });

  it("hides only separators in the left mode slot", () => {
    const separatorRules = rules.filter(
      (rule) =>
        rule.selector.includes('[data-slot="separator"]') &&
        rule.selector.includes("fork-composer-control-row"),
    );
    expect(separatorRules.length).toBeGreaterThan(0);
    for (const rule of separatorRules) {
      expect(rule.selector).toContain('[data-fork-composer-control-row-slot="left"]');
    }
  });

  it("keeps mode-row ⋯ collapse below the denser fork control-row widths", () => {
    // Upstream is 620/780; those fire with a large empty gap on the fork row.
    // Mode-row only — model-picker compaction stays at upstream 620/780.
    expect(COMPOSER_FOOTER_COMPACT_BREAKPOINT_PX).toBe(400);
    expect(COMPOSER_FOOTER_WIDE_ACTIONS_COMPACT_BREAKPOINT_PX).toBe(520);
    expect(COMPOSER_FOOTER_WIDE_ACTIONS_COMPACT_BREAKPOINT_PX).toBeLessThan(
      COMPOSER_FORM_MAX_WIDTH_PX,
    );
    expect(shouldUseCompactComposerFooter(560)).toBe(false);
    expect(
      shouldUseCompactComposerFooter(560, {
        hasWideActions: true,
      }),
    ).toBe(false);
    // Wide-actions branch: expanded at/above 520, compact below.
    expect(
      shouldUseCompactComposerFooter(519, {
        hasWideActions: true,
      }),
    ).toBe(true);
    expect(
      shouldUseCompactComposerFooter(520, {
        hasWideActions: true,
      }),
    ).toBe(false);
    expect(shouldUseCompactComposerFooter(399)).toBe(true);
    expect(shouldUseCompactComposerFooter(400)).toBe(false);

    // Model trigger stays on upstream widths; ChatComposer must wire both.
    expect(COMPOSER_MODEL_SLOT_COMPACT_BREAKPOINT_PX).toBe(620);
    expect(COMPOSER_MODEL_SLOT_WIDE_ACTIONS_COMPACT_BREAKPOINT_PX).toBe(780);
    expect(shouldUseCompactComposerModelSlot(560)).toBe(true);
    expect(shouldUseCompactComposerModelSlot(620)).toBe(false);
    expect(chatComposer).toContain("shouldUseCompactComposerModelSlot");
    expect(chatComposer).toContain("compact={isComposerModelSlotCompact}");
  });

  it("keeps primary actions out of ghost sizing", () => {
    expect(primaryActions).toContain('data-fork-composer-action="send"');
    expect(primaryActions).toContain('data-fork-composer-action="stop"');
    const action = rules.find(
      (rule) =>
        rule.selector.endsWith("[data-fork-composer-action]") &&
        rule.body.includes("width: var(--fork-composer-action-slot)"),
    );
    expect(action?.body).toMatch(/height:\s*var\(--fork-composer-action-slot\)/u);
    expect(theme).toMatch(/--fork-composer-action-slot:\s*32px/u);
    expect(action?.body).toMatch(/border-radius:\s*8px/u);
    // Stop is a ghost icon button: no fill, no shadow, the control row's ink.
    const stop = rules.find((rule) =>
      rule.selector.endsWith('] [data-fork-composer-action="stop"]'),
    );
    expect(stop?.body).toMatch(/background:\s*transparent/u);
    expect(stop?.body).toMatch(/box-shadow:\s*none/u);
    // Upstream's attach-files button (#8236) mounts in the primary cluster;
    // the fork moves it to the control row. It is stamped by name like send
    // and stop. Never by position: ComposerPrimaryActions hoists a labelled
    // Refine submit into the cluster as a direct child, and a `> button`
    // rule would squash it and steal its hover.
    expect(chatComposer).toContain('data-fork-composer-action="attach"');
    expect(chatComposer).toContain('aria-label="Attach files"');
    // Attach leads the control row's left slot, ahead of the mic and the
    // mode controls (Full access); send trails the prompt alone.
    expect(chatComposer).toMatch(/const composerAttachAction = showComposerAttachAction \? \(/u);
    // The whole moved block is one fence, not just its data attribute: a sync
    // conflict inside it must show the fork's boundary.
    // Since #25869 it shares one fence with the other control-row clusters.
    expect(chatComposer).toMatch(
      /fork:begin fork-composer-shell(?:(?!fork:end fork-composer-shell)[\s\S])*?const composerAttachAction = showComposerAttachAction \? \(/u,
    );
    expect(chatComposer).toMatch(
      /const composerAttachAction = showComposerAttachAction \? \([\s\S]*?\) : null;(?:(?!fork:begin fork-composer-shell)[\s\S])*?\/\* fork:end fork-composer-shell \*\//u,
    );
    expect(chatComposer).toContain("leadingAction={composerAttachAction}");
    expect(theme).toMatch(
      /:is\(\[data-fork-composer-action="attach"\],\s*\[data-fork-composer-action="dictate"\]\)\s*\{[^}]*padding-inline:\s*0/u,
    );
    // The compact row is the base: one line centres on the action slot from the two tokens, and
    // the draft's own box sets its prompt back to 4px.
    const promptLift = rules.find(
      (rule) =>
        rule.selector.includes('[data-chat-composer-overlay="true"]') &&
        !rule.selector.includes("[data-draft-hero]") &&
        rule.selector.endsWith("[data-fork-composer-prompt]") &&
        rule.body.includes("padding-block:"),
    );
    expect(promptLift?.body, "one line centres on the 32px buttons").toMatch(
      /--fork-composer-prompt-pad-block:\s*calc\(\s*\(var\(--fork-composer-action-slot\) - var\(--fork-composer-prompt-line\)\) \/ 2 \+ 4px\s*\)/u,
    );
    expect(theme).not.toMatch(/:not\(\[data-draft-hero\]\)\s*\[data-fork-composer-prompt\]/u);
    expect(chatComposer).not.toMatch(
      /data-chat-composer-actions="right"[\s\S]{0,600}?\{showComposerAttachAction \? \(/u,
    );
    // The glyph is a plus; upstream's paperclip must not come back on a sync.
    expect(chatComposer).toMatch(
      /data-fork-composer-action="attach"[\s\S]{0,400}?<PlusIcon[^>]*\/>/u,
    );
    expect(chatComposer).not.toContain("<PaperclipIcon />");
    // Dark mode paints the send slot's ghost X pure white, not the muted foreground.
    const whiteGhosts = rules.find(
      (rule) =>
        rule.selector.includes(".dark") &&
        rule.selector.includes('[data-fork-composer-action="dictate-cancel"]') &&
        rule.body.includes("--control-icon-color: #ffffff"),
    );
    expect(whiteGhosts, "the dictation X is pure white in dark mode").toBeDefined();
    for (const rule of rules) {
      expect(rule.selector, "actions must be stamped, not selected by position").not.toMatch(
        /data-chat-composer-actions[^{]*>\s*button/u,
      );
    }
    // Its hover is the ghost lift, not --accent: on the Cool palettes --accent
    // is the prompt surface the button sits on, so upstream's hover vanished.
    const cancelHover = rules.find((rule) =>
      rule.selector
        .replace(/\s+/gu, " ")
        .includes('[data-fork-composer-action="dictate-cancel"]:is(:hover, [data-pressed])'),
    );
    expect(cancelHover?.body).toMatch(/background:\s*var\(--fork-composer-control-hover\)/u);
    for (const rule of rules.filter((candidate) => candidate.body.includes("height: 20px"))) {
      expect(rule.selector).not.toMatch(
        /data-chat-composer-(inline-actions|mobile-pending-actions)/u,
      );
    }
  });

  it("floors the docked composer overlay so timeline rows stop above it", () => {
    const floor = rules.find(
      (rule) =>
        rule.selector.includes('[data-chat-composer-overlay="true"]') ||
        rule.selector.includes("[data-chat-composer-overlay='true']"),
    );
    expect(floor?.body).toMatch(
      /background:\s*linear-gradient\(to bottom,\s*transparent,\s*var\(--background\)\s*1\.25rem\)/u,
    );
    // Docked only: a centered draft composer has no transcript to floor.
    expect(floor?.selector).toContain(":not([data-draft-hero])");
  });

  it("switches off the stitched glass shell and flattens the context strip", () => {
    for (const selector of [
      '[data-slot="composer-shell"]::before',
      // Upstream's host paints its own glass when a context row is present.
      '[data-slot="composer-host"]::before',
      '[data-slot="composer-host"]::after',
      '[data-slot="composer-context-strip"]::before',
    ]) {
      const rule = rules.find((candidate) => candidate.selector.includes(selector));
      expect(rule?.body).toMatch(/display:\s*none/u);
    }
    const strip = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-context-row]") &&
        rule.selector.includes('[data-slot="composer-context-strip"]') &&
        !/>\s*(?:\.flex|\*)/u.test(rule.selector),
    );
    // The CSS belt owns the flattened strip geometry — upstream's className
    // (negative margin, inset widths, clearance padding) ships untouched and
    // every reset happens here. Glass alone re-pads the inline edges to clear
    // its chip halo, with a cancelling margin (forkGlassSurfaces pins it).
    expect(strip?.body).toMatch(/margin:\s*0/u);
    expect(strip?.body).toMatch(/padding:\s*0/u);
    expect(strip?.body).toMatch(/width:\s*auto/u);
    expect(strip?.body).toMatch(/max-width:\s*none/u);
    expect(strip?.body).toMatch(/gap:\s*8px/u);
    // Flattening the wrapper must not let the strip shrink-to-fit: upstream's
    // label-collapse heuristic measures the strip's own clientWidth as the
    // space available, so a content-sized strip reads as full once the labels
    // are hidden and never expands the chips back out of icon-only.
    expect(strip?.body).toMatch(/flex:\s*1 1 auto/u);
    expect(strip?.body).toMatch(/min-width:\s*0/u);
    // Nested PR+branch (and env+checkout) wrappers keep upstream gap-1; the
    // fork re-gaps them to 8px so checkout→PR→branch reads evenly, and drops
    // flex-1 / justify-end / ml-auto so the cluster stays packed when narrow.
    const nested = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-context-row]") &&
        rule.selector.includes('[data-slot="composer-context-strip"]') &&
        (rule.selector.includes(">.flex") || rule.selector.includes("> .flex")),
    );
    expect(nested?.body).toMatch(/gap:\s*8px/u);
    expect(nested?.body).toMatch(/flex:\s*0 1 auto/u);
    expect(nested?.body).toMatch(/justify-content:\s*flex-start/u);
    expect(nested?.body).toMatch(/margin-inline-start:\s*0/u);
    expect(nested?.body).toMatch(/max-width:\s*100%/u);
    // A stretched strip has free space, so packing has to reach EVERY direct
    // child, not just the ones that happen to carry `.flex`. Below `md` the
    // workspace slot is an `inline-flex` Button or span and keeps upstream's
    // flex-1 otherwise, which claims that space and gaps the cluster open.
    const everyChild = rules.find(
      (rule) =>
        rule.selector.includes("[data-fork-composer-context-row]") &&
        rule.selector.includes('[data-slot="composer-context-strip"]') &&
        rule.selector.trim().endsWith("> *"),
    );
    expect(everyChild?.body).toMatch(/flex:\s*0 1 auto/u);
    // Flex only — the wrapper rule's gap and max-width would fight the chips'
    // own 6px gap and the mobile slot's 48% cap.
    expect(everyChild?.body).not.toMatch(/gap:|max-width:/u);
    // Upstream #25869 removed the resting host, so no empty flex slot can open a double gap.
    expect(chatView).not.toContain("composerControlsHostRef");
  });

  it("puts the thread's PR and its background work in chips above the composer", () => {
    const work = readSibling("../custom/ComposerBackgroundWork.tsx");
    const prChip = readSibling("../custom/ComposerPullRequestChip.tsx");
    const usage = readSibling("../custom/ComposerUsageLimitsReadout.tsx");
    const composer = readSibling("../components/chat/ChatComposer.tsx");
    const shell = readSibling("../custom/ComposerShell.tsx");
    const strip = readSibling("../custom/composerContextStrip.tsx");
    const branchToolbar = readSibling("../components/BranchToolbar.tsx");
    const branchSelector = readSibling("../components/BranchToolbarBranchSelector.tsx");
    // The row sits in flow above the vessel and hides when no chip renders.
    expect(shell).toContain('data-fork-composer-status-chips="true"');
    // Banners are cards between the chips and the vessel, not floor inside it.
    expect(shell.indexOf('data-fork-composer-status-chips="true"')).toBeLessThan(
      shell.indexOf('data-fork-composer-banners="true"'),
    );
    expect(composer).toMatch(/banners=\{\s*<ComposerBanner\.Dock>/u);
    expect(theme).toContain(
      ':root[data-fork="noahhendrickson-t3code"] [data-fork-composer-banners] {',
    );
    expect(shell).toContain("empty:hidden");
    expect(composer).toContain("statusChips={props.statusChips}");
    expect(chatView).toContain("statusChips={composerStatusChips}");
    // Background work: the label lists the tasks, a subagent's row opens its thread, the square stops.
    expect(work).toContain("export function ComposerBackgroundWorkChip");
    expect(work).toContain("<ElectricityStackIcon />");
    expect(work).toContain('"Background task" : "Background tasks"');
    // An unpressable Stop is not drawn, and a live run leaves Stop to the composer.
    expect(work).toContain("{props.canStop ? (");
    expect(chatView).toMatch(
      /canStop=\{\s*canOperateThread &&\s*activeBackgroundTasks\.length > 0 &&\s*!\(\(isWorking && activeRuntime\?\.status !== "waiting"\) \|\| phase === "connecting"\)\s*\}/u,
    );
    // A live run's own subagents join the chip, not only work the run left pending.
    expect(chatView).toContain(
      "composerBackgroundTasks(activeBackgroundTasks, serverProjection?.subagents)",
    );
    expect(work).toContain('role="status"');
    expect(work).toContain("Stop background work");
    expect(work).toContain("onClick={() => props.onOpenThread(childThreadId)}");
    expect(chatView).toContain("onOpenThread={onOpenRelatedThreadStable}");
    // The PR chip left the branch group for the row above.
    expect(prChip).toContain("<ThreadPullRequestBadgeControl");
    expect(branchSelector).not.toContain("<ThreadPullRequestBadgeControl");
    // Nothing of the work rides the usage drawer or the context row any more.
    expect(usage).not.toContain("backgroundWork");
    expect(chatView).not.toContain("composerContextTrailing");
    expect(shell).toContain(
      'className="pointer-events-none absolute inset-x-0 bottom-full z-20 flex flex-col"',
    );
    expect(strip).toContain("<ComposerSurface.ContextStrip>");
    expect(strip).toContain("export function renderComposerContextStripFallback({");
    expect(branchToolbar).toContain(
      "return renderComposerContextStripFallback({ leading, trailing });",
    );
    expect(branchToolbar).not.toMatch(/<ComposerSurface\.ContextStrip ref=\{setStripElement\}>/u);
    expect(chatView).not.toContain("backgroundLivenessBannerItem");
    expect(chatView).not.toContain('"Monitoring in the background"');
    expect(chatView).not.toContain('"Background work running"');
    expect(shellCss).toContain("[data-fork-composer-status-chip]");
    expect(shellCss).toContain("button[data-fork-monitoring-task]:hover");
  });
  it("ends the transcript above the composer instead of hiding it behind", () => {
    // The transcript used to scroll the full column height and rely on the
    // composer to cover it. That fails wherever the composer is translucent —
    // under glass it is a 5% wash — and it can never work for the context row,
    // which sits outside the vessel. The mask removes the content instead, so
    // there is nothing to cover in any palette.
    const cutoff = rules.find(
      (rule) =>
        rule.selector.includes(".fork-timeline-cutoff") &&
        !rule.selector.includes(".topbar-scroll-fade"),
    );
    expect(cutoff, "the timeline cutoff mask must exist").toBeDefined();
    expect(cutoff?.selector).toContain(MARKER);

    // Driven by the measured composer, not a guessed constant: the composer
    // grows with the editor and with the context row, and a fixed inset would
    // cut in the wrong place the moment it does.
    expect(cutoff?.body, "the cutoff must follow the measured composer").toContain(
      "var(--fork-composer-inset",
    );
    // Both spellings, or the fade is Chromium-only.
    expect(cutoff?.body).toMatch(/(?<!-webkit-)mask-image:/u);
    expect(cutoff?.body).toContain("-webkit-mask-image:");

    // The mask no longer exempts a scrollbar lane, so the transcript must draw
    // no scrollbar at all. Drop either spelling and the rail comes back, fading
    // out under the bottom ramp beside the composer.
    expect(cutoff?.body).toMatch(/scrollbar-width:\s*none/u);
    const webkitScrollbar = rules.find((rule) =>
      rule.selector.includes(".fork-timeline-cutoff::-webkit-scrollbar"),
    );
    expect(webkitScrollbar?.selector).toContain(MARKER);
    expect(webkitScrollbar?.body).toMatch(/display:\s*none/u);

    // ChatView stamps the value the mask reads, from the composer overlay's
    // published height. Upstream's ChatCanvas owns the chat column and takes no
    // ref, so the stamp reaches it from the overlay element.
    const chatView = readSibling("../components/ChatView.tsx");
    expect(chatView).toContain('"--fork-composer-inset"');
    expect(chatView).toContain('?.closest<HTMLElement>("[data-chat-canvas]")');
    expect(chatView).toContain("publishComposerOverlayHeight");

    // The class is unconditional. Upstream's top fade drops out whenever a
    // banner sits above the timeline, and if the cutoff rode on that class the
    // transcript would run under the composer again in exactly those states.
    const timeline = readSibling("../components/chat/MessagesTimeline.tsx");
    expect(timeline).toContain('"fork-timeline-cutoff"');
    expect(timeline, "the cutoff class must not be gated on the top fade").not.toMatch(
      /topFadeEnabled\s*&&\s*"fork-timeline-cutoff"/u,
    );

    // Masks cannot be composed across rules, so the fork owns the whole stack
    // and folds upstream's top fade back in by height. If that companion rule
    // goes missing the top fade silently stops rendering.
    const withTopFade = rules.find(
      (rule) =>
        rule.selector.includes(".fork-timeline-cutoff") &&
        rule.selector.includes(".topbar-scroll-fade"),
    );
    expect(
      withTopFade,
      "the top-fade height must be restored when upstream's class is on",
    ).toBeDefined();
    // The height comes from the variable upstream's own utility reads, by
    // name. Pinning a literal here is how the cutoff broke once: upstream
    // renamed --topbar-scroll-fade-height, the guard kept matching the stale
    // text, and the unresolved var() invalidated mask-size at computed-value
    // time — every layer went `auto` and covered the whole scroller, and the
    // transcript painted through the composer.
    const indexCss = readSibling("../index.css");
    const utility = /@utility topbar-scroll-fade \{([^}]*)\}/u.exec(indexCss)?.[1] ?? "";
    const upstreamFadeVar = /var\((--[a-z-]*scroll-fade-height)\)/u.exec(utility)?.[1];
    expect(upstreamFadeVar, "upstream's top fade must read a scroll-fade-height variable").toMatch(
      /^--/u,
    );
    expect(indexCss).toContain(`${upstreamFadeVar}:`);
    expect(withTopFade?.body).toContain(`--fork-timeline-top-fade: var(${upstreamFadeVar})`);
    expect(cutoff?.body).toContain("--fork-timeline-top-fade: 0px");
  });
});
