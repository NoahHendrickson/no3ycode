// One element hovers or holds focus at a time, so each :hover / :focus-visible / :focus-within /
// :active in a selector also accepts an attribute, :is(:hover, [data-story-hover]): same specificity
// and cascade spot, and real hover and focus keep working (inside :not() as well).
// An escaped `\:hover` belongs to a Tailwind class name, so it stays.
const STATES = [
  { pseudo: /(?<!\\):hover(?![-\w])/g, union: ":is(:hover, [data-story-hover])" },
  { pseudo: /(?<!\\):focus-visible(?![-\w])/g, union: ":is(:focus-visible, [data-story-focus])" },
  { pseudo: /(?<!\\):focus-within(?![-\w])/g, union: ":is(:focus-within, [data-story-focus])" },
  { pseudo: /(?<!\\):active(?![-\w])/g, union: ":is(:active, [data-story-active])" },
] as const;
// Quoted strings are attribute values (Tailwind's `[class*="has-[input:focus-visible]…"]`), never
// pseudo-classes; split on them so only the text between quotes is rewritten.
const QUOTED = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/;
const done = new WeakSet<CSSStyleSheet>();

function forcedSelector(selector: string): string | null {
  const rewritten = selector
    .split(QUOTED)
    .map((part, index) => {
      if (index % 2 === 1) return part;
      let next = part;
      for (const { pseudo, union } of STATES) next = next.replace(pseudo, union);
      return next;
    })
    .join("");
  return rewritten === selector ? null : rewritten;
}

function rewriteStateRules(rules: CSSRuleList) {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      const selector = forcedSelector(rule.selectorText);
      // A selector the browser rejects (a pseudo-element before :is()) is left as it was.
      if (selector) rule.selectorText = selector;
    }
    if ("cssRules" in rule) rewriteStateRules(rule.cssRules as CSSRuleList);
  }
}

/** Idempotent. The preview calls it before every story renders, which also covers a stylesheet
    HMR replaced. */
export function forceStateStyles() {
  for (const sheet of document.styleSheets) {
    if (done.has(sheet)) continue;
    done.add(sheet);
    try {
      rewriteStateRules(sheet.cssRules);
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
