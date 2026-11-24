/**
 * The fork's design-system lint rules — see `.fork/DESIGN-RULES.md`.
 *
 * The per-file TSX half runs in oxlint; the root vite.config.ts reads this table. The CSS and
 * cross-file half is `.fork/design-lint.mjs`, which also runs this table through
 * `vp lint` in report mode.
 */

/**
 * The switch. While false, the rules below run only when `.fork/design-lint.mjs --report` sets
 * DESIGN_LINT_ENV, so `vp lint` and CI stay as they are. Flip it to true once the inventory reads
 * zero, together with the `--check` step in .github/workflows/ci.yml.
 */
export const DESIGN_LINT_BLOCKING = false;

/** `vp lint` turns the rules on when this is "1" (report mode sets it). */
export const DESIGN_LINT_ENV = "T3CODE_FORK_DESIGN_LINT";

/** Fork-owned TSX: new modules and the upstream modules the fork shadows. */
export const DESIGN_LINT_TSX_SCOPE = ["apps/web/src/custom/**", "apps/web/src/overrides/**"];

/**
 * Overrides are upstream modules, so the rules about what fork code builds by hand stay on
 * custom/ only; the shadcn rules are upstream's own and hold for both.
 */
export const DESIGN_LINT_CUSTOM_ONLY_SCOPE = ["apps/web/src/custom/**"];

const NOT_IN_TESTS = [
  "**/*.{test,spec,bench}.{ts,tsx}",
  "**/*.browser.test.{ts,tsx}",
  // Vendored from NoahHendrickson/the-forge; kept verbatim for re-syncs.
  "apps/web/src/custom/designMode/engine/vendor/**",
];

/**
 * A5's allowlist on top of upstream's (vite.config.ts): values a token cannot express. Each one
 * says why; add one only with the same.
 */
export const DESIGN_ARBITRARY_VALUE_ALLOW = [
  // Upstream also allows "layout", which waves through h-[26px] and w-[13px]; A5 does not.
  "transition",
  // Upstream's own: em insets that keep inline chips on the text's own scale.
  "rounded-[inherit]",
  "gap-[0.33em]",
  "gap-[0.2em]",
  "leading-[normal]",
  "underline-offset-[0.2em]",
  "rounded-[25%]",
  "text-[length:80cqh]",
  "bg-[Highlight]",
  // Properties Tailwind has no utility for, set to a keyword: there is no value to tokenise.
  "[-webkit-app-region:no-drag]",
  "[scrollbar-width:none]",
  "[scrollbar-width:thin]",
  "[content-visibility:auto]",
  "[image-rendering:pixelated]",
  // Grid tracks made only of fr/auto, and the container width where the music strip's three
  // columns stop fitting: structure, with no size a token would name.
  "grid-cols-[1fr_1fr_auto]",
  "grid-cols-[1fr_auto_1fr]",
  "@max-[14.5rem]/strip:grid-cols-[auto_1fr]",
  "grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]",
  // content-visibility:auto's placeholder height for an off-screen music row (rem already).
  "[contain-intrinsic-size:auto_2.75rem]",
  "[contain-intrinsic-size:auto_2rem]",
  // Viewport clamps on one-off popovers and scrollers: the vh/vw term is the point.
  "max-h-[60vh]",
  "h-[min(20rem,30vh)]",
  "w-[min(32rem,calc(100vw-2rem))]",
  "w-[min(24rem,calc(100vw-2rem))]",
  // The music seek bar's fill: a gradient sized by the --fill the component sets, on tokens.
  "[background:linear-gradient(var(--muted-foreground),var(--muted-foreground))_0_0/var(--fill)_100%_no-repeat,var(--border)]",
];

/** oxlint rule id → the rule in DESIGN-RULES.md it enforces. */
export const DESIGN_OXLINT_RULE_IDS = {
  "shadcn/no-raw-colors": "A1",
  "shadcn/no-arbitrary-values": "A5",
  "shadcn/no-restyle": "B1",
  "t3code/no-hand-built-primitives": "B2",
  "t3code/no-hand-built-status-marks": "B3",
  "t3code/no-direct-icon-imports": "B4",
};

/** The overrides vite.config.ts appends to `lint.overrides`, after the block that turns shadcn off. */
export const DESIGN_LINT_OVERRIDES = [
  {
    files: DESIGN_LINT_TSX_SCOPE,
    excludeFiles: NOT_IN_TESTS,
    rules: {
      "shadcn/no-raw-colors": "error",
      "shadcn/no-arbitrary-values": ["error", { allow: DESIGN_ARBITRARY_VALUE_ALLOW }],
      "shadcn/no-restyle": [
        "error",
        {
          allow: ["layout"],
          contracts: [
            {
              // CollapsibleTrigger has no styled counterpart; other triggers use render={<Button …/>}.
              pattern: "^CollapsibleTrigger$",
              allow: ["layout", "color", "typography", "spacing", "shape", "effects", "motion"],
            },
          ],
        },
      ],
    },
  },
  {
    files: DESIGN_LINT_CUSTOM_ONLY_SCOPE,
    excludeFiles: NOT_IN_TESTS,
    rules: {
      "t3code/no-hand-built-primitives": "error",
      "t3code/no-hand-built-status-marks": "error",
      "t3code/no-direct-icon-imports": "error",
    },
  },
  {
    // The shim itself, and the one module that draws status marks.
    files: ["apps/web/src/custom/icons/**"],
    rules: { "t3code/no-direct-icon-imports": "off", "t3code/no-hand-built-status-marks": "off" },
  },
  {
    files: ["apps/web/src/custom/SidebarV2StatusIndicator.tsx"],
    rules: { "t3code/no-hand-built-status-marks": "off" },
  },
];
