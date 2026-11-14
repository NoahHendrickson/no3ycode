// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-inlet-theme`. Inlet is a template with a
    colour; losing the wiring leaves a dead option, and scoping the template under .dark loses
    every light colour. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import {
  FORK_PALETTE_LABELS,
  FORK_PALETTES,
  INLET_BACKGROUND,
  INLET_COLOR_OPTIONS,
  INLET_COLORS,
  INLET_LABEL,
  INLET_THEME,
  forkPaletteAppearance,
  resolveActiveForkPalette,
  resolveAppearanceOption,
} from "../custom/forkTheme";
import { FORK_MARKER_ATTRIBUTE, FORK_MARKER_VALUE } from "../custom/forkMarker";
import { PULL_REQUEST_STATE_PRESENTATION } from "../components/pullRequest/pullRequestIcons";
import { projectIconColorClassName } from "../projectIconColors";
import { cssRules, declarationHex, ruleBodyFor } from "./cssRules";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const MARKER = `:root[${FORK_MARKER_ATTRIBUTE}="${FORK_MARKER_VALUE}"]`;
const TEMPLATE = `${MARKER}[data-fork-theme="${INLET_THEME}"]`;
const CHARCOAL = `${MARKER}.dark[data-fork-theme="${INLET_THEME}"]`;
const GREEN = `${MARKER}[data-fork-theme="${INLET_THEME}"][data-fork-inlet-color="green"]`;
// The frame's tokens: the sidebar, and the collapsed sidebar's tab strip on the frame beside it.
const FRAME = ':is([data-sidebar-version="v2"], [data-fork-thread-tabs])';
const palettes = readSibling("../theme.custom.palettes.css");
/** The rule whose selector list names exactly this selector: colours that share
    tokens (Green and Jungle Light) list both. */
function ruleNaming(rules: ReturnType<typeof cssRules>, parts: readonly string[]): string {
  const wanted = parts.join(" ").replace(/\s+/gu, " ").trim();
  const listed = (selector: string) => {
    const items: string[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < selector.length; index += 1) {
      const char = selector[index];
      if (char === "(" || char === "[") depth += 1;
      else if (char === ")" || char === "]") depth -= 1;
      else if (char === "," && depth === 0) {
        items.push(selector.slice(start, index));
        start = index + 1;
      }
    }
    items.push(selector.slice(start));
    return items.map((item) => item.replace(/\s+/gu, " ").trim());
  };
  const rule = rules.find((candidate) => listed(candidate.selector).includes(wanted));
  if (rule === undefined) throw new Error(`no rule names: ${wanted}`);
  return rule.body;
}
// The template, its hung menus and tooltips, and the per-colour sheets, in their import order.
const INLET_FILES = [
  "theme.custom.inlet.css",
  "theme.custom.inlet-composer.css",
  "theme.custom.inlet-menus.css",
  "theme.custom.inlet-peek.css",
  "theme.custom.inlet-jungle.css",
  "theme.custom.inlet-black.css",
] as const;
const inlet = INLET_FILES.map((file) => readSibling(`../${file}`)).join("\n");
const paletteRules = cssRules(palettes);
const inletRules = cssRules(inlet);

/** Every :root-level palette block that names the colour, alone or in an :is() list. */
function rootStageBody(color: string): string {
  return paletteRules
    .filter(
      (rule) =>
        rule.selector.includes(`[data-fork-inlet-color="${color}"]`) &&
        !/\s(?![^(]*\))/u.test(rule.selector.trim().replace(/,\s+/gu, ",")),
    )
    .map((rule) => rule.body)
    .join("\n");
}
const indexHtml = readSibling("../../index.html");
const appearancePanel = readSibling("../components/settings/AppearanceSettingsPanel.tsx");
const customizations = readSibling("../../../../.fork/customizations.yaml");

