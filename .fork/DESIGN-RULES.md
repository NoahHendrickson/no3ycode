# Fork design rules

The fork's UI takes its values from tokens and its controls from `components/ui`. These rules
hold fork code to that. They cover fork-owned code only: `apps/web/src/custom/**`,
`apps/web/src/overrides/**`, every `apps/web/src/theme.custom*.css`, CSS under `custom/` and
`overrides/`, and the fork's fenced hunks in `index.css`.

Enforced themes: Flat Glass (primary), Basic Darker Neutral, Basic Light, Inlet Black and Inlet
Cream. Glass 3D gets best effort: a finding only it can see is printed but never blocks.

CI runs `node .fork/design-lint.mjs --check` and `vp lint` carries the TSX rules. There's no
ratchet or baseline: a rule either passes or it fails. A few files wait on a design call (see
[Pending](#pending)).

## A. Values come only from tokens

| ID  | Rule                                                                                          | Why                                                                       | Use instead                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | No raw colours (hex, `rgb()`/`hsl()`/`oklch()`…, named colours) outside a theme's token block | A colour written in place can't follow a theme, and drifts unseen         | A token. Define it in the theme's token block: a rule under `:root…` that only sets `--custom-properties`                                    |
| A2  | No raw px `border-radius`                                                                     | Radii are a hierarchy (tight rows, softer popovers) and live in one place | `--radius-*`, or a named `--fork-*-radius` token                                                                                             |
| A3  | No raw px width, height, padding, gap or margin in fork CSS (0 and 1px hairlines are fine)    | Spacing off the scale is the most common drift                            | `calc(var(--spacing) * n)`, or a named size token                                                                                            |
| A4  | No raw `font-size` or `line-height` (`line-height: 1` is fine)                                | Type sizes follow the type settings and the scale                         | `--text-*`, `--leading-*`, `--text-sidebar-*`; px line heights take the spacing scale                                                        |
| A5  | No arbitrary Tailwind values in fork TSX (`text-[11px]`, `rounded-[10px]`, `h-[26px]`)        | Same as A1–A4, written as classes                                         | The scale utility (`text-2xs`, `rounded-lg`, `h-6.5`), or `(--token)` for a token. The short allowlist in `design-rules.mjs` has its reasons |

## B. Reuse components

| ID  | Rule                                                                                                                              | Why                                                                                    | Use instead                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Don't restyle a `components/ui` export with `className` beyond layout                                                             | The primitive owns its look; restyles fork the design                                  | A `variant` or `size`, or add one when the look is a generic concept several features use. A look only one feature draws stays in that feature's component (e.g. `custom/SidebarChromeButton`), with one reasoned suppression on its class string |
| B2  | No hand-built overlay or list primitives: `role="menu"`, `listbox`, `dialog`, `alertdialog` or `tooltip` on a host element        | They rebuild the primitive's focus trap, roving focus and dismissal, and drift from it | `Menu`, `Select`/`Combobox`, `Dialog`/`Sheet`/`Popover`, `AlertDialog`, `Tooltip`                                                                                                                                                                 |
| B3  | Status marks come only from `custom/SidebarV2StatusIndicator.tsx`: no `CircleHalfIcon`, no hand-drawn status dots                 | One status language across sidebar, tabs and chips                                     | `SidebarV2StatusMark` and its siblings                                                                                                                                                                                                            |
| B4  | Icons come only from the Hugeicons shim, never an icon package directly                                                           | The shim owns each glyph's stroke and fill policy                                      | `~/custom/icons/lucide-hugeicons`                                                                                                                                                                                                                 |
| B5  | Every exported **atomic** component in `custom/` (a button, chip, mark, row, card, menu, picker, indicator) has a Storybook story | The story is where Figma and code are compared                                         | A story in `apps/fork-storybook/stories`; a page, layout, section, provider or wrapper gets a `b5Exempt` entry in `design-rules.mjs` with its kind as the reason                                                                                  |

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
- **TSX:** `// oxlint-disable-next-line shadcn/no-arbitrary-values -- reason` (in JSX,
  `{/* oxlint-disable-next-line … -- reason */}`). `t3code/require-suppression-reason` already
  requires the reason. A kind of value no token can express (a keyword, fr/minmax tracks, a viewport
  clamp) goes in the A5 allowlist in `design-rules.mjs`, with its reason. A value only one
  component uses takes a line suppression at its site instead.
- **Whole selectors or components** (brand marks, B5 exceptions): a `DESIGN_LINT_ALLOWLIST`
  entry in `design-rules.mjs` with a `reason`. B5 lists components that are not atomic through `b5Exempt`,
  grouped by kind (route page, page layout, section, provider/host, backdrop, wrapper); the name
  must match exactly. Blocks and templates get their own stories later.

## How the checks run

- `node .fork/design-lint.mjs --check` runs the CSS rules and the cross-file checks (B5, C3,
  C5) and fails on any finding. The engine is in `.fork/design-lint/` (one module per rule
  group); every exemption it reads is in `design-rules.mjs`.
- A5 and B1–B4 are oxlint rules: the shadcn rules, plus `t3code/no-hand-built-primitives`,
  `t3code/no-hand-built-status-marks` and `t3code/no-direct-icon-imports`. `design-rules.mjs`
  configures them for fork files and `vite.config.ts` applies them, so `vp lint` reports them.
  A1 also covers raw palette classes in TSX (`shadcn/no-raw-colors`).

## Pending

The B5 `pending:` group in `DESIGN_LINT_ALLOWLIST` (`design-rules.mjs`) exempts components that
wait on a design call: each draws an upstream control that reads live state itself. Settle it, fix
the file, delete the line. New files never join this list.
