/**
 * The fork guards' view of a stylesheet, read through `.fork/design-lint/css.mjs` — the
 * reader design-lint shares, so the two never disagree about a sheet.
 *
 * Guards that ask "is this declaration scoped?" have to read a rule's own selector, and a regex
 * over `selector { body }` breaks on `theme.custom.css` (its `@keyframes` nest blocks, and its
 * comments hold braces). `cssRules` returns only leaf rules (blocks whose body holds no further
 * block): every selector a fork guard cares about is a leaf. The at-rules that wrap them are
 * recorded on `atRules` so a guard can pin media scoping without a coincidence-detector regex. A
 * leaf nested in a style rule comes back with its selector resolved against its parents, so a
 * guard reads a nested sheet as it would the flat one.
 */

import { readCss, splitTopLevel } from "../../../../.fork/design-lint/css.mjs";

export interface CssRule {
  /** Everything between the previous block or statement and this one's `{`, trimmed. */
  readonly selector: string;
  /** The declarations, verbatim (comments blanked). */
  readonly body: string;
  /** Enclosing at-rule headers, outermost first (e.g. `@media (width >= 40rem)`). */
  readonly atRules: ReadonlyArray<string>;
}

// A nested selector written out against its parent, as the browser reads
// it: `&` is the parent, and a part without one descends from it. A parent
// list goes in :is(), which ranks as its most specific member.
function resolveNested(parent: string | null, selector: string): string {
  if (parent === null) return selector;
  const outer = splitTopLevel(parent, ",").length > 1 ? `:is(${parent})` : parent;
  return splitTopLevel(selector, ",")
    .map((part) => (part.includes("&") ? part.replaceAll("&", outer) : `${outer} ${part}`))
    .join(",\n");
}

export function cssRules(css: string): ReadonlyArray<CssRule> {
  const sheet = readCss(css);
  return sheet.blocks
    .filter((block) => block.kind === "style" && block.children === 0)
    .sort((left, right) => left.open - right.open)
    .map((block) => ({
      selector: [...block.parents, block.header].reduce<string | null>(resolveNested, null) ?? "",
      body: sheet.body(block),
      atRules: block.atHeaders,
    }));
}

/**
 * Body of the leaf rule whose whole selector equals the given parts joined as
 * a descendant selector (whitespace-normalized). Exact, not substring: a bare
 * `:root[data-fork].dark` must find the stage block, never a longer dark-scoped
 * selector that merely starts with it. Throws when no rule matches, so a guard
 * fails loudly rather than asserting against an empty string. Use this instead
 * of a per-file `selector { body }` regex — the naive regex is exactly what
 * breaks on `theme.custom.css` (see the module comment above).
 */
export function ruleBodyFor(
  rules: ReadonlyArray<CssRule>,
  selectorParts: readonly string[],
): string {
  const wanted = selectorParts.join(" ").replace(/\s+/gu, " ").trim();
  // A selector's token block and its style rule are two rules with one selector; read both.
  const matching = rules.filter(
    (candidate) => candidate.selector.replace(/\s+/gu, " ").trim() === wanted,
  );
  if (matching.length === 0) {
    throw new Error(`no rule found for selector: ${wanted}`);
  }
  return matching.map((rule) => rule.body).join("\n");
}

/** First 6-digit hex assigned to `prop` in a rule body. Throws when absent. */
export function declarationHex(body: string, prop: string): string {
  const escaped = prop.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(`${escaped}:\\s*(#[0-9a-f]{6})`, "iu").exec(body);
  const hex = match?.[1];
  if (hex === undefined) {
    throw new Error(`no ${prop} hex declaration in body: ${body.slice(0, 120)}`);
  }
  return hex.toLowerCase();
}

/** `#rrggbb` → [r, g, b] bytes. */
export function parseHex(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * Bodies of every at-rule block with this header (`@font-face`), in source order. `cssRules`
 * treats an `@…` header as a wrapper and returns only the rules inside it, so these never come
 * back from it.
 */
export function atRuleBodies(css: string, name: string): ReadonlyArray<string> {
  const sheet = readCss(css);
  return sheet.blocks
    .filter((block) => block.kind === "at" && block.header === name)
    .sort((left, right) => left.open - right.open)
    .map((block) => sheet.body(block));
}

/** A CSS font stack as a comparable list: quoting, spacing and comments are noise. */
export function fontFamilies(stack: string): string[] {
  return stack
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .split(",")
    .map((family) => family.trim().replace(/^["']|["']$/gu, ""))
    .filter((family) => family.length > 0);
}

/** Headers of the top-level blocks, at-rules included, in source order. */
export function topLevelHeaders(css: string): ReadonlyArray<string> {
  return readCss(css)
    .blocks.filter((block) => block.atHeaders.length === 0 && block.parents.length === 0)
    .sort((left, right) => left.open - right.open)
    .map((block) => block.header);
}
