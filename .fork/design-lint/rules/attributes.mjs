/** C5: every [data-fork-*] attribute (and value) fork CSS selects on is set somewhere. */

import { finding } from "../sources.mjs";
import { themesFor } from "../themes.mjs";

/** A CSS string or identifier with its escapes (\2e , \.) decoded. */
const cssUnescape = (text) =>
  text?.replace(/\\(?:([0-9a-f]{1,6})\s?|(.))/giu, (_, hex, char) =>
    hex ? String.fromCodePoint(Number.parseInt(hex, 16)) : char,
  );

export function checkDeadForkAttributes(sheets, sourceText) {
  const templatePrefixes = [...sourceText.matchAll(/data-fork-([\w-]+?)-?\$\{/gu)].map(
    (match) => `data-fork-${match[1]}`,
  );
  const camel = (name) =>
    name.replace(/^data-/u, "").replace(/-([a-z0-9])/gu, (_, char) => char.toUpperCase());
  const out = [];
  const checked = new Map();
  for (const sheet of sheets) {
    for (const rule of sheet.rules) {
      if (rule.kind !== "style" || !sheet.owns(rule.line)) continue;
      const attributes = rule.selectors.flatMap((selector) => [
        ...selector.matchAll(
          /\[\s*(data-fork-[\w-]+)(?:\s*=\s*(?:["']([^"']*)["']|((?:[\w-]|\\[0-9a-fA-F]{1,6}\s?|\\.)+)))?/gu,
        ),
      ]);
      const names = new Set(attributes.map((match) => match[1]));
      // Themes from the selectors that hold the attribute: one only Glass 3D can match never blocks.
      const themesOf = (name) => [
        ...new Set(rule.selectors.filter((s) => s.includes(name)).flatMap(themesFor)),
      ];
      for (const name of names) {
        if (!checked.has(name)) {
          const used =
            sourceText.includes(name) ||
            new RegExp(`\\b${camel(name)}\\b`, "u").test(sourceText) ||
            templatePrefixes.some((prefix) => name.startsWith(prefix));
          checked.set(name, used);
        }
        if (!checked.get(name)) {
          out.push(
            finding("C5", sheet.path, rule.line, `[${name}] is set nowhere in source`, {
              attribute: name,
              selector: rule.selectors[0],
              themes: themesOf(name),
            }),
          );
        }
      }
      // A live attribute can still carry a value nothing sets.
      for (const [, name, quoted, bare] of attributes) {
        const value = cssUnescape(quoted ?? bare);
        if (value === undefined || !checked.get(name)) continue;
        const escaped = value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        if (!new RegExp(`["'\`]${escaped}["'\`]`, "u").test(sourceText)) {
          out.push(
            finding(
              "C5",
              sheet.path,
              rule.line,
              `[${name}="${value}"]: no source sets "${value}"`,
              { attribute: name, selector: rule.selectors[0], themes: themesOf(name) },
            ),
          );
        }
      }
    }
  }
  return out;
}
