/** C3: every token fork CSS and TSX reads is defined in each enforced theme it can apply in. */

import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";

import { RUNTIME_TOKEN_PREFIXES } from "../../design-rules.mjs";
import { loadStylesheet } from "../css.mjs";
import { finding, isTestFile, read, walk, WEB_SRC } from "../sources.mjs";
import { THEMES, themesFor } from "../themes.mjs";

const VAR_REFERENCE = /var\(\s*(--[\w-]+)\s*(,)?/gu;

/** Custom properties every theme gets: @theme, @property and runtime setters in TS. */
export function runtimeTokens(root) {
  const names = new Set();
  const sources = [
    ...walk(root, WEB_SRC, (path) => /\.tsx?$/u.test(path) && !isTestFile(path)),
    ...walk(root, "apps/desktop/src", (path) => /\.ts$/u.test(path) && !isTestFile(path)),
  ];
  for (const path of sources) {
    // Writers only: a getPropertyValue read or a name in a comment defines nothing.
    const text = read(root, path).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gmu, "");
    for (const match of text.matchAll(
      /(?<!getPropertyValue\(\s*)(?:setProperty\(\s*|["'`])(--[\w-]+)["'`]?\s*[:,\])]/gu,
    )) {
      names.add(match[1]);
    }
    // Tailwind arbitrary properties: className="[--fork-x:20px]".
    for (const match of text.matchAll(/\[(--[\w-]+):/gu)) names.add(match[1]);
  }
  return names;
}

export function tailwindTheme(root) {
  try {
    const require = NodeModule.createRequire(NodePath.join(root, "apps/web/package.json"));
    const path = require.resolve("tailwindcss/theme.css");
    return loadStylesheet("tailwindcss/theme.css", NodeFS.readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Every custom property, with the theme ids each of its definitions can apply in.
 */
export function buildTokenIndex(sheets, runtime = new Set()) {
  const definitions = new Map();
  const define = (name, themes) => {
    const list = definitions.get(name) ?? [];
    list.push(themes);
    definitions.set(name, list);
  };
  const allThemes = THEMES.map((theme) => theme.id);
  for (const sheet of sheets) {
    for (const rule of sheet.rules) {
      if (rule.kind === "at") {
        if (rule.name === "property") {
          const name = /@property\s+(--[\w-]+)/u.exec(rule.prelude)?.[1];
          if (name) define(name, allThemes);
        }
        if (rule.name !== "theme" && !rule.selectors) continue;
      }
      const themes = rule.selectors ? [...new Set(rule.selectors.flatMap(themesFor))] : allThemes;
      for (const declaration of rule.declarations) {
        if (!declaration.property.startsWith("--")) continue;
        define(declaration.property, themes);
      }
    }
  }
  for (const name of runtime) define(name, allThemes);
  return definitions;
}

const isRuntimeToken = (name) => RUNTIME_TOKEN_PREFIXES.some((prefix) => name.startsWith(prefix));

/** var() references in a value: `{ name, fallback }`. */
const references = (value) =>
  [...value.matchAll(VAR_REFERENCE)].map((match) => ({
    name: match[1],
    fallback: match[2] === ",",
  }));

/** Tokens fork TSX reads: var(--x) in strings and Tailwind's (--x) shorthand. */
export function tsxReferences(text) {
  const out = [];
  const lines = text.split("\n");
  lines.forEach((content, index) => {
    for (const match of content.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/gu)) {
      out.push({ name: match[1], fallback: match[2] === ",", line: index + 1 });
    }
    for (const match of content.matchAll(/[\w-]\((?:[\w-]+:)?(--[\w-]+)\)/gu)) {
      out.push({ name: match[1], fallback: false, line: index + 1 });
    }
  });
  return out;
}

/**
 * C3. A consumer applies in the themes its rule can match; each of those enforced themes needs a
 * definition that can apply there. A var() with a fallback is satisfied by the fallback.
 */
export function checkThemeContract(consumers, definitions, themes = THEMES) {
  const out = [];
  const reported = new Set();
  for (const consumer of consumers) {
    if (consumer.fallback || isRuntimeToken(consumer.name)) continue;
    const entries = definitions.get(consumer.name) ?? [];
    for (const theme of themes) {
      if (!consumer.themes.includes(theme.id)) continue;
      if (entries.some((ids) => ids.includes(theme.id))) continue;
      const key = `${consumer.name}␟${theme.id}`;
      if (reported.has(key)) continue;
      reported.add(key);
      out.push(
        finding(
          "C3",
          consumer.file,
          consumer.line,
          `${consumer.name} is not defined in ${theme.id}`,
          {
            enforced: theme.enforced,
          },
        ),
      );
    }
  }
  return out;
}

export function cssConsumers(sheet) {
  const out = [];
  for (const rule of sheet.rules) {
    if (rule.kind === "at" && rule.name !== "theme" && !rule.selectors) continue;
    const themes = rule.selectors
      ? [...new Set(rule.selectors.flatMap(themesFor))]
      : THEMES.map((theme) => theme.id);
    for (const declaration of rule.declarations) {
      if (!sheet.owns(declaration.line)) continue;
      for (const reference of references(declaration.value)) {
        out.push({ ...reference, themes, file: sheet.path, line: declaration.line });
      }
    }
  }
  return out;
}
