/**
 * The fork's design-system lint rules — see `.fork/DESIGN-RULES.md`.
 *
 * The per-file TSX half runs in oxlint: the root vite.config.ts appends DESIGN_LINT_OVERRIDES.
 * The CSS and cross-file half is `.fork/design-lint.mjs`.
 */

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
  "[text-box:trim-both_cap_alphabetic]",
  // Grid tracks made only of fr, auto and minmax(0, …): proportions, not sizes, so no token.
  "grid-cols-[auto_minmax(0,1fr)]",
  "grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
  // The status mark's 1.5px stroke and its sub-pixel optical nudges: hairlines stay px.
  "border-[1.5px]",
  "-mx-[1.5px]",
  "-my-[0.5px]",
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
  // A rem text size times the Interface font size's text scale (#472): the text-* tokens' own form.
  "text-[length:calc(0.6875rem*var(--fork-interface-text-scale,1))]",
  // More viewport and container clamps: the vw/vh/%/anchor term is the point.
  "max-w-[min(22rem,calc(100vw-2rem))]",
  "max-w-[calc(100vw-3rem)]",
  "max-h-[min(28rem,calc(var(--available-height)-1rem))]",
  "min-w-[min(100%,11rem)]",
  // Flex proportions in the PR header: how the branch names share the row, not sizes.
  "max-w-[40%]",
  "shrink-[12]",
  // Grid tracks: a fixed label or avatar column beside fr/auto tracks, and the sidebar's
  // scale-following row heights with their px floors.
  "grid-cols-[4.5rem_minmax(0,1fr)]",
  "grid-cols-[32px_minmax(0,1fr)_auto]",
  "grid-cols-[repeat(auto-fit,minmax(56px,1fr))]",
  "grid-rows-[max(16px,var(--spacing-sidebar-16))_max(14px,var(--spacing-sidebar-14))]",
  // Built only from tokens: the titlebar controls' inset, and a 1px rim in --color-border.
  "pl-[calc(var(--workspace-controls-left)+var(--workspace-titlebar-control-size)+var(--workspace-titlebar-control-gap))]",
  "shadow-[inset_0_1px_0_var(--color-border)]",
  // Nested corners: a parent's radius less the inset or rim between them.
  "rounded-t-[11px]",
  "rounded-[calc(var(--radius-sm)-2px)]",
  // Sidebar header rows round at 10px, between rounded-lg and rounded-xl.
  "rounded-[10px]",
  "focus-visible:rounded-[10px]",
  // Thread tab titles fade out under their hover actions: mask stops, not sizes.
  "group-focus-within/tab:[mask-image:linear-gradient(to_right,#000_calc(100%-3.5rem),#0000_calc(100%-2.75rem))]",
  "group-hover/tab:[mask-image:linear-gradient(to_right,#000_calc(100%-3.5rem),#0000_calc(100%-2.75rem))]",
  "group-focus-within/tab:[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),#0000_calc(100%-1.25rem))]",
  "group-hover/tab:[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),#0000_calc(100%-1.25rem))]",
  // A keyframes name with its timing: Tailwind has no utility for a fork keyframe.
  "animate-[sidebar-v2-film_linear_infinite]",
  // The status mark's size inside the usage popover's 16px slot.
  "[--fork-mark-size:14px]",
  // The Petal card's badge, placed from Figma's 2/3-scale frame.
  "right-[6.33px]",
  "size-[10.67px]",
  // One-off shadows and rings with no shadow token yet: the Petal mascot's rim, the music
  // strip's drop, and design mode's swatch rings and active-dot glow.
  "shadow-[inset_0_0_0_1px_rgb(0_0_0/0.24)]",
  "dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.24)]",
  "shadow-[0_12px_32px_-18px_rgb(0_0_0/45%)]",
  "shadow-[0_0_0_1px_rgba(0,0,0,0.4)]",
  "shadow-[0_0_6px_1px_var(--fork-design-accent-bg),0_0_2px_var(--fork-design-accent)]",
  // Design mode's swatches and code chips keep the Forge panel's 3px corners and 9px mono.
  "rounded-[3px]",
  "text-[9px]",
];

/**
 * Files where one rule stays off until the maintainer makes a design call (Nov 25, 2026). Each
 * entry is a decision, not an exception: settle it, fix the file, and delete the line. A new
 * file never joins this list.
 */
export const DESIGN_LINT_PENDING = {
  // B4: Hugeicons drawn from the icon package's raw data through the shim's HugeGlyph (masked
  // marks, design mode's icon sets). Moving them into the shim's table is the call.
  "t3code/no-direct-icon-imports": [
    "apps/web/src/custom/BackgroundWorkLayersMark.tsx",
    "apps/web/src/custom/SidebarV2SubagentCount.tsx",
    "apps/web/src/custom/designMode/panel/LayerTypeIcon.tsx",
    "apps/web/src/custom/designMode/panel/PanelIcons.tsx",
  ],
};

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
  {
    // Design mode's panel is the Forge editor's own dense control set (fields, steppers, swatches,
    // canvas controls), sized and styled as one instrument; Button's press scale and hit area would
    // break its 22px rows.
    files: ["apps/web/src/custom/designMode/panel/**"],
    rules: { "t3code/no-hand-built-primitives": "off" },
  },
  ...Object.entries(DESIGN_LINT_PENDING).map(([rule, files]) => ({
    files,
    rules: { [rule]: "off" },
  })),
];
