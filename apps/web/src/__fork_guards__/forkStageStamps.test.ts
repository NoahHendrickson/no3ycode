// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-stage-stamps`. A :has() on a large ancestor
    is re-checked for every element inserted under it and restyles the page, so the palettes read
    stamps instead. A stamp fails silently when its producer goes, so each one is pinned to the
    file that writes it and a sheet that reads it. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { transform, type Selector, type SelectorComponent } from "lightningcss";
import { describe, expect, it } from "vite-plus/test";

const srcUrl = new URL("../", import.meta.url);
const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, srcUrl)), "utf8");

// Every fork sheet: the palettes, and the component sheets under custom/.
const sheets = [
  ...NodeFS.readdirSync(NodeURL.fileURLToPath(srcUrl)).filter((name) =>
    /^theme\.custom.*\.css$/u.test(name),
  ),
  ...NodeFS.readdirSync(NodeURL.fileURLToPath(new URL("custom/", srcUrl)), { recursive: true })
    .map(String)
    .filter((name) => name.endsWith(".css"))
    .map((name) => `custom/${name}`),
].map((name) => ({ name, css: read(name) }));

type Compound = readonly SelectorComponent[];

/** One :has() in a sheet: its own compound, and the compounds its :is()/:where()/:not() hang from. */
interface HasUse {
  readonly sheet: string;
  readonly has: SelectorComponent;
  readonly chain: readonly Compound[];
}

function compounds(selector: Selector): Compound[] {
  const out: SelectorComponent[][] = [[]];
  for (const component of selector) {
    if (component.type === "combinator") out.push([]);
    else out.at(-1)!.push(component);
  }
  return out;
}

function collectHas(sheet: string, selector: Selector, outer: readonly Compound[], uses: HasUse[]) {
  for (const compound of compounds(selector)) {
    for (const component of compound) {
      if (component.type !== "pseudo-class") continue;
      if (component.kind === "has") {
        uses.push({ sheet, has: component, chain: [compound, ...outer] });
        for (const inner of component.selectors) collectHas(sheet, inner, [], uses);
      } else if (
        component.kind === "is" ||
        component.kind === "where" ||
        component.kind === "not"
      ) {
        for (const inner of component.selectors)
          collectHas(sheet, inner, [compound, ...outer], uses);
      }
    }
  }
}

/** Each style rule's selectors, nesting resolved by lightningcss (lowered for a target without it). */
function styleSelectors(code: string): Selector[] {
  const selectors: Selector[] = [];
  const flat = transform({
    filename: "sheet.css",
    code: Buffer.from(code),
    errorRecovery: true,
    targets: { chrome: 111 << 16 },
  }).code;
  transform({
    filename: "sheet.css",
    code: flat,
    errorRecovery: true,
    visitor: { Rule: { style: (rule) => void selectors.push(...rule.value.selectors) } },
  });
  return selectors;
}

const hasUses = sheets.flatMap(({ name, css }) => {
  const uses: HasUse[] = [];
  for (const selector of styleSelectors(css)) collectHas(name, selector, [], uses);
  return uses;
});

/** A selector written in a list below, as lightningcss reads it. */
function parsed(selector: string): string {
  const [only] = styleSelectors(`${selector} { color: red }`);
  if (only === undefined) throw new Error(`not a selector: ${selector}`);
  return JSON.stringify(only);
}

const LARGE_ANCESTOR_SLOTS = new Set(["sidebar-inset", "sidebar-wrapper", "sidebar-group"]);
const isLargeAncestor = (component: SelectorComponent) =>
  (component.type === "pseudo-class" && component.kind === "root") ||
  (component.type === "attribute" &&
    (component.name === "data-chat-column-maximized-away" ||
      (component.name === "data-slot" &&
        component.operation?.operator === "equal" &&
        LARGE_ANCESTOR_SLOTS.has(component.operation.value))));

/** An attribute, class or id narrows the compound; so does an :is()/:where() whose every option does. */
function keyed(compound: Compound): boolean {
  return compound.some(
    (component) =>
      component.type === "class" ||
      component.type === "id" ||
      component.type === "attribute" ||
      (component.type === "pseudo-class" &&
        (component.kind === "is" || component.kind === "where") &&
        component.selectors.every((option) => keyed(compounds(option).at(-1)!))),
  );
}

const MINI_PLAYER = ":has([data-preview-mini-player] [data-browser-surface-slot])";

/** The :has() still hung on a large ancestor, by sheet. Each argument names elements that mount
    only on a rare interaction, never while a thread streams or a switch renders, which measured
    as no cost on a switch. A new entry needs the same case; otherwise stamp the condition. */
