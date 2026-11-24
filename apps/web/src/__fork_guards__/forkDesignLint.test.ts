// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-design-lint` and `.fork/DESIGN-RULES.md`.
 *
 * One passing and one failing case per CSS and cross-file rule in `.fork/design-lint.mjs`. The
 * TSX rules are oxlint rules with their own tests in oxlint-plugin-t3code/rules/.
 */

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

// Namespace import on one line: @ts-expect-error applies to the line that follows it.
// @ts-expect-error — plain .mjs module without type declarations, like lint-owned.mjs.
import * as DesignLint from "../../../../.fork/design-lint.mjs";

interface Finding {
  readonly rule: string;
  readonly line: number;
  readonly message: string;
  readonly kind?: string;
  readonly fix?: string;
  readonly hint?: string;
}

const ROOT = ':root[data-fork="noahhendrickson-t3code"]';
const BASIC = `${ROOT}[data-fork-theme="basic"]`;
const INLET = `${ROOT}[data-fork-theme="inlet"]`;
const SLOTS = new Set(["button", "menu-popup"]);

const sheet = (css: string, path = "apps/web/src/theme.custom.test.css") =>
  DesignLint.loadStylesheet(path, css);

const check = (css: string): readonly Finding[] =>
  DesignLint.checkStylesheet(sheet(css), SLOTS) as readonly Finding[];

const rules = (findings: readonly Finding[]) => findings.map((finding) => finding.rule);

