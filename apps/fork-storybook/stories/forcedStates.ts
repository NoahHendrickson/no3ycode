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
const done = new WeakSet<CSSStyleSheet>();

type RuleOwner = {
  readonly cssRules: CSSRuleList;
  insertRule(rule: string, index: number): number;
};

function forcedCopy(cssText: string): string | null {
  let copy = cssText;
  for (const { pseudo, attribute } of STATES) copy = copy.replace(pseudo, attribute);
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

/** Idempotent; call it whenever a state grid mounts, so a stylesheet HMR replaced is covered. */
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

export type ForcedState = "default" | "hover" | "focus" | "active" | "disabled";

/** Props that put an element into a forced state; spread them onto the component. */
export function forcedStateProps(state: ForcedState): Record<string, string | boolean> {
  forceStateStyles();
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
