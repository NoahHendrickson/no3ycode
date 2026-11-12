// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-stage-stamps`. A :has() on a large ancestor
    is re-checked for every element inserted under it and restyles the page, so the palettes read
    stamps instead. A stamp fails silently when its producer goes, so each one is pinned to the
    file that writes it and a sheet that reads it. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { cssRules } from "./cssRules";

const srcUrl = new URL("../", import.meta.url);
const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, srcUrl)), "utf8");
const compact = (value: string) => value.replace(/\s+/gu, "");

const sheets = NodeFS.readdirSync(NodeURL.fileURLToPath(srcUrl))
  .filter((name) => /^theme\.custom.*\.css$/u.test(name))
  .map((name) => ({ name, css: read(name) }));

// A compound naming one of these, with a :has() (or :not(:has())) in the same compound.
const LARGE_ANCESTOR =
  /(?::root|\[data-slot="sidebar-(?:inset|wrapper|group)"\]|\[data-chat-column-maximized-away\])(?:\[[^\]]*\]|\.[\w-]+|:[\w-]+(?:\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\))?)*?:(?:not\(\s*:)?has\(/u;

const MINI_PLAYER = ":has([data-preview-mini-player] [data-browser-surface-slot])";

/** Where a :has() still sits on a large ancestor. Each argument names elements that mount only
    on a rare interaction, never while a thread streams or a switch renders, which measured as
    no cost on a switch. A new entry needs the same case; otherwise stamp the condition. */
const ALLOWED: ReadonlyArray<{ readonly sheet: string; readonly selector: string }> = [
  // A desktop tab floating over the chat.
  { sheet: "theme.custom.css", selector: MINI_PLAYER },
  { sheet: "theme.custom.glass.css", selector: `[data-chat-column-maximized-away]${MINI_PLAYER}` },
  { sheet: "theme.custom.glass.css", selector: `[data-fork-draft-hero]:not(${MINI_PLAYER})` },
  {
    sheet: "theme.custom.glass-stage.css",
    selector: `[data-chat-column-maximized-away]${MINI_PLAYER}`,
  },
  { sheet: "theme.custom.glass-surfaces.css", selector: MINI_PLAYER },
  { sheet: "theme.custom.palettes.css", selector: MINI_PLAYER },
  // The transcript's cutoff mask: one element, no message row carries the class.
  { sheet: "theme.custom.glass-stage.css", selector: ":has(.fork-timeline-cutoff)" },
  { sheet: "theme.custom.palettes.css", selector: ":has(.fork-timeline-cutoff)" },
  // A sidebar peek, and a chip's menu opening below it.
  { sheet: "theme.custom.inlet-menus.css", selector: ':has([data-fork-sidebar-peek="open"])' },
  { sheet: "theme.custom.inlet.css", selector: ':has([data-fork-chip-menu][data-side="bottom"])' },
  // Jungle Art's transcript dimming, which #292 deletes with the picture behind threads.
  { sheet: "theme.custom.inlet-jungle.css", selector: ":has([data-timeline-row-kind])" },
  {
    sheet: "theme.custom.inlet-jungle.css",
    selector: ":has([data-chat-column-maximized-away][data-timeline-row-kind])",
  },
];

const STAMPS: ReadonlyArray<{
  readonly stamp: string;
  readonly producers: ReadonlyArray<readonly [path: string, contains: string]>;
}> = [
  {
    stamp: "data-fork-has-chat-column",
    producers: [
      ["custom/forkStageStamps.ts", 'rootStampRef("data-fork-has-chat-column")'],
      ["components/ChatView.tsx", "ref={forkChatColumnRef}"],
    ],
  },
  {
    stamp: "data-fork-draft-hero-shown",
    producers: [
      ["custom/forkStageStamps.ts", 'rootStampRef("data-fork-draft-hero-shown")'],
      ["components/ChatView.tsx", "ref={forkDraftHeroShownRef}"],
    ],
  },
  {
    stamp: "data-fork-draft-hero",
    producers: [
      ["components/ChatView.tsx", 'data-fork-draft-hero={isDraftHeroState ? "" : undefined}'],
    ],
  },
  {
    stamp: "data-fork-has-stage-card",
    producers: [
      ["components/usage/UsagePage.tsx", "ref={forkStageCardRef}"],
      ["custom/scheduled/ScheduledPage.tsx", "ref={forkStageCardRef}"],
    ],
  },
  {
    stamp: "data-fork-has-thread-tabs",
    producers: [["custom/CollapsedThreadTabs.tsx", "ref={forkThreadTabsRef}"]],
  },
  {
    stamp: "data-fork-has-rows",
    producers: [
      ["custom/forkStageStamps.ts", 'setAttribute("data-fork-has-rows", "")'],
      ["components/chat/MessagesTimeline.tsx", "useForkTimelineRowsStamp("],
      ["components/ChatView.tsx", 'data-fork-messages-wrapper=""'],
    ],
  },
  {
    stamp: "data-fork-workspace-root",
    producers: [["components/ChatView.tsx", 'data-fork-workspace-root=""']],
  },
  {
    stamp: "data-fork-thread-list",
    producers: [["components/Sidebar.tsx", 'data-fork-thread-list=""']],
  },
  {
    stamp: "data-fork-chrome-rows",
    producers: [["custom/SidebarV2ChromeRows.tsx", 'data-fork-chrome-rows=""']],
  },
  {
    stamp: "data-fork-dictation-mic",
    producers: [["custom/voice/ForkDictationControl.tsx", 'data-fork-dictation-mic=""']],
  },
  {
    stamp: "data-fork-tab-has-mark",
    producers: [["custom/CollapsedThreadTabs.tsx", "data-fork-tab-has-mark="]],
  },
  {
    stamp: "data-fork-has-docked-details",
    producers: [
      ["custom/forkStageStamps.ts", 'columnStampRef("data-fork-has-docked-details")'],
      ["components/chat/ThreadDetailsCard.tsx", "ref={forkDockedDetailsRef}"],
    ],
  },
  {
    stamp: "data-fork-has-find-bar",
    producers: [
      ["custom/forkStageStamps.ts", 'columnStampRef("data-fork-has-find-bar")'],
      ["components/chat/ThreadFindBar.tsx", "ref={forkFindBarRef}"],
    ],
  },
  {
    stamp: "data-fork-morph-failed",
    producers: [["custom/inletMenuMorph.ts", 'trigger.dataset.forkMorphFailed = ""']],
  },
];

describe("fork guard: fork-stage-stamps", () => {
  it("hangs no new :has() on :root, the sidebar wrapper, inset or groups, or the chat column", () => {
    const found = sheets.flatMap(({ name, css }) =>
      cssRules(css)
        .filter((rule) => LARGE_ANCESTOR.test(rule.selector))
        .map((rule) => ({ sheet: name, selector: compact(rule.selector) })),
    );
    const allowed = (hit: { sheet: string; selector: string }) =>
      ALLOWED.some(
        (entry) => entry.sheet === hit.sheet && hit.selector.includes(compact(entry.selector)),
      );
    expect(found.filter((hit) => !allowed(hit))).toEqual([]);
    // An entry whose rule is gone, or now reads a stamp, comes off the list.
    expect(
      ALLOWED.filter(
        (entry) =>
          !found.some(
            (hit) => hit.sheet === entry.sheet && hit.selector.includes(compact(entry.selector)),
          ),
      ),
    ).toEqual([]);
  });

  it.each(STAMPS)("$stamp is written by its producer and read by a sheet", (entry) => {
    for (const [path, contains] of entry.producers) {
      expect(read(path), `${path} writes ${entry.stamp}`).toContain(contains);
    }
    expect(sheets.some(({ css }) => css.includes(`[${entry.stamp}]`))).toBe(true);
  });
});