describe("fork guard: fork-design-lint", () => {
  describe("A1 raw colours", () => {
    it("allows raw colours in a token block, tokens and keywords elsewhere", () => {
      const css = `
        ${BASIC}.dark { --basic-ink: #ffffff; --basic-shadow: 0 1px 2px rgb(0 0 0 / 16%); }
        ${ROOT} .fork-x {
          color: var(--foreground);
          border-color: color-mix(in srgb, var(--basic-ink) 8%, transparent);
          background: rgb(from var(--background) r g b / 50%);
          mask-image: linear-gradient(black, transparent);
          box-shadow: var(--tw-ring-shadow, 0 0 #0000);
          animation: red-pulse 2s;
        }`;
      expect(rules(check(css))).not.toContain("A1");
    });

    it("reports hex, colour functions and named colours outside a token block", () => {
      const css = `${ROOT} .fork-x {
        color: #fff;
        background: rgb(0 0 0 / 20%);
        border-color: white;
        --fork-x-ink: #333;
      }`;
      expect(rules(check(css)).filter((rule) => rule === "A1")).toHaveLength(4);
    });
  });

  describe("A2-A4 raw geometry and type", () => {
    it("allows tokens, the spacing scale, zero and hairlines", () => {
      const css = `${ROOT} .fork-x {
        border-radius: var(--radius-lg);
        padding: calc(var(--spacing) * 2) 0;
        margin-top: -1px;
        height: 1px;
        font-size: var(--text-sm);
        line-height: 1;
      }`;
      expect(rules(check(css))).toEqual([]);
    });

    it("reports px radii, px spacing and literal type", () => {
      const css = `${ROOT} .fork-x {
        border-radius: 10px;
        gap: 6px;
        min-height: calc(100% - 8px);
        font-size: 13px;
        line-height: 1.4;
      }`;
      expect(rules(check(css))).toEqual(["A2", "A3", "A3", "A4", "A4"]);
    });
  });

  describe("C1/C2 primitives", () => {
    it("allows tokens and paint on a primitive, and geometry on fork elements", () => {
      const css = `
        ${ROOT} [data-slot="button"] { --control-radius: 8px; }
        ${ROOT} [data-slot="button"] { color: var(--foreground); }
        ${ROOT} [data-fork-chip] { padding: var(--fork-chip-pad); }
        ${ROOT} :not([data-slot="button"]).fork-x { padding: var(--fork-chip-pad); }
        ${ROOT} [data-slot="menu-popup"] > div { height: var(--fork-row-height); }`;
      expect(rules(check(css))).toEqual([]);
    });

    it("reports geometry on a primitive and cancelling its own paint", () => {
      const css = `
        ${ROOT} [data-slot="button"] { border-radius: var(--fork-pill-radius); }
        ${ROOT} [data-slot="menu-popup"]::before { display: none; }
        ${ROOT} :is(button, [data-slot="button"]) { box-shadow: none; }`;
      expect(rules(check(css))).toEqual(["C1", "C2", "C2"]);
    });
  });

  describe("C6 per-theme restatements", () => {
    const run = (css: string) =>
      DesignLint.checkDuplicatedThemeBlocks([sheet(css)]) as readonly Finding[];

    it("allows one rule over several roots, and per-theme token blocks", () => {
      const css = `
        :is(${BASIC}, ${INLET}) .fork-x { background: var(--fork-x-bg); }
        ${BASIC} .fork-y, ${INLET} .fork-y { color: var(--fork-y-ink); }
        ${BASIC} { --fork-x-bg: var(--basic-lift-2); }
        ${INLET} { --fork-x-bg: var(--inlet-lift-2); }
        ${INLET}[data-fork-has-stage-card] .fork-z { color: red; }
        ${INLET}[data-fork-has-chat-column] .fork-z { color: red; }`;
      expect(run(css)).toEqual([]);
    });

    it("reports identical and same-shape restatements across theme roots", () => {
      const css = `
        ${BASIC} .fork-x { background: var(--accent); }
        ${INLET} .fork-x { background: var(--accent); }
        ${BASIC} .fork-y { color: var(--basic-text); }
        ${INLET} .fork-y { color: var(--inlet-text); }`;
      expect(run(css).map((finding) => finding.kind)).toEqual(["identical", "same-shape"]);
    });
  });

  describe("C3 theme contract", () => {
    const run = (css: string) => {
      const sheets = [sheet(css)];
      const definitions = DesignLint.buildTokenIndex(sheets);
      const consumers = [
        {
          name: "--fork-x",
          fallback: false,
          themes: ["basic-light", "inlet-cream"],
          file: "x",
          line: 1,
        },
        { name: "--fork-y", fallback: true, themes: ["basic-light"], file: "x", line: 2 },
        { name: "--tw-ring-shadow", fallback: false, themes: ["basic-light"], file: "x", line: 3 },
      ];
      return DesignLint.checkThemeContract(consumers, definitions) as readonly Finding[];
    };

    it("passes when every theme a consumer applies in defines the token", () => {
      expect(run(`${BASIC} { --fork-x: red; } ${INLET} { --fork-x: blue; }`)).toEqual([]);
    });

    it("reports the theme a token is missing from", () => {
      const findings = run(`${BASIC} { --fork-x: red; } ${INLET}:not(.dark) { --fork-x: blue; }`);
      expect(findings.map((finding) => finding.message)).toEqual([
        "--fork-x is not defined in inlet-cream",
      ]);
    });
  });

  describe("theme matching", () => {
    it("knows which enforced themes a root compound selects", () => {
      expect(DesignLint.themesFor(`${ROOT}[data-fork-theme="basic"]:not(.dark) .x`)).toEqual([
        "basic-light",
      ]);
      expect(
        DesignLint.themesFor(
          `${ROOT}[data-fork-glass-3d="off"].dark[data-fork-theme="cool-darker"]`,
        ),
      ).toEqual(["flat-glass"]);
      expect(DesignLint.themesFor(`${ROOT}.wco[data-fork-theme="inlet"] .x`)).toEqual([
        "inlet-black",
        "inlet-cream",
      ]);
      // Cream sits on dark and Black on light (forkTheme.ts INLET_COLOR_OPTIONS).
      expect(DesignLint.themesFor(`${ROOT}.dark[data-fork-theme="inlet"] .x`)).toEqual([
        "inlet-cream",
      ]);
      expect(DesignLint.themesFor(`[data-slot="button"]`)).toHaveLength(6);
    });

    it("never blocks on a finding only Glass 3D can see", () => {
      expect(DesignLint.isBlocking({ rule: "A1", themes: ["glass-3d"] })).toBe(false);
      expect(DesignLint.isBlocking({ rule: "A1", themes: ["glass-3d", "flat-glass"] })).toBe(true);
      expect(DesignLint.isBlocking({ rule: "B5" })).toBe(true);
    });
  });

  describe("C5 dead selectors", () => {
    const run = (css: string, source: string) =>
      DesignLint.checkDeadForkAttributes([sheet(css)], source) as readonly Finding[];

    it("allows attributes source sets, literally or through dataset", () => {
      const css = `${ROOT} [data-fork-chip="solo"] { color: red; } ${ROOT} [data-fork-morphing] { color: red; }`;
      const source = `<div data-fork-chip={solo ? "solo" : "pair"} />; trigger.dataset.forkMorphing = "";`;
      expect(run(css, source)).toEqual([]);
    });

    it("reports an attribute or a value nothing sets", () => {
      const css = `${ROOT} [data-fork-gone] { color: red; } ${ROOT} [data-fork-chip="trio"] { color: red; }`;
      expect(run(css, `<div data-fork-chip="solo" />`).map((finding) => finding.message)).toEqual([
        "[data-fork-gone] is set nowhere in source",
        '[data-fork-chip="trio"]: no source sets "trio"',
      ]);
    });
  });

  describe("B5 stories", () => {
    it("finds exported components and the names a story imports", () => {
      const source = `
export function ForkChip() {}
export const ForkRow = memo(function ForkRow() {});
export const FORK_LEVELS = ([1, 2]);
export function ForkThemeProvider() {}
function Local() {}`;
      expect(
        DesignLint.exportedComponents(source).map((entry: { name: string }) => entry.name),
      ).toEqual(["ForkChip", "ForkRow"]);
      const story = `import { ForkChip, type ForkChipProps } from "~/custom/ForkChip";\nimport { Button } from "~/components/ui/button";`;
      expect([...DesignLint.storyImports(story)]).toEqual(["ForkChip", "ForkChipProps"]);
    });
  });

  describe("suppressions", () => {
    const css = (reason: string) => `${ROOT} .fork-x {
  /* design-lint-disable-next-line A3${reason} */
  gap: 6px;
  /* design-lint-disable-next-line A2 -- nothing to hide */
  color: var(--foreground);
}`;
    const run = (text: string) => {
      const stylesheet = sheet(text);
      return DesignLint.applySuppressions(DesignLint.checkStylesheet(stylesheet, SLOTS), [
        stylesheet,
      ]) as readonly Finding[];
    };

    it("hides a finding the comment names and gives a reason for", () => {
      expect(rules(run(css(" -- the Figma gap")))).toEqual(["S2"]);
    });

    it("reports a suppression without a reason", () => {
      expect(rules(run(css("")))).toEqual(["S1", "S2"]);
    });
  });

  describe("classification", () => {
    it("calls a raw value with a same-valued token or scale step mechanical", () => {
      const tokens = sheet(
        `${ROOT} { --spacing: 0.25rem; --radius-lg: 0.5rem; --fork-ink: #ffffff; }`,
      );
      const findings = DesignLint.checkStylesheet(
        sheet(`${ROOT} .fork-x { border-radius: 8px; gap: 6px; color: #fff; width: 7px; }`),
        SLOTS,
      );
      const classified = DesignLint.classify(
        findings,
        DesignLint.buildTokenIndex([tokens]),
      ) as readonly Finding[];
      expect(classified.map((finding) => [finding.rule, finding.fix])).toEqual([
        ["A2", "mechanical"],
        ["A3", "mechanical"],
        ["A1", "mechanical"],
        ["A3", "new-token"],
      ]);
    });
  });

  it("keeps the design rules out of CI until the switch flips", () => {
    const repoRoot = NodePath.resolve(
      NodeURL.fileURLToPath(new URL(".", import.meta.url)),
      "../../../..",
    );
    const rulesModule = NodeFS.readFileSync(
      NodePath.join(repoRoot, ".fork/design-rules.mjs"),
      "utf8",
    );
    const ci = NodeFS.readFileSync(NodePath.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
    const blocking = /export const DESIGN_LINT_BLOCKING = (true|false);/u.exec(rulesModule)?.[1];
    // The vite.config switch and the CI step move together.
    const ciStepOn = /^\s+run: node \.fork\/design-lint\.mjs --check$/mu.test(ci);
    expect(blocking === "true").toBe(ciStepOn);
  });
});