describe("fork guard: fork-inlet-theme", () => {
  it("registers Inlet as a fork palette with a colour picker in Appearance", () => {
    expect(customizations).toContain("id: fork-inlet-theme");
    expect(FORK_PALETTES).toContain(INLET_THEME);
    expect(FORK_PALETTE_LABELS[INLET_THEME]).toBe(INLET_LABEL);
    expect(appearancePanel).toContain("<ForkInletColorPicker");
    expect(appearancePanel).toMatch(/appearance === INLET_THEME \?/u);
  });

  it("sits each colour on its own appearance", () => {
    expect(forkPaletteAppearance(INLET_THEME, "charcoal")).toBe("dark");
    expect(forkPaletteAppearance(INLET_THEME, "green")).toBe("light");
    expect(forkPaletteAppearance(INLET_THEME, "cream")).toBe("dark");
    expect(forkPaletteAppearance(INLET_THEME, "black")).toBe("light");
    expect(forkPaletteAppearance("cool-dark", "green")).toBe("dark");
    expect(resolveAppearanceOption("dark", INLET_THEME, "charcoal")).toBe(INLET_THEME);
    expect(resolveAppearanceOption("light", INLET_THEME, "green")).toBe(INLET_THEME);
    expect(
      resolveActiveForkPalette({
        theme: "dark",
        palette: INLET_THEME,
        isDark: true,
        inletColor: "green",
      }),
    ).toBeNull();
    expect(
      resolveActiveForkPalette({
        theme: "light",
        palette: INLET_THEME,
        isDark: false,
        inletColor: "charcoal",
      }),
    ).toBeNull();
  });

  it("paints Charcoal as a #232322 frame round a #303235 panel", () => {
    const stage = ruleBodyFor(paletteRules, [CHARCOAL]);
    const panel = ruleBodyFor(paletteRules, [CHARCOAL, FRAME]);
    expect(declarationHex(stage, "--background")).toBe(INLET_BACKGROUND);
    expect(INLET_COLOR_OPTIONS.charcoal.frame).toBe(INLET_BACKGROUND);
    expect(declarationHex(stage, "--fork-inlet-panel")).toBe("#303235");
    expect(declarationHex(stage, "--fork-context-chip-bg-hover")).toMatch(/^#/u);
    expect(declarationHex(panel, "--sidebar")).toBe(INLET_BACKGROUND);
    expect(declarationHex(panel, "--sidebar-row-selected")).toBe("#303235");
    expect(palettes).toContain(INLET_FILES.map((file) => `@import "./${file}";`).join("\n"));
  });

  it("paints Green as a #21835c frame round a cream panel, on light", () => {
    const stage = ruleNaming(paletteRules, [GREEN]);
    const panel = ruleNaming(paletteRules, [GREEN, FRAME]);
    expect(GREEN).not.toContain(".dark");
    expect(declarationHex(stage, "--background")).toBe(INLET_COLOR_OPTIONS.green.frame);
    expect(declarationHex(stage, "--fork-inlet-panel")).toBe("#f1f0e0");
    expect(declarationHex(panel, "--sidebar")).toBe(INLET_COLOR_OPTIONS.green.frame);
    expect(declarationHex(panel, "--sidebar-foreground")).toBe("#ffffff");
    expect(declarationHex(panel, "--sidebar-row-selected")).toBe("#f1f0e0");
  });

  it("paints Jungle Art's threads charcoal and its new-agent screen as a picture, on dark", () => {
    const jungle = `${MARKER}[data-fork-theme="${INLET_THEME}"][data-fork-inlet-color="jungle"]`;
    const stage = ruleBodyFor(paletteRules, [jungle]);
    expect(forkPaletteAppearance(INLET_THEME, "jungle")).toBe("dark");
    expect(declarationHex(stage, "--fork-inlet-frame")).toBe(INLET_COLOR_OPTIONS.jungle.frame);
    // A thread is Cream's charcoal stage: one block both colours read.
    const shared = paletteRules.find(
      (rule) =>
        rule.selector.includes('[data-fork-inlet-color="jungle"]') &&
        rule.selector.includes('[data-fork-inlet-color="cream"]') &&
        rule.body.includes("--fork-inlet-panel:"),
    );
    expect(declarationHex(shared?.body ?? "", "--fork-inlet-panel")).toBe("#141414");
    // A transcript never scrolls over the picture: a pinned background costs every scrolled frame.
    const column = ruleBodyFor(inletRules, [jungle, "[data-chat-column-maximized-away]"]);
    expect(column).not.toContain("url(");
    const draft = ruleBodyFor(inletRules, [
      jungle,
      "[data-chat-column-maximized-away][data-fork-draft-hero]",
    ]);
    expect(draft).toContain('url("./custom/assets/inlet-jungle.jpg")');
    expect(
      inletRules.filter(
        (rule) =>
          rule.selector.includes('[data-fork-inlet-color="jungle"]') &&
          rule.body.includes("inlet-jungle.jpg"),
      ),
    ).toHaveLength(1);
    expect(NodeFS.existsSync(new URL("../custom/assets/inlet-jungle.jpg", import.meta.url))).toBe(
      true,
    );
    // Jungle Light is Green's stage with the same art behind the frame instead.
    expect(forkPaletteAppearance(INLET_THEME, "jungle-light")).toBe("light");
    const frameArt = inletRules.find(
      (rule) =>
        rule.selector.includes('[data-fork-inlet-color="jungle-light"]') &&
        rule.selector.endsWith('[data-slot="sidebar-wrapper"]'),
    )?.body;
    expect(frameArt).toContain('url("./custom/assets/inlet-jungle.jpg")');
    // Anything in the column that paints --background would cover the picture.
    const seeThrough = inletRules.find((rule) => rule.selector.includes("[data-timeline-loading]"));
    expect(seeThrough?.body).toContain("background-color: transparent");
  });

  it("declares every colour's frame, panel and row ink", () => {
    for (const color of INLET_COLORS) {
      const stage = {
        body: color === "charcoal" ? ruleNaming(paletteRules, [CHARCOAL]) : rootStageBody(color),
      };
      expect(stage?.body, color).toContain("--fork-inlet-panel:");
      expect(stage?.body, color).toContain("--fork-inlet-panel-foreground:");
      expect(stage?.body, color).toContain("--fork-inlet-panel-muted:");
      expect(stage?.body, color).toContain("--fork-context-chip-bg-hover:");
    }
  });

  it("gives only project icons and PR tones their dark shades in Black's charcoal sidebar", () => {
    expect(projectIconColorClassName("red").split(" ")).toEqual(
      expect.arrayContaining(["text-red-600", "fork-project-icon"]),
    );
    const black = `${TEMPLATE}[data-fork-inlet-color="black"]`;
    const icons = inletRules.find(
      (rule) =>
        rule.selector.includes(black) &&
        rule.selector.includes(FRAME) &&
        rule.selector.trim().endsWith(".fork-project-icon"),
    );
    expect(icons?.body).toContain("--color-red-600: var(--color-red-400);");
    const remapsScope = paletteRules.some(
      (rule) => rule.selector.includes(black) && /--color-[a-z]+-600:/u.test(rule.body),
    );
    expect(remapsScope).toBe(false);
    for (const state of ["open", "merged", "closed"] as const) {
      expect(PULL_REQUEST_STATE_PRESENTATION[state].toneClassName.split(" ")).toContain(
        "fork-pr-tone",
      );
    }
    const unhooked = inletRules.filter(
      (rule) =>
        rule.selector.includes(black) &&
        /--color-[a-z]+-600:/u.test(rule.body) &&
        !/\.fork-(project-icon|pr-tone)\s*$/u.test(rule.selector.trim()),
    );
    expect(unhooked.map((rule) => rule.selector)).toEqual([]);
  });

  it("sets the chat column into the frame as a rounded panel on either appearance", () => {
    const column = ruleBodyFor(inletRules, [TEMPLATE, "[data-chat-column-maximized-away]"]);
    expect(column).toContain("--background: var(--fork-inlet-panel)");
    // One card holds the stage's columns (fork-stage-columns): the stage row is set into the frame.
    const stage = ruleBodyFor(inletRules, [TEMPLATE, "[data-fork-workspace-root]"]);
    expect(stage).toContain("--background: var(--fork-inlet-panel)");
    expect(stage).toMatch(
      /margin:\s*var\(--fork-inlet-panel-top\) var\(--fork-inlet-margin\) var\(--fork-inlet-margin\)/u,
    );
    // On Windows panels start below the caption buttons, the right panel too.
    expect(inlet).toMatch(
      /\.wco\[data-fork-theme="inlet"\]:not\(\s*\[data-fork-has-thread-tabs\]\s*\)\s*\{\s*--fork-inlet-panel-top: var\(--workspace-topbar-height\);/u,
    );
    expect(inlet).toMatch(
      /\[data-preview-panel-mode="inline"\],\s*\[data-fork-workspace-root\] > \[data-workspace-titlebar-controls\]\s*\) \{\s*--workspace-controls-top: var\(--fork-inlet-panel-top\);[\s\S]*?--workspace-native-controls-inset: 1rem;/u,
    );
    expect(stage).toMatch(/border-radius:\s*var\(--fork-inlet-radius\)/u);
    // The conversation is a column of that card, not a card of its own.
    expect(column).not.toMatch(/margin|border-radius/u);
    const modal = ruleBodyFor(inletRules, [TEMPLATE, "[data-app-modal]"]);
    expect(modal).toContain("--background: var(--fork-inlet-panel)");
    // The column's own controls offset would otherwise lift them into the tab strip.
    const underStrip = inletRules.find(
      (rule) =>
        rule.selector.includes("[data-fork-thread-panes]") &&
        rule.body.includes("--workspace-controls-top"),
    );
    expect(underStrip?.body).toMatch(/--workspace-topbar-height[\s\S]*--fork-inlet-margin/u);
    // Rules that draw the template never require .dark; a light colour needs every one.
    for (const rule of inletRules.filter((candidate) => candidate.body.includes("--fork-inlet-"))) {
      expect(rule.selector, rule.selector).not.toMatch(/(?<!:not\()\.dark(?![-\w])/u);
    }
  });

  it("runs the open row into the panel through concave corners, clipped by the sidebar", () => {
    // A settled thread's open row is the slim row; it takes the same corners.
    const openSelector = [
      TEMPLATE,
      '[data-sidebar-version="v2"]',
      '[data-fork-thread-row][aria-current="page"]',
    ].join(" ");
    const card = inletRules
      .filter((rule) => rule.selector.replace(/\s+/gu, " ").trim() === openSelector)
      .map((rule) => rule.body)
      .join("\n");
    expect(card).toMatch(
      /border-radius:\s*var\(--fork-inlet-radius\) 0 0 var\(--fork-inlet-radius\)/u,
    );
    // The row sits on the panel, so it takes the panel's ink, contrast inks included; a
    // settled thread's open row is the slim row, on the same fill.
    const row = ruleNaming(inletRules, [
      TEMPLATE,
      '[data-sidebar-version="v2"]',
      '[data-fork-thread-row][aria-current="page"]',
    ]);
    expect(row).toContain("--foreground: var(--fork-inlet-panel-foreground)");
    expect(row).toContain("--contrast-foreground: var(--fork-inlet-panel-foreground)");

    const docked = inletRules.filter((rule) =>
      rule.atRules.some((atRule) => atRule.includes("min-width: 768px")),
    );
    const bridge = docked.find((rule) =>
      rule.selector
        .replace(/\s+/gu, "")
        .endsWith('li[data-thread-item]:has([data-fork-thread-row][aria-current="page"])::after'),
    );
    expect(bridge?.body).toContain("radial-gradient");
    expect(bridge?.body).toContain("var(--fork-inlet-panel)");
    // An open split pair (fork-split-threads) bridges from its row, not its open half.
    expect(bridge?.selector.replace(/\s+/gu, "")).toContain(
      "li[data-fork-split-pair][data-active]::after",
    );
    // Paint containment from content-visibility would clip the bridge to the item.
    const item = docked.find((rule) =>
      rule.selector
        .replace(/\s+/gu, "")
        .endsWith('li[data-thread-item]:has([data-fork-thread-row][aria-current="page"])'),
    );
    expect(item?.body).toContain("content-visibility: visible");
    // Nothing between the row and the panel: flush panel, no seam, no gutter.
    const list = docked.find((rule) => rule.body.includes("scrollbar-width: none"));
    expect(list?.body).toContain("scrollbar-gutter: auto");
    expect(docked.some((rule) => rule.body.includes("margin-left: 0"))).toBe(true);
    expect(docked.some((rule) => rule.body.includes("border-right-width: 0"))).toBe(true);
    // A lit chrome row (New agent, Usage, Automations) bridges into the chat column and the
    // stage card alike.
    const chromeBridge = docked.find((rule) =>
      rule.selector.endsWith('[data-fork-chrome-row][data-active="true"]::after'),
    );
    expect(chromeBridge?.selector).toContain("[data-fork-has-chat-column]");
    expect(chromeBridge?.selector).toContain("[data-fork-has-stage-card]");
    expect(chromeBridge?.body).toContain("radial-gradient");
  });

  it("sets the prompt 4px inside a 12px vessel under 8px context chips", () => {
    const vessel = ruleBodyFor(inletRules, [TEMPLATE, "[data-fork-composer-vessel]"]);
    expect(vessel).toContain("border-radius: 12px");
    expect(vessel).toContain("--chat-composer-drawer-inset: 4px");
    expect(
      ruleBodyFor(inletRules, [
        TEMPLATE,
        "[data-fork-composer-vessel]",
        "[data-fork-composer-box]",
      ]),
    ).toContain("margin: 4px");
    const chips = inletRules.find(
      (rule) =>
        rule.selector
          .replace(/\s+/gu, " ")
          .startsWith(`${TEMPLATE} [data-fork-composer-context-row]`) &&
        rule.body.includes("border-radius"),
    );
    expect(chips?.body).toContain("border-radius: 8px");
    // Questions sits on the prompt at the same inset, on either appearance.
    const card = inletRules.find((rule) =>
      rule.selector
        .replace(/\s+/gu, " ")
        .startsWith(
          `${TEMPLATE} [data-fork-composer-vessel] > [data-slot="composer-banner-attachment"]`,
        ),
    );
    expect(card?.body).toContain("margin: 4px 4px 0");
    const fused = inletRules.find(
      (rule) =>
        rule.selector.endsWith("[data-fork-composer-box]") &&
        rule.selector.includes("pending-user-input"),
    );
    expect(fused?.body).toContain("margin-top: 0");
    // The portaled / and @ menu copies that card: told the drawer inset is 0 it spans the
    // prompt, takes the card's fill, and the prompt squares its top corners while it is open.
    const slashMenu = inletRules.find((rule) =>
      rule.selector
        .replace(/\s+/gu, " ")
        .endsWith("[data-composer-drawer-layer] [data-composer-command-drawer]"),
    );
    expect(slashMenu?.body).toContain("background: var(--fork-inlet-question-fill)");
    expect(slashMenu?.body).toContain("margin-bottom: var(--chat-composer-attachment-overlap)");
    expect(
      inletRules.find((rule) =>
        rule.selector.endsWith("[data-chat-composer-form]:has([data-fork-composer-menu-open])"),
      )?.body,
    ).toContain("--chat-composer-drawer-inset: 0rem");
    expect(readSibling("../components/chat/ChatComposer.tsx")).toContain(
      "data-fork-composer-menu-open={composerSuggestionsVisible",
    );
    expect(
      inletRules.some((rule) =>
        rule.selector.includes("[data-fork-composer-box][data-fork-composer-menu-open]"),
      ),
    ).toBe(true);
  });

  it("opens a row's hover card as a solid tab joined to the row", () => {
    for (const site of [
      "../components/Sidebar.tsx",
      "../components/sidebar/SidebarThreadRow.tsx",
      "../custom/SidebarV2AutomationsHoverCard.tsx",
      "../custom/SubagentRowHoverCardPopup.tsx",
    ]) {
      expect(readSibling(site), site).toContain('data-fork-row-hover-card=""');
    }
    // The details card's subagent rows (lineage rows and workflow members) hang theirs
    // through the one fork popup, and mark the row the tab fills while it is out.
    for (const site of [
      "../components/chat/ThreadRelationshipsControl.tsx",
      "../components/chat/ThreadLineageWorkflowRow.tsx",
    ]) {
      const source = readSibling(site);
      expect(source, site).toContain("SubagentRowHoverCardPopup");
      expect(source, site).not.toContain("ThreadHoverCardPopup");
      expect(source, site).toContain("data-fork-row-hover-trigger=");
    }
    // Both row shapes carry one styling hook, so a row rule can't miss a shape.
    expect(
      readSibling("../components/Sidebar.tsx").match(/data-fork-thread-row=""/gu),
    ).toHaveLength(2);
    expect(`${inlet}\n${palettes}`).not.toMatch(/data-testid="sidebar-row-(?:card|slim)"/u);
    const hoverCardAfter = (suffix: string) =>
      inletRules.find(
        (rule) =>
          rule.selector.includes("[data-fork-row-hover-card]") &&
          rule.selector
            .replace(/\s+/gu, " ")
            .replace(/\(\s+/gu, "(")
            .replace(/\s+\)/gu, ")")
            .endsWith(suffix),
      )?.body;
    const tab = hoverCardAfter(
      ':is([data-align="start"], [data-align="end"]):not([data-fork-on-open-pair])::after',
    );
    expect(tab).toContain("var(--anchor-height)");
    expect(tab).toContain("radial-gradient");
    // Near the window's bottom the card flips end-aligned, and a card left of its row
    // mirrors across; each axis flips the one drawing, never a second copy of it.
    expect(tab).toContain("scale: var(--fork-row-tab-x) var(--fork-row-tab-y)");
    expect(hoverCardAfter('[data-align="end"]')).toContain("--fork-row-tab-y: -1");
    expect(hoverCardAfter('[data-side="left"]')).toContain("--fork-row-tab-x: -1");
    for (const suffix of ['[data-align="end"]::after', '[data-side="left"]::after']) {
      expect(hoverCardAfter(suffix), suffix).not.toMatch(/gradient|scale/u);
    }
    // The Threads header's icon menus hang from their buttons the same way.
    const chrome = readSibling("../custom/SidebarV2ChromeRows.tsx");
    expect(chrome.match(/data-fork-tab-trigger=""/gu)).toHaveLength(2);
    expect(chrome.match(/data-fork-tab-menu="sidebar"/gu)).toHaveLength(2);
    // So do the collapsed sidebar tab strip's status and More menus, one start-aligned, and
    // a tab's "…" thread menu (the in-page context menu, marked when it opens).
    const strip = readSibling("../custom/CollapsedThreadTabs.tsx");
    expect(strip.match(/data-fork-tab-trigger=""/gu)).toHaveLength(3);
    expect(strip).toContain("openMenu(anchoredMenuPosition(event.currentTarget))");
    expect(strip.match(/data-fork-tab-menu=""/gu)).toHaveLength(2);
    expect(
      inletRules.some((rule) =>
        rule.selector.includes('[data-fork-tab-menu][data-side="bottom"][data-align="start"]'),
      ),
    ).toBe(true);
    const hung = inletRules.find(
      (rule) => rule.selector.includes("[data-fork-tab-menu]") && rule.selector.endsWith("::after"),
    )?.body;
    expect(hung).toContain("var(--anchor-width)");
    expect(hung).toContain("radial-gradient");
    expect(
      inletRules.some(
        (rule) =>
          rule.selector.includes('[data-slot="menu-popup"]') &&
          rule.body.includes("backdrop-filter: none"),
      ),
    ).toBe(true);
    // Menus and popovers share one 10px corner.
    expect(inlet).toContain("--fork-inlet-menu-radius: 10px;");
    const corners = inletRules.find(
      (rule) =>
        rule.selector.includes('[data-slot="menu-popup"]') &&
        rule.selector.includes('[data-slot="popover-popup"]') &&
        rule.body.includes("border-radius: var(--fork-inlet-menu-radius)"),
    );
    expect(corners).toBeDefined();
  });

  it("joins the model menu to its button and its rail to its list", () => {
    expect(readSibling("../overrides/components/chat/ProviderModelPicker.tsx")).toContain(
      "data-fork-tab-menu=",
    );
    // The mode menu hangs from its chip, on whichever side it opens.
    for (const side of ["bottom", "top"]) {
      const tab = inletRules.find(
        (rule) =>
          rule.selector.includes(":has([data-composer-permissions])") &&
          rule.selector.endsWith(`[data-side="${side}"]::after`),
      )?.body;
      expect(tab, side).toContain("radial-gradient");
    }
    // The usage readout beside it hangs from its bar the same way.
    const usage = readSibling("../custom/ComposerUsageLimitsReadout.tsx");
    expect(usage).toContain('data-fork-tab-menu="composer"');
    expect(usage).toContain('data-fork-tab-trigger=""');
    const upward = inletRules.find(
      (rule) => rule.selector.includes('[data-side="top"]') && rule.selector.endsWith("::after"),
    )?.body;
    expect(upward).toContain("var(--anchor-width)");
    const rail = inletRules.find(
      (rule) =>
        rule.selector.includes('[data-fork-model-picker="providers"]') &&
        rule.selector.endsWith('[aria-current="true"]::after'),
    )?.body;
    expect(rail).toContain("radial-gradient");
    const list = inletRules.find((rule) =>
      rule.selector.endsWith('[data-fork-model-picker="list"]'),
    )?.body;
    expect(list).toContain("margin: 4px 4px 4px 0");
    // The morph finds the docked details card's button by its stamp, not its label.
    const panelControls = readSibling("../components/chat/PanelLayoutControls.tsx");
    expect(panelControls).toContain('data-fork-details-toggle=""');
    expect(readSibling("../custom/inletMenuMorph.ts")).toContain(
      '[data-fork-details-toggle][aria-pressed="true"]',
    );
  });

  it("pre-paints the colour's frame and stamps it with the palette", () => {
    for (const color of INLET_COLORS) {
      const option = INLET_COLOR_OPTIONS[color];
      expect(indexHtml).toContain(
        `${color.includes("-") ? JSON.stringify(color) : color}: { frame: "${option.frame}", appearance: "${option.appearance}" }`,
      );
    }
    expect(indexHtml).toContain('window.localStorage.getItem("t3code:fork-inlet-color")');
    expect(indexHtml).toContain('setAttribute("data-fork-inlet-color", forkInletColor)');
    expect(indexHtml).toMatch(
      /html\.dark\[data-fork-theme="inlet"\] body\s*\{[^}]*background:\s*#232322/u,
    );
    expect(indexHtml).toMatch(
      /html\[data-fork-theme="inlet"\]:is\(\s*\[data-fork-inlet-color="green"\],[^)]*\)\s*body\s*\{[^}]*background:\s*#21835c/u,
    );
    expect(indexHtml).toContain("fork:begin fork-inlet-theme");
  });

  it("keeps every Inlet rule inside the palette scope", () => {
    for (const rule of [...inletRules, ...paletteRules]) {
      if (!rule.body.includes("--fork-inlet-")) continue;
      // Keyframe stops (0%, from) have no selector to scope; their @keyframes is.
      if (/^(?:from|to|[\d.]+%)(?:\s*,\s*(?:from|to|[\d.]+%))*$/u.test(rule.selector.trim()))
        continue;
      expect(rule.selector, rule.selector).toContain(`[data-fork-theme="${INLET_THEME}"]`);
    }
  });
});
