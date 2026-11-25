# Fork design rules

The fork's UI takes its values from tokens and its controls from `components/ui`. These rules
hold fork code to that. They cover fork-owned code only: `apps/web/src/custom/**`,
`apps/web/src/overrides/**`, every `apps/web/src/theme.custom*.css`, CSS under `custom/` and
`overrides/`, and the fork's fenced hunks in `index.css`.

Enforced themes: Flat Glass (primary), Basic Darker Neutral, Basic Light, Inlet Black and Inlet
Cream. Glass 3D gets best effort: its findings show up in the report but never block.

**Status: report only.** The rules don't block anything yet. They will once the inventory reads
zero (see [Switching on](#switching-on)). There's no ratchet or baseline: a rule either passes or it
fails.

## A. Values come only from tokens

| ID  | Rule                                                                                          | Why                                                                       | Use instead                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | No raw colours (hex, `rgb()`/`hsl()`/`oklch()`…, named colours) outside a theme's token block | A colour written in place can't follow a theme, and drifts unseen         | A token. Define it in the theme's token block: a rule under `:root…` that only sets `--custom-properties`                                    |
| A2  | No raw px `border-radius`                                                                     | Radii are a hierarchy (tight rows, softer popovers) and live in one place | `--radius-*`, or a named `--fork-*-radius` token                                                                                             |
| A3  | No raw px width, height, padding, gap or margin in fork CSS (0 and 1px hairlines are fine)    | Spacing off the scale is the most common drift                            | `calc(var(--spacing) * n)`, or a named size token                                                                                            |
| A4  | No raw `font-size` or `line-height` (`line-height: 1` is fine)                                | Type sizes follow the type settings and the scale                         | `--text-*`, `--leading-*`, `--text-sidebar-*`; px line heights take the spacing scale                                                        |
| A5  | No arbitrary Tailwind values in fork TSX (`text-[11px]`, `rounded-[10px]`, `h-[26px]`)        | Same as A1–A4, written as classes                                         | The scale utility (`text-2xs`, `rounded-lg`, `h-6.5`), or `(--token)` for a token. The short allowlist in `design-rules.mjs` has its reasons |

## B. Reuse components

| ID  | Rule                                                                                                                                               | Why                                                      | Use instead                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Don't restyle a `components/ui` export with `className` beyond layout                                                                              | The primitive owns its look; restyles fork the design    | A `variant` or `size`, or add one to the primitive                                                                                                              |
| B2  | No hand-built interactive primitives: a styled raw `<button>`, or `role="menu"`, `listbox`, `dialog`, `alertdialog` or `tooltip` on a host element | They miss the primitives' focus, keyboard and theme work | `Button`, `Menu`, `Select`/`Combobox`, `Dialog`/`Sheet`/`Popover`, `Tooltip`                                                                                    |
| B3  | Status marks come only from `custom/SidebarV2StatusIndicator.tsx`: no `CircleHalfIcon`, no hand-drawn status dots                                  | One status language across sidebar, tabs and chips       | `SidebarV2StatusMark` and its siblings                                                                                                                          |
| B4  | Icons come only from the Hugeicons shim, never an icon package directly                                                                            | The shim owns each glyph's stroke and fill policy        | `~/custom/icons/lucide-hugeicons`                                                                                                                               |
| B5  | Every exported **atomic** component in `custom/` (a button, chip, mark, row, card, menu, picker, indicator) has a Storybook story                  | The story is where Figma and code are compared           | A story in `apps/fork-storybook/stories`; a page, layout, section, provider or wrapper gets a `b5Exempt` entry in `design-lint.mjs` with its kind as the reason |

B4 applies to `custom/` only. Upstream files (and their copies in `overrides/`) keep
`from "lucide-react"`, which the build aliases to the shim.

## C. Theme CSS

| ID  | Rule                                                                                                                                               | Why                                                                              | Use instead                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| C1  | Theme CSS sets no geometry (width/height, padding, border-radius, font-size) on a `components/ui` `[data-slot]`                                    | Geometry belongs to the primitive's variants, not to whichever theme restyles it | A variant, or a token the primitive reads                               |
| C2  | No CSS that cancels a primitive's own paint (`::before`/`::after` `display: none`, `border: 0`, `mask-image`/`box-shadow`/`backdrop-filter: none`) | Cancelling paint fights the primitive and breaks on its next change              | A variant that doesn't paint it                                         |
| C3  | Every token fork CSS and TSX reads is defined in each enforced theme the rule can apply in                                                         | An undefined token silently paints nothing                                       | Define it in that theme's token block                                   |
| C4  | No `:has()` on large ancestors (already enforced: the `forkStageStamps` guard and `t3code/no-unscoped-has`)                                        | Each insertion beneath restyles most of the page                                 | An attribute stamped from React (`custom/forkStageStamps.ts`)           |
| C5  | Every `[data-fork-*]` attribute (and value) in fork CSS is set somewhere in source                                                                 | Dead selectors hide real ones and cost style matching                            | Delete the rule                                                         |
| C6  | Don't restate the same rule per theme root                                                                                                         | Two copies drift apart                                                           | One rule over `:is(…)` of the roots, or one rule over a per-theme token |

## Suppressing one line

Only when the rule really doesn't fit, and always with a reason.

- **CSS:** `/* design-lint-disable-next-line A3 -- the Figma frame is 13px */` on the line above
  the declaration. On the line above a selector, it covers the whole rule. A suppression without
  a reason is reported (S1), and so is one with nothing to suppress (S2).
- **TSX:** `// oxlint-disable-next-line shadcn/no-arbitrary-values -- reason`.
  `t3code/require-suppression-reason` already requires the reason. While the rules are off, a TSX
  directive for one of them reads as unused and fails normal lint. Until the switch, TSX
  exceptions go in `design-rules.mjs` (the A5 allowlist, or an `excludeFiles` entry with a
  comment).
- **Whole selectors or components** (brand marks, B5 exceptions): an `ALLOWLIST` entry in
  `design-lint.mjs` with a `reason`. B5 lists components that are not atomic through `b5Exempt`,
  grouped by kind (route page, page layout, section, provider/host, backdrop, wrapper); the name
  must match exactly. Blocks and templates get their own stories later.

## How the checks run

- `node .fork/design-lint.mjs --report` prints counts per rule (split into mechanical, new token
  and judgement) and per file, then writes the full inventory to
  `node_modules/.cache/fork-design-lint/inventory.json` (`--json <file>` writes it elsewhere).
  It never fails.
- `node .fork/design-lint.mjs --check` fails on any finding. CI will run this.
- The CSS rules and the cross-file checks (B5, C3, C5) live in `design-lint.mjs`. A5 and B1–B4
  are oxlint rules: the shadcn rules, plus `t3code/no-hand-built-primitives`,
  `t3code/no-hand-built-status-marks` and `t3code/no-direct-icon-imports`. `design-rules.mjs`
  configures them, and the report runs them through `vp lint` with `T3CODE_FORK_DESIGN_LINT=1`.
  A1 also covers raw palette classes in TSX (`shadcn/no-raw-colors`).

## Switching on

When the report reads zero, make one change: set `DESIGN_LINT_BLOCKING = true` in
`.fork/design-rules.mjs` and uncomment the `Check fork design rules` step in
`.github/workflows/ci.yml`. `forkDesignLint.test.ts` fails if only one of the two moves.
