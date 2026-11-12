// A pointer hovers one element at a time, so a page of hover states needs the app's own :hover
// rules to answer to an attribute as well. Each rule that hovers is copied right after itself
// with :hover read as [data-story-hover]: the same specificity, in the same cascade position.
const HOVER = /:hover(?![-\w])/;
const HOVER_ALL = /:hover(?![-\w])/g;
const done = new WeakSet<CSSStyleSheet>();

type RuleOwner = {
  readonly cssRules: CSSRuleList;
  insertRule(rule: string, index: number): number;
};

function copyHoverRules(owner: RuleOwner) {
  // Backwards, so a copy never shifts a rule still to be read.
  for (let index = owner.cssRules.length - 1; index >= 0; index--) {
    const rule = owner.cssRules[index]!;
    if ("cssRules" in rule && "insertRule" in rule) copyHoverRules(rule as unknown as RuleOwner);
    if (!(rule instanceof CSSStyleRule) || !HOVER.test(rule.selectorText)) continue;
    try {
      owner.insertRule(rule.cssText.replace(HOVER_ALL, "[data-story-hover]"), index + 1);
    } catch {
      // A selector the browser will not parse twice is one this page can do without.
    }
  }
}

/** Idempotent; call it whenever a hover state mounts, so a stylesheet HMR replaced is covered. */
export function forceHoverStyles() {
  for (const sheet of document.styleSheets) {
    if (done.has(sheet)) continue;
    done.add(sheet);
    try {
      copyHoverRules(sheet);
    } catch {
      // A cross-origin sheet cannot be read; none of the app's are.
    }
  }
}
