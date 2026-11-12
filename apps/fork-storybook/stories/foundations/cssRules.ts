import inletCss from "~/theme.custom.inlet.css?raw";
import palettesCss from "~/theme.custom.palettes.css?raw";

export interface TokenRule {
  readonly selector: string;
  readonly tokens: ReadonlyArray<{ readonly name: string; readonly value: string }>;
}

// Nested rules resolve against their parent (`&` or descendant), and an at-rule block keeps its
// parent's selector, so every custom property lands under the selector it applies to.
function nestSelector(parent: string, child: string): string {
  if (child.startsWith("@")) return parent;
  if (!parent) return child;
  return child.includes("&") ? child.replaceAll("&", parent) : `${parent} ${child}`;
}

function parseRules(css: string): TokenRule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: TokenRule[] = [];
  const stack: Array<{ selector: string; tokens: Array<{ name: string; value: string }> }> = [];
  let buffer = "";
  const declare = () => {
    const match = buffer.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/);
    if (match && stack.length > 0) {
      stack.at(-1)!.tokens.push({ name: match[1]!, value: match[2]!.replace(/\s+/g, " ") });
    }
    buffer = "";
  };
  for (const char of source) {
    if (char === "{") {
      const selector = buffer.trim().replace(/\s+/g, " ");
      stack.push({ selector: nestSelector(stack.at(-1)?.selector ?? "", selector), tokens: [] });
      buffer = "";
    } else if (char === "}") {
      declare();
      const rule = stack.pop();
      if (rule && rule.tokens.length > 0) rules.push(rule);
    } else if (char === ";") {
      declare();
    } else {
      buffer += char;
    }
  }
  return rules;
}

const JUNGLE = '[data-fork-inlet-color="jungle"]';

export const jungleColorRules = [...parseRules(palettesCss), ...parseRules(inletCss)].filter(
  (rule) => rule.selector.includes(JUNGLE),
);

export const inletTemplateRules = parseRules(inletCss).filter(
  (rule) => !rule.selector.includes('[data-fork-inlet-color="'),
);
