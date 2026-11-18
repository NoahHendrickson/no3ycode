// One element hovers or holds focus at a time, so each :hover / :focus-visible / :focus-within /
// :active rule is copied in place with the pseudo-class read as an attribute (same specificity
// and cascade spot).
// An escaped `\:hover` belongs to a Tailwind class name, so it stays.
const STATES = [
  { pseudo: /(?<!\\):hover(?![-\w])/g, attribute: "[data-story-hover]" },
  { pseudo: /(?<!\\):focus-visible(?![-\w])/g, attribute: "[data-story-focus]" },
  { pseudo: /(?<!\\):focus-within(?![-\w])/g, attribute: "[data-story-focus]" },
  { pseudo: /(?<!\\):active(?![-\w])/g, attribute: "[data-story-active]" },
] as const;
// Quoted strings are attribute values (Tailwind's `[class*="has-[input:focus-visible]…"]`), never
// pseudo-classes; split on them so only the text between quotes is rewritten.
const QUOTED = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/;
const done = new WeakSet<CSSStyleSheet>();

type RuleOwner = {
  readonly cssRules: CSSRuleList;
  insertRule(rule: string, index: number): number;
};

function forcedCopy(cssText: string): string | null {
  const copy = cssText
    .split(QUOTED)
    .map((part, index) => {
      if (index % 2 === 1) return part;
      let rewritten = part;
      for (const { pseudo, attribute } of STATES) rewritten = rewritten.replace(pseudo, attribute);
      return rewritten;
    })
    .join("");
  return copy === cssText ? null : copy;
}

function copyStateRules(owner: RuleOwner) {
  // Backwards, so a copy never shifts a rule still to be read.
  for (let index = owner.cssRules.length - 1; index >= 0; index--) {
    const rule = owner.cssRules[index]!;
    if ("cssRules" in rule && "insertRule" in rule) copyStateRules(rule as unknown as RuleOwner);
    if (!(rule instanceof CSSStyleRule)) continue;
    const copy = forcedCopy(rule.cssText);
    if (!copy) continue;
    try {
      owner.insertRule(copy, index + 1);
    } catch {
      // A selector the browser will not parse twice is one this page can do without.
    }
  }
}

/** Idempotent. The preview calls it before every story renders, which also covers a stylesheet
    HMR replaced. */
export function forceStateStyles() {
  for (const sheet of document.styleSheets) {
    if (done.has(sheet)) continue;
    done.add(sheet);
    try {
      copyStateRules(sheet);
    } catch {
      // A cross-origin sheet cannot be read; none of the app's are.
    }
  }
}

/** The columns of a state grid, in reading order. */
export const FORCED_STATES = ["default", "hover", "active", "focus", "disabled"] as const;

export type ForcedState = (typeof FORCED_STATES)[number];

/** Props that put an element into a forced state; spread them onto the component. */
export function forcedStateProps(state: ForcedState): Record<string, string | boolean> {
  switch (state) {
    case "hover":
      return { "data-story-hover": "" };
    case "focus":
      return { "data-story-focus": "" };
    case "active":
      return { "data-story-hover": "", "data-story-active": "" };
    case "disabled":
      return { disabled: true };
    default:
      return {};
  }
}
