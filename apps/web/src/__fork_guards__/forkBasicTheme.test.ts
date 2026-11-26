// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-basic-theme`. Basic is the default theme; a lost
 * default, a pre-paint out of step with the sheet, or lost Settings cards each fail here.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import {
  BASIC_APPEARANCES,
  BASIC_OPTIONS,
  BASIC_THEME,
  FORK_PALETTES,
  FORK_THEME_ATTRIBUTE,
  readForkPalette,
  resolveActiveForkPalette,
} from "../custom/forkTheme";
import { FORK_MARKER_ATTRIBUTE, FORK_MARKER_VALUE } from "../custom/forkMarker";
import { BASIC_NEW_AGENT_BACKDROPS } from "../custom/basicNewAgentBackdropSetting";
import { DITHER_CELLS, JOLLY_PETAL_CELLS, MOUNTAIN_CELLS } from "../custom/basicNewAgentDither";
import { cssRules, declarationHex, ruleBodyFor } from "./cssRules";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const BASIC = `:root[${FORK_MARKER_ATTRIBUTE}="${FORK_MARKER_VALUE}"][${FORK_THEME_ATTRIBUTE}="${BASIC_THEME}"]`;
const sheet = readSibling("../theme.custom.basic.css");
const rules = cssRules(sheet);
const palettes = readSibling("../theme.custom.palettes.css");
const indexHtml = readSibling("../../index.html");
const appearancePanel = readSibling("../components/settings/AppearanceSettingsPanel.tsx");

