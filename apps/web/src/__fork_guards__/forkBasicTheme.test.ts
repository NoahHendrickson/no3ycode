// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-basic-theme`. Basic is the default theme; a lost
 * default, a pre-paint out of step with the sheet, or lost Settings cards each fail here.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import {
  BASIC_THEME,
  BASIC_TONE_OPTIONS,
  BASIC_TONES,
  FORK_PALETTES,
  FORK_THEME_ATTRIBUTE,
  readForkPalette,
  resolveActiveForkPalette,
} from "../custom/forkTheme";
import { FORK_MARKER_ATTRIBUTE, FORK_MARKER_VALUE } from "../custom/forkMarker";
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

  it("states each tone's base once, in the sheet and the pre-paint alike", () => {
    for (const tone of BASIC_TONES) {
      const { base, text, appearance } = BASIC_TONE_OPTIONS[tone];
      const body = ruleBodyFor(rules, [`${BASIC}[data-fork-basic-tone="${tone}"]`]);
      expect(declarationHex(body, "--basic-base"), tone).toBe(base);
      // The texture inks from the table; the sheet sets the text per tone or per appearance.
      const appearanceBody = ruleBodyFor(rules, [
        appearance === "dark" ? `${BASIC}.dark` : `${BASIC}:not(.dark)`,
      ]);
      const sheetText = body.includes("--basic-text:") ? body : appearanceBody;
      expect(declarationHex(sheetText, "--basic-text"), tone).toBe(text);
      // An unquoted hyphenated key is a syntax error that stops the whole pre-paint script.
      const key = /^[a-z]+$/u.test(tone) ? tone : `"${tone}"`;
      expect(indexHtml, tone).toContain(`${key}: { base: "${base}", appearance: "${appearance}" }`);
      expect(indexHtml, tone).toMatch(
        new RegExp(
          `html\\[data-fork-theme="basic"\\]\\[data-fork-basic-tone="${tone}"\\] body \\{\\s*background: ${base};`,
          "u",
        ),
      );
    }
  });

  it("opens dialogs, toasts and the web context menu flat, not frosted", () => {
    const bodyOf = (...parts: string[]) =>
      rules.find((rule) => parts.every((part) => rule.selector.includes(part)))?.body ?? "";
    const flat = bodyOf(`${BASIC} .dropdown-glass`, `${BASIC} .dialog-glass`);
    expect(flat).toMatch(/background:\s*var\(--popover\)/u);
    expect(flat).toMatch(/(^|[^-])backdrop-filter:\s*none/u);
    // The scrim and dialog radius are shared with Inlet (theme.custom.css).
    const shared = cssRules(readSibling("../theme.custom.css"));
    const scrim = shared.find(
      (rule) =>
        rule.selector.includes('[data-fork-theme="basic"]') &&
        rule.selector.includes(".dialog-backdrop"),
    );
    expect(scrim?.body).toMatch(/(^|[^-])backdrop-filter:\s*none/u);
    expect(sheet).toMatch(/--fork-dialog-radius:\s*8px/u);
    expect(bodyOf(BASIC, '[data-slot="settings-group"]', "[data-scheduled-card]")).toMatch(
      /border-radius:\s*8px/u,
    );
  });

  it("draws switches green with a white thumb, and focused fields with a full-strength edge", () => {
    const switches = sheet.slice(sheet.indexOf(`${BASIC} [data-slot="switch"] {`));
    expect(switches).toMatch(
      /^[^{]+\{\s*&\[data-checked\] \{\s*background-color: var\(--success\);/u,
    );
    expect(switches).toMatch(/& > \[data-slot="switch-thumb"\] \{\s*background-color: #fff;/u);
    expect(switches).toMatch(
      /&\[data-mixed\] > \[data-slot="switch-thumb"\] \{\s*translate: none;\s*opacity: 1;/u,
    );
    const fields = sheet.slice(sheet.indexOf("@media (forced-colors: none) {"));
    expect(
      fields.startsWith(
        `@media (forced-colors: none) {\n  ${BASIC}\n    :is([data-slot="input-control"], [data-slot="textarea-control"]):has(`,
      ),
    ).toBe(true);
    expect(fields).toMatch(
      /:is\(input, textarea\):focus-visible\s*\) \{\s*outline: none;\s*&:not\(:has\(\[aria-invalid="true"\]\)\) \{\s*border-color: var\(--ring\);/u,
    );
  });

  it("leads Appearance with the theme cards and Basic's tones", () => {
    const cards = appearancePanel.indexOf("<ForkThemePicker");
    expect(cards).toBeGreaterThanOrEqual(0);
    expect(cards).toBeLessThan(appearancePanel.indexOf("<ThemeLibrary"));
    expect(appearancePanel).toMatch(/appearance === BASIC_THEME \?[\s\S]*?<ForkBasicTonePicker/u);
  });
});
