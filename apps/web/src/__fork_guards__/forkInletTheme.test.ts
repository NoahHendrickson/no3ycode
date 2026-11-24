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
  DEFAULT_INLET_COLOR,
  INLET_BACKGROUND,
  INLET_COLOR_OPTIONS,
  INLET_COLORS,
  INLET_LABEL,
  INLET_THEME,
  forkPaletteAppearance,
  resolveActiveForkPalette,
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
const BLACK = `${TEMPLATE}[data-fork-inlet-color="black"]`;
const CREAM = `${TEMPLATE}[data-fork-inlet-color="cream"]`;
// The frame's tokens: the sidebar, and the collapsed sidebar's tab strip on the frame beside it.
const FRAME = ':is([data-sidebar-version="v2"], [data-fork-thread-tabs])';
const palettes = readSibling("../theme.custom.palettes.css");
/** The rule whose selector list names exactly this selector, alone or in a list. */
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
    expect(palettes).toContain(INLET_FILES.map((file) => `@import "./${file}";`).join("\n"));
  });

  it("offers Cream, the default, and its inverse Black, each on its own appearance", () => {
    expect(INLET_COLORS).toEqual(["black", "cream"]);
    expect(DEFAULT_INLET_COLOR).toBe("cream");
    expect(forkPaletteAppearance(INLET_THEME, "cream")).toBe("dark");
    expect(forkPaletteAppearance(INLET_THEME, "black")).toBe("light");
    expect(forkPaletteAppearance("cool-darker", "black")).toBe("dark");
    expect(
      resolveActiveForkPalette({ theme: "dark", palette: INLET_THEME, inletColor: "cream" }),
    ).toBe(INLET_THEME);
    expect(
      resolveActiveForkPalette({
        theme: "light",
        palette: INLET_THEME,
        isDark: false,
        inletColor: "black",
      }),
    ).toBe(INLET_THEME);
    expect(
      resolveActiveForkPalette({
        theme: "dark",
        palette: INLET_THEME,
        isDark: true,
        inletColor: "black",
      }),
    ).toBeNull();
    expect(
      resolveActiveForkPalette({
        theme: "light",
        palette: INLET_THEME,
        isDark: false,
        inletColor: "cream",
      }),
    ).toBeNull();
  });

  it("names no retired colour in any Inlet stylesheet or the pre-paint", () => {
    const named = [
      ...`${palettes}\n${inlet}\n${indexHtml}`.matchAll(/data-fork-inlet-color="([^"]+)"/gu),
    ].map((match) => match[1]);
    expect(new Set(named)).toEqual(new Set(INLET_COLORS));
  });

  it("paints Black as a #141414 frame round a cream panel, on light", () => {
    const stage = ruleBodyFor(paletteRules, [BLACK]);
    expect(declarationHex(stage, "--background")).toBe(INLET_COLOR_OPTIONS.black.frame);
    expect(declarationHex(stage, "--fork-inlet-panel")).toBe("#f8f3d8");
    const sidebar = paletteRules
      .filter((rule) => rule.selector.replace(/\s+/gu, " ").trim() === `${BLACK} ${FRAME}`)
      .map((rule) => rule.body)
      .join("\n");
    expect(sidebar).toContain("--sidebar: var(--fork-inlet-black-surface)");
    expect(declarationHex(stage, "--fork-inlet-black-surface")).toBe(
      INLET_COLOR_OPTIONS.black.frame,
    );
    expect(declarationHex(sidebar, "--sidebar-row-selected")).toBe("#f8f3d8");
  });

  it("paints Cream as a #141414 panel in a cream frame, on dark", () => {
    const stage = ruleNaming(paletteRules, [CREAM]);
    expect(declarationHex(stage, "--fork-inlet-panel")).toBe("#141414");
    const frame = paletteRules.find(
      (rule) => rule.selector.trim() === CREAM && rule.body.includes("--fork-inlet-frame:"),
    )?.body;
    expect(INLET_COLOR_OPTIONS.cream.frame).toBe(INLET_BACKGROUND);
    expect(declarationHex(frame ?? "", "--fork-inlet-frame")).toBe(INLET_BACKGROUND);
    expect(declarationHex(ruleBodyFor(paletteRules, [CREAM, FRAME]), "--sidebar")).toBe(
      INLET_COLOR_OPTIONS.cream.frame,
    );
  });

  it("declares every colour's frame, panel and row ink", () => {
    for (const color of INLET_COLORS) {
      const stage = {
        body: rootStageBody(color),
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
    // A settled thread's open row is the slim row; it takes the same corners, the nav rows' 10px.
    const openSelector = [
      `${TEMPLATE}[data-fork-inlet-color]`,
      '[data-sidebar-version="v2"]',
      '[data-fork-thread-row][aria-current="page"]',
    ].join(" ");
    const card = inletRules
      .filter((rule) => rule.selector.replace(/\s+/gu, " ").trim() === openSelector)
      .map((rule) => rule.body)
      .join("\n");
    expect(card).toMatch(/border-radius:\s*10px 0 0 10px/u);
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

  it("sets the prompt 4px inside a concentric vessel under 8px context chips", () => {
    const vessel = ruleBodyFor(inletRules, [TEMPLATE, "[data-fork-composer-vessel]"]);
    expect(vessel).toContain("border-radius: var(--fork-inlet-vessel-radius)");
    expect(vessel).toContain("--chat-composer-drawer-inset: var(--fork-inlet-vessel-inset)");
    expect(inlet).toContain(
      "--fork-inlet-vessel-radius: calc(var(--fork-composer-radius) + var(--fork-inlet-vessel-inset))",
    );
    expect(inlet).toContain("--fork-inlet-vessel-inset: 4px");
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
    // The usage readout hangs its limits menu from the ring, like the model menu.
    const usage = readSibling("../custom/ComposerUsageLimitsReadout.tsx");
    expect(usage).toContain('data-fork-tab-menu="composer"');
    expect(usage).toContain('data-fork-composer-usage-limits="true"');
    const upward = inletRules.find(
      (rule) => rule.selector.includes('[data-side="top"]') && rule.selector.endsWith("::after"),
    )?.body;
    expect(upward).toContain("var(--anchor-width)");
    const providers = inletRules.find((rule) =>
      rule.selector.endsWith('[data-fork-model-picker="providers"]'),
    )?.body;
    expect(providers).toContain("padding: 4px 4px 0");
    const list = inletRules.find((rule) =>
      rule.selector.endsWith('[data-fork-model-picker="list"]'),
    )?.body;
    expect(list).toContain("margin: 4px");
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
    for (const color of INLET_COLORS) {
      expect(indexHtml).toMatch(
        new RegExp(
          `html\\[data-fork-theme="inlet"\\]\\[data-fork-inlet-color="${color}"\\] body\\s*\\{[^}]*background:\\s*${INLET_COLOR_OPTIONS[color].frame}`,
          "u",
        ),
      );
    }
    expect(indexHtml).toContain("fork:begin fork-inlet-theme");
  });

  it("keeps dialogs solid and every pressed, lit and muted ink readable", () => {
    const bodyOf = (...parts: string[]) =>
      inletRules.find((rule) => parts.every((part) => rule.selector.includes(part)))?.body ?? "";
    // The palette, confirm dialogs and the web context menu are solid popups, never frosted.
    const dialogs = bodyOf(".dialog-glass", "[data-context-menu].dropdown-glass");
    expect(dialogs).toMatch(/background:\s*var\(--popover\)/u);
    expect(dialogs).toMatch(/(^|[^-])backdrop-filter:\s*none/u);
    // A press keeps the hover fill: the panel's fill under the frame's ink vanished.
    expect(bodyOf('[class*="active:bg-sidebar-row-active"]:active')).toMatch(
      /background-color:\s*var\(--sidebar-row-hover\)/u,
    );
    // The cream panel's faint ink is black 65% (H6).
    expect(declarationHex(ruleBodyFor(paletteRules, [BLACK]), "--muted-foreground")).toBe(
      "#57554c",
    );
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

describe("fork guard: fork-inlet-theme tooltip fill", () => {
  // Black's tooltips are ink over its cream panel and cream over its dark-ink surfaces.
  it("gives each tooltip the fill its trigger's surface declares", () => {
    const tooltip = readSibling("../components/ui/tooltip.tsx");
    expect(tooltip).toContain('getPropertyValue("--fork-inlet-tooltip")');
    expect(tooltip).toMatch(/if \(open\) setForkFill\(readForkTooltipFill\(details\.trigger\)\)/u);
    const palettes = readSibling("../theme.custom.palettes.css");
    expect(palettes).toMatch(
      /--fork-inlet-model-shell: var\(--fork-inlet-black-surface\);[^}]*--fork-inlet-tooltip: var\(--fork-inlet-black-surface\);\s*--fork-inlet-tooltip-foreground: var\(--fork-inlet-black-ink\);/u,
    );
    expect(palettes).toMatch(
      /--border: var\(--fork-inlet-black-line\);\s*--fork-inlet-tooltip: #fcfaee;\s*--fork-inlet-tooltip-foreground: #1c1c1a;/u,
    );
    // The open row is cream inside the dark sidebar, so its tooltips are ink again.
    expect(palettes).toMatch(
      /\[data-fork-thread-row\]\[aria-current="page"\],[^{]*\{\s*--fork-inlet-tooltip: var\(--fork-inlet-black-surface\);/u,
    );
  });
});