const ALLOWED: ReadonlyArray<{ readonly sheet: string; readonly has: string }> = [
  // A desktop tab floating over the chat.
  { sheet: "theme.custom.css", has: MINI_PLAYER },
  { sheet: "theme.custom.glass.css", has: MINI_PLAYER },
  { sheet: "theme.custom.glass-stage.css", has: MINI_PLAYER },
  { sheet: "theme.custom.glass-surfaces.css", has: MINI_PLAYER },
  { sheet: "theme.custom.palettes.css", has: MINI_PLAYER },
  // The transcript's cutoff mask: one element, no message row carries the class.
  { sheet: "theme.custom.glass-stage.css", has: ":has(.fork-timeline-cutoff)" },
  { sheet: "theme.custom.palettes.css", has: ":has(.fork-timeline-cutoff)" },
  // A sidebar peek, and a chip's menu opening below it.
  { sheet: "theme.custom.inlet-menus.css", has: ':has([data-fork-sidebar-peek="open"])' },
  { sheet: "theme.custom.inlet.css", has: ':has([data-fork-chip-menu][data-side="bottom"])' },
];

/** The compounds of :has() rules whose subject is a bare tag or any element, still in place.
    Each is a known cost under every palette; take it off once the rule keys on an attribute. */
const BARE_SUBJECT_KNOWN: ReadonlyArray<{ readonly sheet: string; readonly compound: string }> = [
  // The editor's wrapper is upstream markup with nothing to key on.
  { sheet: "theme.custom.css", compound: ':has(> [data-testid="composer-editor"])' },
  { sheet: "theme.custom.css", compound: ':has([data-testid="composer-editor"])' },
  { sheet: "theme.custom.westworld.css", compound: ':has(> [data-testid="composer-editor"])' },
  { sheet: "custom/ComposerShell.css", compound: ":has(> [data-composer-control-chevron])" },
  // Inlet's breadcrumb, and Glass's header breadcrumb list.
  {
    sheet: "theme.custom.inlet.css",
    compound: 'nav:has([data-slot="workspace-breadcrumb-text"]):not(:has(input))',
  },
  { sheet: "theme.custom.inlet.css", compound: ":has(input)" },
  { sheet: "theme.custom.glass.css", compound: 'ol:has([data-slot="workspace-breadcrumb-text"])' },
  // Glass's focus ring on the composer row's chips: one option of its subject is any button.
  {
    sheet: "theme.custom.glass.css",
    compound: ':has(:focus-visible:not([data-testid="composer-editor"]))',
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
    const found = hasUses
      .filter((use) => use.chain.some((compound) => compound.some(isLargeAncestor)))
      .map((use) => ({ sheet: use.sheet, has: JSON.stringify([use.has]) }));
    const allowed = ALLOWED.map((entry) => ({ sheet: entry.sheet, has: parsed(entry.has) }));
    const listed = (a: { sheet: string; has: string }, b: { sheet: string; has: string }) =>
      a.sheet === b.sheet && a.has === b.has;
    expect(found.filter((hit) => !allowed.some((entry) => listed(entry, hit)))).toEqual([]);
    // An entry whose rule is gone, or now reads a stamp, comes off the list.
    expect(
      ALLOWED.filter((_, index) => !found.some((hit) => listed(allowed[index]!, hit))),
    ).toEqual([]);
  });

  it("keys every new :has() on an attribute, class or id, not a bare tag or any element", () => {
    const found = hasUses
      .filter((use) => !use.chain.some(keyed))
      .map((use) => ({ sheet: use.sheet, compound: JSON.stringify(use.chain[0]) }));
    const known = BARE_SUBJECT_KNOWN.map((entry) => ({
      sheet: entry.sheet,
      compound: parsed(entry.compound),
    }));
    const listed = (
      a: { sheet: string; compound: string },
      b: { sheet: string; compound: string },
    ) => a.sheet === b.sheet && a.compound === b.compound;
    expect(found.filter((hit) => !known.some((entry) => listed(entry, hit)))).toEqual([]);
    expect(
      BARE_SUBJECT_KNOWN.filter((_, index) => !found.some((hit) => listed(known[index]!, hit))),
    ).toEqual([]);
  });

  it.each(STAMPS)("$stamp is written by its producer and read by a sheet", (entry) => {
    for (const [path, contains] of entry.producers) {
      expect(read(path), `${path} writes ${entry.stamp}`).toContain(contains);
    }
    expect(sheets.some(({ css }) => css.includes(`[${entry.stamp}]`))).toBe(true);
  });
});