describe("fork guard: fork-basic-theme", () => {
  it("is one of exactly three themes, and the default", () => {
    expect([...FORK_PALETTES].toSorted()).toEqual(["basic", "cool-darker", "inlet"]);
    expect(readForkPalette()).toBe(BASIC_THEME);
    for (const theme of ["light", "dark", "system"]) {
      expect(resolveActiveForkPalette({ theme, palette: BASIC_THEME })).toBe(BASIC_THEME);
    }
    // An imported theme, or a mix half for the rendered appearance, is not Basic's to paint.
    expect(resolveActiveForkPalette({ theme: "t3-grove", palette: BASIC_THEME })).toBeNull();
    expect(
      resolveActiveForkPalette({ theme: "dark", palette: BASIC_THEME, hasHalf: true }),
    ).toBeNull();
  });

  it("builds every surface from the tone's one colour", () => {
    expect(palettes).toContain('@import "./theme.custom.basic.css";');
    const root = ruleBodyFor(rules, [BASIC]);
    expect(root).toMatch(/--background:\s*var\(--basic-base\)/u);
    expect(root).toMatch(
      /--basic-lift-2:\s*color-mix\(in srgb, var\(--basic-ink\) 8%, var\(--basic-base\)\)/u,
    );
    expect(root).toMatch(/--border:\s*var\(--basic-wash-2\)/u);
    // The sidebar is the stage's own surface, not a darker panel.
    const sidebar = ruleBodyFor(rules, [
      BASIC,
      ':is([data-app-sidebar], [data-sidebar-version="v2"], [data-fork-thread-tabs])',
    ]);
    expect(sidebar).toMatch(/--sidebar:\s*var\(--basic-base\)/u);
    expect(sidebar).toMatch(/--sidebar-row-selected:\s*var\(--basic-wash-2\)/u);
    // Dark tones lay white over the base, light tones black.
    expect(ruleBodyFor(rules, [`${BASIC}.dark`])).toMatch(/--basic-ink:\s*#ffffff/u);
    expect(ruleBodyFor(rules, [`${BASIC}:not(.dark)`])).toMatch(/--basic-ink:\s*#000000/u);
  });

  it("states each appearance's tone once, in the sheet and the pre-paint alike", () => {
    for (const appearance of BASIC_APPEARANCES) {
      const { base, text } = BASIC_OPTIONS[appearance];
      const body = ruleBodyFor(rules, [
        appearance === "dark" ? `${BASIC}.dark` : `${BASIC}:not(.dark)`,
      ]);
      expect(declarationHex(body, "--basic-base"), appearance).toBe(base);
      // BasicNewAgentBackdrop inks its texture from the table.
      expect(declarationHex(body, "--basic-text"), appearance).toBe(text);
      const html =
        appearance === "dark"
          ? 'html.dark[data-fork-theme="basic"]'
          : 'html[data-fork-theme="basic"]:not(.dark)';
      expect(indexHtml.replace(/\s+/gu, " "), appearance).toContain(
        `${html} body { background: ${base};`,
      );
    }
  });

  it("opens dialogs, toasts and the web context menu flat, not frosted", () => {
    const bodyOf = (...parts: string[]) =>
      rules.find((rule) => parts.every((part) => rule.selector.includes(part)))?.body ?? "";
    const flat = bodyOf(`${BASIC} .dropdown-glass`, `${BASIC} .dialog-glass`);
    expect(flat).toMatch(/background:\s*var\(--popover\)/u);
    expect(flat).toMatch(/(^|[^-])backdrop-filter:\s*none/u);
    // The scrim is shared with Inlet (theme.custom.css); the dialog radius is Inlet's alone.
    const shared = cssRules(readSibling("../theme.custom.css"));
    const scrim = shared.find(
      (rule) =>
        rule.selector.includes('[data-fork-theme="basic"]') &&
        rule.selector.includes(".dialog-backdrop"),
    );
    expect(scrim?.body).toMatch(/(^|[^-])backdrop-filter:\s*none/u);
    // Dialogs and page cards keep Flat Glass's corners: upstream's 16px and 12px.
    expect(sheet).not.toMatch(/--fork-dialog-radius/u);
    expect(
      shared.some(
        (rule) =>
          rule.selector.includes('[data-fork-theme="basic"]') &&
          /border-radius:\s*var\(--fork-dialog-radius\)/u.test(rule.body),
      ),
    ).toBe(false);
    expect(bodyOf(BASIC, '[data-slot="settings-group"]', "[data-scheduled-card]")).not.toMatch(
      /border-radius/u,
    );
  });

  it("shares every Flat Glass shape and sets only colours", () => {
    // A selector shares Flat Glass's shapes when one :is() names Flat Glass and Basic, in any order.
    // The shared block's head names those two alone; a rule that adds another theme stands apart.
    const isGroups = (text: string) => [...text.matchAll(/:is\(((?:[^()]|\([^()]*\))*)\)/gu)];
    const namesOnlyFlatAndBasic = (args: string) =>
      namesFlatAndBasic(args) && args.split(",").length === 2;
    const namesFlatAndBasic = (args: string) =>
      args.includes('[data-fork-theme="basic"]') &&
      args.includes('[data-fork-glass-3d="off"]') &&
      args.includes('[data-fork-theme="cool-darker"]');
    const sharesFlatGlass = (selector: string) =>
      isGroups(selector).some(([, args]) => namesFlatAndBasic(args ?? ""));
    // That predicate heads one block in palettes.css, the home of every shape Basic shares.
    expect(isGroups(palettes).filter(([, args]) => namesOnlyFlatAndBasic(args ?? ""))).toHaveLength(
      1,
    );
    const paletteRules = cssRules(palettes);
    const shared = paletteRules.filter((rule) => sharesFlatGlass(rule.selector));
    expect(
      shared.some(
        (rule) =>
          rule.selector.includes("[data-fork-thread-row]") &&
          /border-radius:\s*var\(--fork-flat-radius\)/u.test(rule.body),
      ),
    ).toBe(true);
    expect(shared.some((rule) => rule.selector.includes("[data-fork-stage-card-title]"))).toBe(
      true,
    );
    // No other rule draws a shape for Basic, and Basic's sheet adds only the popups' shadow.
    const shape =
      /(^|[;{\s])(border-radius|corner-shape|box-shadow|outline(-\w+)?|border(-(top|right|bottom|left))?(-width)?|padding[\w-]*|margin[\w-]*|gap|width|height)\s*:/u;
    const elsewhere = paletteRules.filter(
      (rule) =>
        rule.selector.includes('[data-fork-theme="basic"]') && !sharesFlatGlass(rule.selector),
    );
    for (const rule of elsewhere) expect(rule.body).not.toMatch(shape);
    for (const rule of rules) {
      expect(rule.body.replace(/box-shadow:\s*var\(--basic-popup-shadow\);?/gu, "")).not.toMatch(
        shape,
      );
    }
  });

  it("draws switches green with a white thumb", () => {
    const switches = sheet.slice(sheet.indexOf(`${BASIC} [data-slot="switch"] {`));
    expect(switches).toMatch(
      /^[^{]+\{\s*&\[data-checked\] \{\s*background-color: var\(--fork-basic-switch-on\);/u,
    );
    expect(sheet).toMatch(/--fork-basic-switch-on: oklch\(59\.6% 0\.145 163\.225\);/u);
    expect(switches).toMatch(
      /& > \[data-slot="switch-thumb"\] \{\s*background-color: var\(--fork-white\);/u,
    );
  });

  it("leads Appearance with the theme cards", () => {
    const cards = appearancePanel.indexOf("<ForkThemePicker");
    expect(cards).toBeGreaterThanOrEqual(0);
    expect(cards).toBeLessThan(appearancePanel.indexOf("<ThemeLibrary"));
  });

  it("offers the dither pictures behind a new agent, one PNG pixel per cell", () => {
    expect(appearancePanel).toMatch(
      /appearance === BASIC_THEME \? \(\s*<SettingsRow\s*title="New agent background"/u,
    );
    expect(BASIC_NEW_AGENT_BACKDROPS).toEqual(["texture", "dither", "mountain", "jollyPetal"]);
    expect(readSibling("../components/ChatView.tsx")).toContain(
      "<BasicNewAgentBackdrop shown={isDraftHeroState && !embedded && !rightPanelMaximized} />",
    );
    for (const [asset, cells] of [
      ["basic-new-agent-dither.png", DITHER_CELLS],
      ["basic-new-agent-mountain.png", MOUNTAIN_CELLS],
      ["basic-new-agent-jolly-petal.png", JOLLY_PETAL_CELLS],
    ] as const) {
      const png = NodeFS.readFileSync(
        NodeURL.fileURLToPath(new URL(`../custom/assets/${asset}`, import.meta.url)),
      );
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], asset).toEqual([
        cells.width,
        cells.height,
      ]);
    }
  });
});
