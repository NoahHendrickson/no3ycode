import { finding } from "../sources.mjs";
import { themeKey } from "../themes.mjs";
import { isTokenBlock } from "./values.mjs";

/**
 * C6: one selector restated per theme root. `identical` blocks become one rule over :is(…);
 * `same-shape` blocks (same properties, different values) become one rule over a per-theme token.
 */
export function checkDuplicatedThemeBlocks(sheets) {
  const groups = new Map();
  for (const sheet of sheets) {
    for (const rule of sheet.rules) {
      if (rule.kind !== "style" || rule.keyframes || isTokenBlock(rule) || !sheet.owns(rule.line))
        continue;
      const properties = rule.declarations.map((declaration) => declaration.property).sort();
      if (properties.length === 0) continue;
      const values = rule.declarations
        .map((declaration) => `${declaration.property}:${declaration.value}`)
        .sort()
        .join(";");
      for (const selector of rule.selectors) {
        const { theme, tail } = themeKey(selector);
        if (!theme) continue;
        const key = `${rule.atRules.join("|")}␟${tail}␟${properties.join(",")}`;
        const group = groups.get(key) ?? [];
        group.push({ theme, values, file: sheet.path, line: rule.line, selector });
        groups.set(key, group);
      }
    }
  }
  const out = [];
  for (const entries of groups.values()) {
    // One rule whose selector list names several roots is already one rule.
    const rules = new Map();
    for (const entry of entries) {
      const id = `${entry.file}:${entry.line}`;
      const known = rules.get(id);
      if (known) known.theme = [known.theme, entry.theme].sort().join("|");
      else rules.set(id, { ...entry });
    }
    const group = [...rules.values()];
    if (new Set(group.map((entry) => entry.theme)).size < 2) continue;
    const seen = new Set();
    for (const entry of group) {
      if (seen.size === 0 || seen.has(entry.theme)) {
        seen.add(entry.theme);
        continue;
      }
      seen.add(entry.theme);
      const identical = group.some(
        (other) => other.theme !== entry.theme && other.values === entry.values,
      );
      const first = group[0];
      out.push(
        finding(
          "C6",
          entry.file,
          entry.line,
          `${entry.selector} restates ${first.file}:${first.line}`,
          {
            ruleLine: entry.line,
            selector: entry.selector,
            kind: identical ? "identical" : "same-shape",
          },
        ),
      );
    }
  }
  return out;
}
