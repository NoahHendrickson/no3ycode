#!/usr/bin/env node
/**
 * Fork design-system lint: the CSS and cross-file rules of .fork/DESIGN-RULES.md, plus the
 * oxlint TSX rules run with design-rules.mjs switched on. `--report [--json <file>]` never
 * fails; `--check` fails on any finding; `--no-oxlint` skips the TSX pass. Dependency-free.
 */

import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { DESIGN_LINT_ENV, DESIGN_OXLINT_RULE_IDS } from "./design-rules.mjs";

const FORK_DIR = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const REPO_ROOT = NodePath.resolve(FORK_DIR, "..");
const WEB_SRC = "apps/web/src";

export const RULE_TITLES = {
  A1: "raw colour outside a token block",
  A2: "raw px border-radius",
  A3: "raw px size, padding, gap or margin",
  A4: "raw font-size or line-height",
  A5: "arbitrary Tailwind value",
  B1: "restyled components/ui export",
  B2: "hand-built interactive primitive",
  B3: "hand-built status mark",
  B4: "icon not from the Hugeicons shim",
  B5: "exported custom component without a story",
  C1: "geometry on a [data-slot] primitive",
  C2: "CSS cancelling a primitive's own paint",
  C3: "token undefined in an enforced theme",
  C5: "dead [data-fork-*] selector",
  C6: "per-theme rule restated instead of tokenised",
  S1: "suppression without a reason",
  S2: "unused suppression",
};

/** The themes C3 holds every consumed token to. `classes`/`attrs` are what the root carries. */
export const THEMES = [
  {
    id: "flat-glass",
    enforced: true,
    classes: ["dark"],
    attrs: { "data-fork-theme": "cool-darker", "data-fork-glass-3d": "off" },
  },
  {
    id: "basic-darker-neutral",
    enforced: true,
    classes: ["dark"],
    attrs: { "data-fork-theme": "basic", "data-fork-basic-tone": "darker-neutral" },
  },
  {
    id: "basic-light",
    enforced: true,
    classes: [],
    attrs: { "data-fork-theme": "basic", "data-fork-basic-tone": "light" },
  },
  {
    id: "inlet-black",
    enforced: true,
    classes: [],
    attrs: { "data-fork-theme": "inlet", "data-fork-inlet-color": "black" },
  },
  {
    id: "inlet-cream",
    enforced: true,
    classes: ["dark"],
    attrs: { "data-fork-theme": "inlet", "data-fork-inlet-color": "cream" },
  },
  // Best effort: reported, never blocking.
  {
    id: "glass-3d",
    enforced: false,
    classes: ["dark"],
    attrs: { "data-fork-theme": "cool-darker" },
  },
];

const ALWAYS_ROOT_ATTRS = { "data-fork": "noahhendrickson-t3code" };
/** Root attributes whose absence is known; any other attribute on the root is "maybe". */
const KNOWN_ROOT_ATTRS = new Set([
  "data-fork",
  "data-fork-theme",
  "data-fork-glass-3d",
  "data-fork-basic-tone",
  "data-fork-inlet-color",
]);
const KNOWN_ROOT_CLASSES = new Set(["dark"]);

/**
 * Exceptions that are not a line comment: a whole selector or file the rule does not fit.
 * `match` is a substring of the selector (or of the component name for B5). Each needs a reason.
 */
export const ALLOWLIST = [
  // { rule: "A1", file: "apps/web/src/theme.custom.css", match: ".fork-wordmark", reason: "…" },
];

/** Custom properties another library or the browser sets at runtime, so C3 cannot see them. */
const RUNTIME_TOKEN_PREFIXES = [
  "--tw-", // Tailwind's per-utility plumbing
  // Base UI stamps these on positioners and popups as inline styles.
  "--anchor-",
  "--available-",
  "--transform-origin",
  "--popup-",
  "--positioner-",
  "--collapsible-",
  "--accordion-",
  "--active-tab-",
  "--scroll-area-",
  "--toast-",
  "--nested-dialogs",
];

const read = (root, relative) => NodeFS.readFileSync(NodePath.join(root, relative), "utf8");

function walk(root, relativeDir, keep) {
  const absoluteDir = NodePath.join(root, relativeDir);
  if (!NodeFS.existsSync(absoluteDir)) return [];
  const out = [];
  for (const entry of NodeFS.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relative = NodePath.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== "vendor")
        out.push(...walk(root, relative, keep));
    } else if (entry.isFile() && keep(relative)) {
      out.push(relative);
    }
  }
  return out.sort();
}

const isTestFile = (path) => /\.(?:test|spec|bench)\.[cm]?[jt]sx?$|\/__fork_guards__\//u.test(path);

/** Fork-owned stylesheets: every theme.custom*.css plus any .css under custom/ or overrides/. */
export function forkCssFiles(root = REPO_ROOT) {
  const themeFiles = NodeFS.readdirSync(NodePath.join(root, WEB_SRC))
    .filter((name) => /^theme\.custom.*\.css$/u.test(name))
    .map((name) => `${WEB_SRC}/${name}`);
  const nested = ["custom", "overrides"].flatMap((dir) =>
    walk(root, `${WEB_SRC}/${dir}`, (path) => path.endsWith(".css")),
  );
  return [...themeFiles.sort(), ...nested];
}

/** Upstream stylesheets whose fork:begin/fork:end hunks are fork code. */
export const FENCED_CSS_FILES = [`${WEB_SRC}/index.css`];

const forkTsxFiles = (root, dirs) =>
  dirs.flatMap((dir) =>
    walk(root, `${WEB_SRC}/${dir}`, (path) => /\.tsx?$/u.test(path) && !isTestFile(path)),
  );

const countLines = (text) => text.split("\n").length - 1;

/** Split on `separator` outside (), [] and strings. */
export function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === "\\") index++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    else if (char === separator && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function resolveNesting(children, parents) {
  if (!parents) return children;
  const out = [];
  for (const child of children) {
    for (const parent of parents) {
      out.push(child.includes("&") ? child.replaceAll("&", parent) : `${parent} ${child}`);
    }
  }
  return out;
}

/**
 * Rules in source order. A style rule is `{ kind: "style", selectors, declarations, line,
 * endLine, atRules, keyframes }`; declarations straight inside an at-rule (@theme, @property,
 * @font-face) are `{ kind: "at", name, prelude, … }`.
 */
export function parseCss(text) {
  const rules = [];
  const comments = [];
  const stack = [];
  let buffer = "";
  let bufferLine = 1;
  let line = 1;
  let depth = 0;

  const flushStatement = () => {
    const statement = buffer.trim();
    buffer = "";
    const frame = stack.at(-1);
    if (!statement || statement.startsWith("@") || !frame) return;
    const colon = statement.indexOf(":");
    if (colon <= 0) return;
    const rawProperty = statement.slice(0, colon).trim();
    const property = rawProperty.startsWith("--") ? rawProperty : rawProperty.toLowerCase();
    const value = statement
      .slice(colon + 1)
      .replace(/!important\s*$/iu, "")
      .trim();
    frame.declarations.push({ property, value, line: bufferLine });
  };

  const open = () => {
    const prelude = buffer.trim().replace(/\s+/gu, " ");
    buffer = "";
    const atRules = stack.filter((frame) => frame.kind === "at").map((frame) => frame.prelude);
    const keyframes = stack.some(
      (frame) => frame.kind === "at" && /^@(?:-\w+-)?keyframes\b/u.test(frame.prelude),
    );
    if (prelude.startsWith("@")) {
      stack.push({
        kind: "at",
        name: /^@([\w-]+)/u.exec(prelude)?.[1] ?? "",
        prelude,
        declarations: [],
        line: bufferLine,
        atRules,
      });
      return;
    }
    const parent = stack.findLast((frame) => frame.kind === "style");
    stack.push({
      kind: "style",
      selectors: keyframes
        ? [prelude]
        : resolveNesting(
            splitTopLevel(prelude, ","),
            parent?.keyframes ? undefined : parent?.selectors,
          ),
      declarations: [],
      line: bufferLine,
      atRules,
      keyframes,
    });
  };

  const close = () => {
    flushStatement();
    const frame = stack.pop();
    if (!frame) return;
    if (frame.kind === "style" || frame.declarations.length > 0) {
      rules.push({ ...frame, endLine: line });
    }
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2);
      const stop = end === -1 ? text.length : end + 2;
      const body = text.slice(index + 2, end === -1 ? text.length : end);
      comments.push({ text: body, line, endLine: line + countLines(body) });
      line += countLines(text.slice(index, stop));
      index = stop - 1;
      continue;
    }
    if (char === '"' || char === "'") {
      let end = index + 1;
      while (end < text.length && text[end] !== char) end += text[end] === "\\" ? 2 : 1;
      const literal = text.slice(index, end + 1);
      if (!buffer.trim()) bufferLine = line;
      buffer += literal;
      line += countLines(literal);
      index = end;
      continue;
    }
    if (char === "(") depth++;
    else if (char === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && char === "{") open();
    else if (depth === 0 && char === ";") flushStatement();
    else if (depth === 0 && char === "}") close();
    else {
      if (!buffer.trim() && !/\s/u.test(char)) bufferLine = line;
      buffer += char;
    }
    if (char === "\n") line++;
  }
  return { rules, comments };
}

/** Compounds of one complex selector, combinators dropped. */
export function compounds(selector) {
  const out = [];
  let depth = 0;
  let quote = null;
  let current = "";
  for (const char of selector) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    if (char === "(" || char === "[") depth++;
    if (char === ")" || char === "]") depth--;
    if (depth === 0 && /[\s>+~]/u.test(char)) {
      if (current) out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) out.push(current);
  return out;
}

/** Simple selectors of one compound: `.a`, `[x="y"]`, `:not(…)`, `::before`, `div`. */
function simpleSelectors(compound) {
  const out = [];
  let index = 0;
  while (index < compound.length) {
    const start = index;
    const char = compound[index];
    if (char === "[") {
      let depth = 0;
      for (; index < compound.length; index++) {
        if (compound[index] === "[") depth++;
        else if (compound[index] === "]" && --depth === 0) break;
      }
      index++;
    } else if (char === ":") {
      index += compound[index + 1] === ":" ? 2 : 1;
      while (index < compound.length && /[\w-]/u.test(compound[index])) index++;
      if (compound[index] === "(") {
        let depth = 0;
        for (; index < compound.length; index++) {
          if (compound[index] === "(") depth++;
          else if (compound[index] === ")" && --depth === 0) break;
        }
        index++;
      }
    } else {
      index++;
      while (index < compound.length && /[\w\\-]/u.test(compound[index])) index++;
    }
    out.push(compound.slice(start, index));
  }
  return out;
}

const AND = (results) =>
  results.includes(false) ? false : results.includes("maybe") ? "maybe" : true;
const OR = (results) =>
  results.includes(true) ? true : results.includes("maybe") ? "maybe" : false;

/** Does the root element, in `theme`, match `compound`? true, false or "maybe". */
export function matchRoot(compound, theme) {
  const attrs = { ...ALWAYS_ROOT_ATTRS, ...theme.attrs };
  return AND(
    simpleSelectors(compound).map((simple) => {
      if (simple === ":root" || simple === "html" || simple === "*" || simple === "&") return true;
      if (simple.startsWith(".")) {
        const name = simple.slice(1);
        return KNOWN_ROOT_CLASSES.has(name) ? theme.classes.includes(name) : "maybe";
      }
      if (simple.startsWith("[")) {
        const parsed = /^\[\s*([\w-]+)\s*(?:([~|^$*]?=)\s*["']?([^"'\]]*)["']?)?\s*\]$/u.exec(
          simple,
        );
        if (!parsed || !KNOWN_ROOT_ATTRS.has(parsed[1])) return "maybe";
        const [, name, operator, value] = parsed;
        if (!operator) return name in attrs;
        if (operator !== "=") return "maybe";
        return attrs[name] === value;
      }
      const functional = /^:(not|is|where)\((.*)\)$/u.exec(simple);
      if (functional) {
        const inner = OR(splitTopLevel(functional[2], ",").map((item) => matchRoot(item, theme)));
        if (functional[1] !== "not") return inner;
        return inner === "maybe" ? "maybe" : !inner;
      }
      return "maybe";
    }),
  );
}

/** :root/html starts a root compound; a bare `.dark` or [data-fork…] one does when nothing else is in it. */
const isRootish = (compound) =>
  /^(?::root|html)(?![\w-])/u.test(compound) ||
  (/^(?:\.dark|\[data-fork)/u.test(compound) &&
    simpleSelectors(compound).every(
      (simple) =>
        /^\.dark$/u.test(simple) ||
        /^\[\s*data-fork[\w-]*/u.test(simple) ||
        /^:(?:not|is|where)\(/u.test(simple),
    ));

/** The selector's root compound (the :root/html/.dark part), or null when it has none. */
export function rootCompound(selector) {
  const first = compounds(selector)[0] ?? "";
  return isRootish(first) ? first : null;
}

/** Ids of the themes a selector can apply in. */
export function themesFor(selector) {
  const root = rootCompound(selector);
  return THEMES.filter((theme) => root === null || matchRoot(root, theme) !== false).map(
    (theme) => theme.id,
  );
}

const subjectCompound = (selector) => compounds(selector).at(-1) ?? "";

/** The root compound without its theme qualifiers, so theme variants of one rule compare equal. */
function themeKey(selector) {
  const root = rootCompound(selector);
  if (root === null) return { theme: "", tail: selector };
  const theme = [];
  const rest = [];
  for (const simple of simpleSelectors(root)) {
    (THEME_QUALIFIER.test(simple) ? theme : rest).push(simple);
  }
  const tail = selector.slice(selector.indexOf(root) + root.length).trim();
  return { theme: theme.join(""), tail: `${rest.join("")} ${tail}` };
}

/** What picks a theme on the root: the palette, its tone or colour, Glass's 3D mode, and dark. */
const THEME_QUALIFIER =
  /^(?:\.dark|:(?:not|is|where)\(\s*\.dark\s*\)|(?::(?:not|is|where)\(\s*)?\[\s*data-fork-(?:theme|basic-tone|inlet-color|glass-3d)\b)/u;

const NAMED_COLORS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet " +
    "brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan " +
    "darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta " +
    "darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue " +
    "darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey " +
    "dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray " +
    "green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush " +
    "lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray " +
    "lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray " +
    "lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon " +
    "mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue " +
    "mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin " +
    "navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen " +
    "paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple " +
    "rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna " +
    "silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle " +
    "tomato turquoise violet wheat white whitesmoke yellow yellowgreen"
  ).split(" "),
);

/** Properties where a bare word can be a colour. Elsewhere (animation names, grid areas) it is not. */
const COLOR_PROPERTY =
  /color|background|border|outline|fill|stroke|shadow|caret|accent|decoration|column-rule|^--/u;

const stripStringsAndUrls = (value) =>
  value.replace(/(["'])(?:\\.|(?!\1).)*\1/gu, '""').replace(/url\([^)]*\)/giu, "url()");

/** Colour literals in a value: hex, colour functions and named colours (on colour properties). */
export function colorLiterals(property, value) {
  const text = stripStringsAndUrls(value).replace(/--[\w-]+/gu, "--x");
  const out = [];
  for (const match of text.matchAll(/#[0-9a-f]{3,8}\b/giu)) {
    // #0000 and #00000000 are transparent, which Tailwind writes into its ring plumbing.
    if (!/^#0{4}(?:0{4})?$/u.test(match[0])) out.push(match[0]);
  }
  for (const match of text.matchAll(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/giu)) {
    let depth = 0;
    let end = match.index;
    for (; end < text.length; end++) {
      if (text[end] === "(") depth++;
      else if (text[end] === ")" && --depth === 0) break;
    }
    const call = text.slice(match.index, end + 1);
    // Relative colour syntax over a token (rgb(from var(--x) r g b / 12%)) derives from the token.
    if (!/^\w+\(\s*from\s+var\(/u.test(call)) out.push(call);
  }
  if (COLOR_PROPERTY.test(property)) {
    for (const match of text.matchAll(/(?<![\w-])[a-z]+(?![\w(-])/giu)) {
      if (NAMED_COLORS.has(match[0].toLowerCase())) out.push(match[0]);
    }
  }
  return out;
}

export function normalizeColor(literal) {
  const value = literal.toLowerCase().replace(/\s+/gu, " ").trim();
  const hex = /^#([0-9a-f]{3,8})$/u.exec(value);
  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
    return `#${digits.endsWith("ff") && digits.length === 8 ? digits.slice(0, 6) : digits}`;
  }
  const rgb =
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/u.exec(value);
  if (rgb) {
    const alpha =
      rgb[4] === undefined
        ? 1
        : rgb[4].endsWith("%")
          ? Number.parseFloat(rgb[4]) / 100
          : Number(rgb[4]);
    const channels = rgb
      .slice(1, 4)
      .map((channel) => Number(channel).toString(16).padStart(2, "0"));
    return alpha === 1 ? `#${channels.join("")}` : `rgb(${rgb.slice(1, 4).join(" ")} / ${alpha})`;
  }
  if (value === "white") return "#ffffff";
  if (value === "black") return "#000000";
  return value;
}

/** px literals, ignoring 0 and hairlines (±1px, 0.5px). */
const pxLiterals = (value) =>
  [
    ...stripStringsAndUrls(value)
      .replace(/--[\w-]+/gu, "--x")
      .matchAll(/(?<![\w.#-])-?(\d*\.?\d+)px\b/gu),
  ]
    .map((match) => Number(match[1]))
    .filter((px) => px !== 0 && px !== 1 && px !== 0.5);

/** Length literals (any unit) and bare numbers in a value. */
const numericLiterals = (value) =>
  [
    ...stripStringsAndUrls(value)
      .replace(/--[\w-]+/gu, "--x")
      .matchAll(/(?<![\w.#-])-?(\d*\.?\d+)([a-z%]*)/giu),
  ].map((match) => ({ number: Number(match[1]), unit: match[2].toLowerCase() }));

const RADIUS_PROPERTY = /radius$/u;
const SPACE_PROPERTY =
  /^(?:(?:min-|max-)?(?:width|height|block-size|inline-size)|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|gap|row-gap|column-gap)$/u;
const RADIUS_TOKEN_NAME = /radius/u;
const SPACE_TOKEN_NAME =
  /(?:^|-)(?:height|width|size|pad|padding|inset|gap|margin|space|spacing)(?:-|$)/u;
const TYPE_TOKEN_NAME = /(?:font-size|text-size|line-height|leading)/u;
const GEOMETRY_PROPERTY =
  /^(?:(?:min-|max-)?(?:width|height|block-size|inline-size)|padding(?:-[\w-]+)?|border(?:-[\w-]+)?-radius|font-size)$/u;

/** fork:begin/fork:end line ranges in an upstream file. */
function fenceRanges(text) {
  const ranges = [];
  let start = null;
  text.split("\n").forEach((content, index) => {
    if (/fork:begin\s/u.test(content) && start === null) start = index + 1;
    else if (/fork:end\s/u.test(content) && start !== null) {
      ranges.push([start, index + 1]);
      start = null;
    }
  });
  return ranges;
}

/** A rule that only sets custom properties under a root selector (or in @theme) is a token block. */
const isTokenBlock = (rule) =>
  rule.declarations.length > 0 &&
  rule.declarations.every((declaration) => declaration.property.startsWith("--")) &&
  (rule.kind === "at" || rule.selectors.every((selector) => rootCompound(selector) !== null));

export function loadStylesheet(path, text, { fenced = false } = {}) {
  const { rules, comments } = parseCss(text);
  const ranges = fenced ? fenceRanges(text) : null;
  const owns = (line) =>
    ranges === null || ranges.some(([start, end]) => line >= start && line <= end);
  return { path, text, rules, comments, owns };
}

function finding(rule, file, line, message, extra = {}) {
  return { rule, file, line, message, ...extra };
}

/** data-slot names the components/ui primitives stamp. */
export function primitiveSlots(root = REPO_ROOT) {
  const slots = new Set();
  for (const path of walk(
    root,
    `${WEB_SRC}/components/ui`,
    (file) => /\.tsx?$/u.test(file) && !isTestFile(file),
  )) {
    for (const match of read(root, path).matchAll(/data-slot="([\w-]+)"/gu)) slots.add(match[1]);
  }
  return slots;
}

/** Does the subject compound style a primitive? A slot only inside :not(…) does not count. */
const stylesPrimitive = (selector, slots) =>
  [...stripNot(subjectCompound(selector)).matchAll(/\[\s*data-slot\s*=\s*["']?([\w-]+)/gu)].some(
    (match) => slots.has(match[1]),
  );

function stripNot(compound) {
  let out = compound;
  for (let index = out.indexOf(":not("); index !== -1; index = out.indexOf(":not(")) {
    let depth = 0;
    let end = index + 4;
    for (; end < out.length; end++) {
      if (out[end] === "(") depth++;
      else if (out[end] === ")" && --depth === 0) break;
    }
    out = out.slice(0, index) + out.slice(end + 1);
  }
  return out;
}

export function checkStylesheet(sheet, slots = new Set()) {
  const out = [];
  for (const rule of sheet.rules) {
    if (rule.kind === "at" && rule.name !== "theme") continue;
    const tokenBlock = isTokenBlock(rule);
    const selectors = rule.kind === "style" ? rule.selectors : [];
    const themes = [...new Set(selectors.flatMap(themesFor))];
    const primitive =
      !rule.keyframes && selectors.some((selector) => stylesPrimitive(selector, slots));
    const pseudo = selectors.some((selector) =>
      /::(?:before|after)\b/u.test(subjectCompound(selector)),
    );
    for (const declaration of rule.declarations) {
      if (!sheet.owns(declaration.line)) continue;
      const { property, value, line } = declaration;
      const at = {
        ruleLine: rule.line,
        selector: selectors[0] ?? `@${rule.name}`,
        property,
        value,
        themes,
      };
      const custom = property.startsWith("--");
      const splittable = custom && selectors.every((selector) => rootCompound(selector) !== null);

      if (!tokenBlock && !/^(?:-webkit-)?mask/u.test(property) && !property.startsWith("--tw-")) {
        const colors = colorLiterals(property, value);
        if (colors.length > 0) {
          out.push(
            finding("A1", sheet.path, line, `${property}: ${value}`, {
              ...at,
              literals: colors,
              splittable,
            }),
          );
        }
      }
      if (
        !tokenBlock &&
        (custom ? RADIUS_TOKEN_NAME.test(property) : RADIUS_PROPERTY.test(property))
      ) {
        const px = pxLiterals(value);
        if (px.length > 0)
          out.push(
            finding("A2", sheet.path, line, `${property}: ${value}`, { ...at, px, splittable }),
          );
      } else if (
        !tokenBlock &&
        (custom ? SPACE_TOKEN_NAME.test(property) : SPACE_PROPERTY.test(property))
      ) {
        const px = pxLiterals(value);
        if (px.length > 0)
          out.push(
            finding("A3", sheet.path, line, `${property}: ${value}`, { ...at, px, splittable }),
          );
      }
      if (
        !tokenBlock &&
        (property === "font-size" ||
          property === "line-height" ||
          (custom && TYPE_TOKEN_NAME.test(property)))
      ) {
        const literals = numericLiterals(value).filter(({ number, unit }) =>
          property === "font-size" || /font-size|text-size/u.test(property)
            ? unit !== "" && !(number === 100 && unit === "%") && !(number === 1 && unit === "em")
            : !(unit === "" && (number === 0 || number === 1)),
        );
        if (literals.length > 0) {
          out.push(
            finding("A4", sheet.path, line, `${property}: ${value}`, {
              ...at,
              literals,
              splittable,
            }),
          );
        }
      }
      if (primitive && GEOMETRY_PROPERTY.test(property)) {
        out.push(
          finding("C1", sheet.path, line, `${property} on ${subjectCompound(selectors[0])}`, at),
        );
      }
      if (primitive) {
        const none = /^(?:none|0|0px)$/u.test(value);
        const cancels =
          (pseudo &&
            ((property === "display" && value === "none") ||
              (property === "content" && value === "none"))) ||
          (/^border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$/u.test(
            property,
          ) &&
            none) ||
          (property === "border-width" && none) ||
          (/^(?:-webkit-)?mask(?:-image)?$/u.test(property) && value === "none") ||
          (/^(?:box-shadow|background-image|backdrop-filter|-webkit-backdrop-filter)$/u.test(
            property,
          ) &&
            value === "none");
        if (cancels)
          out.push(
            finding(
              "C2",
              sheet.path,
              line,
              `${property}: ${value} on ${subjectCompound(selectors[0])}`,
              at,
            ),
          );
      }
    }
  }
  return out;
}

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

const VAR_REFERENCE = /var\(\s*(--[\w-]+)\s*(,)?/gu;

/** Custom properties every theme gets: @theme, @property and runtime setters in TS. */
function runtimeTokens(root) {
  const names = new Set();
  const sources = [
    ...walk(root, WEB_SRC, (path) => /\.tsx?$/u.test(path) && !isTestFile(path)),
    ...walk(root, "apps/desktop/src", (path) => /\.ts$/u.test(path) && !isTestFile(path)),
  ];
  for (const path of sources) {
    const text = read(root, path);
    for (const match of text.matchAll(/(?:setProperty\(\s*|["'`])(--[\w-]+)["'`]?\s*[:,\])]/gu)) {
      names.add(match[1]);
    }
    // Tailwind arbitrary properties: className="[--fork-x:20px]".
    for (const match of text.matchAll(/\[(--[\w-]+):/gu)) names.add(match[1]);
  }
  return names;
}

function tailwindTheme(root) {
  try {
    const require = NodeModule.createRequire(NodePath.join(root, "apps/web/package.json"));
    const path = require.resolve("tailwindcss/theme.css");
    return loadStylesheet("tailwindcss/theme.css", NodeFS.readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Every custom-property definition with the themes it can apply in. F1 (upstream token takeover)
 * reuses this: feed it upstream's consumers instead of the fork's.
 */
export function buildTokenIndex(sheets, runtime = new Set()) {
  const definitions = new Map();
  const define = (name, entry) => {
    const list = definitions.get(name) ?? [];
    list.push(entry);
    definitions.set(name, list);
  };
  const allThemes = THEMES.map((theme) => theme.id);
  for (const sheet of sheets) {
    for (const rule of sheet.rules) {
      if (rule.kind === "at") {
        if (rule.name === "property") {
          const name = /@property\s+(--[\w-]+)/u.exec(rule.prelude)?.[1];
          const initial = rule.declarations.find(
            (declaration) => declaration.property === "initial-value",
          );
          if (name)
            define(name, {
              themes: allThemes,
              value: initial?.value ?? "",
              file: sheet.path,
              line: rule.line,
            });
        }
        if (rule.name !== "theme") continue;
      }
      const themes =
        rule.kind === "at" ? allThemes : [...new Set(rule.selectors.flatMap(themesFor))];
      for (const declaration of rule.declarations) {
        if (!declaration.property.startsWith("--")) continue;
        define(declaration.property, {
          themes,
          value: declaration.value,
          file: sheet.path,
          line: declaration.line,
          tokenBlock: isTokenBlock(rule),
          global:
            rule.kind === "at" ||
            rule.selectors.every((selector) => compounds(selector).length === 1),
          tailwindDefault: sheet.path === "tailwindcss/theme.css",
        });
      }
    }
  }
  for (const name of runtime)
    define(name, { themes: allThemes, value: "", file: "(runtime)", line: 0 });
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
function tsxReferences(text) {
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
      if (entries.some((entry) => entry.themes.includes(theme.id))) continue;
      const key = `${consumer.name}␟${theme.id}`;
      if (reported.has(key)) continue;
      reported.add(key);
      const definedSomewhere = THEMES.some(
        (other) => other.enforced && entries.some((entry) => entry.themes.includes(other.id)),
      );
      out.push(
        finding(
          "C3",
          consumer.file,
          consumer.line,
          `${consumer.name} is not defined in ${theme.id}`,
          {
            token: consumer.name,
            theme: theme.id,
            enforced: theme.enforced,
            definedSomewhere,
          },
        ),
      );
    }
  }
  return out;
}

function cssConsumers(sheet) {
  const out = [];
  for (const rule of sheet.rules) {
    if (rule.kind === "at" && rule.name !== "theme") continue;
    const themes =
      rule.kind === "at"
        ? THEMES.map((theme) => theme.id)
        : [...new Set(rule.selectors.flatMap(themesFor))];
    for (const declaration of rule.declarations) {
      if (!sheet.owns(declaration.line)) continue;
      for (const reference of references(declaration.value)) {
        out.push({ ...reference, themes, file: sheet.path, line: declaration.line });
      }
    }
  }
  return out;
}

export function checkDeadForkAttributes(sheets, sourceText) {
  const templatePrefixes = [...sourceText.matchAll(/data-fork-([\w-]*?)-?\$\{/gu)].map(
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
        ...selector.matchAll(/\[\s*(data-fork-[\w-]+)(?:\s*=\s*["']([^"']*)["'])?/gu),
      ]);
      const names = new Set(attributes.map((match) => match[1]));
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
            }),
          );
        }
      }
      // A live attribute can still carry a value nothing sets.
      for (const [, name, value] of attributes) {
        if (value === undefined || !checked.get(name)) continue;
        const escaped = value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        if (!new RegExp(`["'\`]${escaped}["'\`]`, "u").test(sourceText)) {
          out.push(
            finding(
              "C5",
              sheet.path,
              rule.line,
              `[${name}="${value}"]: no source sets "${value}"`,
              { attribute: name, selector: rule.selectors[0] },
            ),
          );
        }
      }
    }
  }
  return out;
}

const EXPORTED_COMPONENT =
  /^export (?:default )?(?:function ([A-Z]\w*)|const ([A-Z]\w*)\s*(?::[^=]+)?=\s*(?:memo|forwardRef|React\.memo|function|\())/gmu;

export function exportedComponents(text) {
  return [...text.matchAll(EXPORTED_COMPONENT)]
    .map((match) => ({
      name: match[1] ?? match[2],
      line: text.slice(0, match.index).split("\n").length,
    }))
    .filter(({ name }) => /[a-z]/u.test(name) && !/(?:Provider|Context)$/u.test(name));
}

export function storyImports(text) {
  const names = new Set();
  for (const match of text.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["'][^"']*custom\/[^"']*["']/gu,
  )) {
    for (const part of match[1].split(",")) {
      const name = part
        .trim()
        .replace(/^type\s+/u, "")
        .split(/\s+as\s+/u)[0];
      if (name) names.add(name);
    }
  }
  return names;
}

/** A component has a story when a story imports it, or a story file is named after it. */
function checkStories(root) {
  const stories = walk(root, "apps/fork-storybook/stories", (path) =>
    /\.(?:tsx?|mdx)$/u.test(path),
  );
  const storied = new Set([
    ...stories.flatMap((path) => [...storyImports(read(root, path))]),
    ...stories.map((path) => NodePath.basename(path).replace(/\.stories\.\w+$/u, "")),
  ]);
  const out = [];
  for (const path of walk(
    root,
    `${WEB_SRC}/custom`,
    (file) => file.endsWith(".tsx") && !isTestFile(file),
  )) {
    for (const component of exportedComponents(read(root, path))) {
      if (!storied.has(component.name)) {
        out.push(
          finding("B5", path, component.line, `${component.name} has no story`, {
            component: component.name,
          }),
        );
      }
    }
  }
  return out;
}

const DISABLE =
  /^\s*design-lint-disable-next-line\s+([A-Z]\d(?:\s*,\s*[A-Z]\d)*)\s*(?:--\s*(.*?))?\s*$/su;

export function applySuppressions(findings, sheets) {
  const directives = [];
  for (const sheet of sheets) {
    const lines = sheet.text.split("\n");
    for (const comment of sheet.comments) {
      const parsed = DISABLE.exec(comment.text);
      if (!parsed) continue;
      let target = comment.endLine + 1;
      while (target <= lines.length && /^\s*(?:\/\*.*\*\/)?\s*$/u.test(lines[target - 1] ?? ""))
        target++;
      directives.push({
        file: sheet.path,
        line: comment.line,
        target,
        rules: parsed[1].split(/\s*,\s*/u),
        reason: parsed[2]?.trim() ?? "",
        used: false,
      });
    }
  }
  const kept = findings.filter((entry) => {
    const directive = directives.find(
      (candidate) =>
        candidate.file === entry.file &&
        candidate.rules.includes(entry.rule) &&
        (candidate.target === entry.line || candidate.target === entry.ruleLine),
    );
    if (!directive) return true;
    directive.used = true;
    return false;
  });
  for (const directive of directives) {
    if (!directive.reason)
      kept.push(finding("S1", directive.file, directive.line, "say why after `--`"));
    if (!directive.used)
      kept.push(
        finding(
          "S2",
          directive.file,
          directive.line,
          `nothing to suppress for ${directive.rules.join(", ")}`,
        ),
      );
  }
  return kept;
}

const allowlisted = (entry) =>
  ALLOWLIST.some(
    (allowed) =>
      allowed.rule === entry.rule &&
      (allowed.file === undefined || allowed.file === entry.file) &&
      (entry.selector ?? entry.component ?? "").includes(allowed.match),
  );

const parseReport = (stdout) => {
  const start = stdout.indexOf("{");
  if (start === -1) return undefined;
  try {
    return JSON.parse(stdout.slice(start));
  } catch {
    return undefined;
  }
};

function runOxlint(root) {
  const files = forkTsxFiles(root, ["custom", "overrides"]);
  const codes = new Map(
    Object.entries(DESIGN_OXLINT_RULE_IDS).map(([rule, id]) => [
      rule.replace(/^([^/]+)\/(.+)$/u, "$1($2)"),
      id,
    ]),
  );
  const result = NodeChildProcess.spawnSync("vp", ["lint", ...files, "--format", "json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, [DESIGN_LINT_ENV]: "1" },
  });
  const report = result.error ? undefined : parseReport(result.stdout);
  if (report === undefined) {
    throw new Error(`could not read vp lint output: ${result.error?.message ?? result.stderr}`);
  }
  if (report.number_of_files !== files.length) {
    throw new Error(
      `expected to lint ${files.length} fork TSX files, oxlint reported ${report.number_of_files}`,
    );
  }
  // shadcn reports a class once per branch of a cn() it appears in; count each class once per line.
  const seen = new Set();
  return (report.diagnostics ?? [])
    .filter((diagnostic) => codes.has(diagnostic.code))
    .filter((diagnostic) => {
      const key = `${diagnostic.filename}:${diagnostic.labels?.[0]?.span?.line}:${diagnostic.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((diagnostic) =>
      finding(
        codes.get(diagnostic.code),
        diagnostic.filename,
        diagnostic.labels?.[0]?.span?.line ?? 0,
        diagnostic.message,
        {
          oxlint: diagnostic.code,
        },
      ),
    );
}

/** Resolve a token to px (or a unitless number) in one theme, following var() and simple calc. */
function makeResolver(definitions) {
  const cache = new Map();
  const resolve = (name, themeId, seen = new Set()) => {
    const key = `${name}␟${themeId}`;
    if (cache.has(key)) return cache.get(key);
    if (seen.has(name)) return null;
    seen.add(name);
    // App-wide definitions outrank subtree overrides, and the app outranks Tailwind defaults.
    let candidates = (definitions.get(name) ?? []).filter(
      (entry) => entry.themes.includes(themeId) && entry.value,
    );
    if (candidates.some((entry) => entry.global))
      candidates = candidates.filter((entry) => entry.global);
    if (candidates.some((entry) => !entry.tailwindDefault)) {
      candidates = candidates.filter((entry) => !entry.tailwindDefault);
    }
    const values = new Set(candidates.map((entry) => evaluate(entry.value, themeId, seen)));
    const result = values.size === 1 ? [...values][0] : null;
    cache.set(key, result);
    return result;
  };
  const evaluate = (expression, themeId, seen) => {
    const source = expression.trim().replace(/^calc\((.*)\)$/su, "$1");
    const tokens = source.match(
      /var\([^()]*(?:\([^()]*\)[^()]*)*\)|-?\d*\.?\d+(?:px|rem|em)?|[-+*/()]/gu,
    );
    if (!tokens || tokens.join("").replace(/\s/gu, "") !== source.replace(/\s|calc/gu, ""))
      return null;
    let position = 0;
    const primary = () => {
      const token = tokens[position++];
      if (token === "(") {
        const value = sum();
        position++;
        return value;
      }
      if (token?.startsWith("var(")) {
        const parsed = /^var\(\s*(--[\w-]+)\s*(?:,(.*))?\)$/su.exec(token);
        if (!parsed) return null;
        const resolved =
          resolve(parsed[1], themeId, new Set(seen)) ??
          (parsed[2] ? evaluate(parsed[2], themeId, seen) : null);
        if (resolved === null) return null;
        return resolved.endsWith("px")
          ? { px: Number.parseFloat(resolved) }
          : { n: Number(resolved) };
      }
      const number = /^(-?\d*\.?\d+)(px|rem|em)?$/u.exec(token ?? "");
      if (!number) return null;
      const value = Number(number[1]);
      return number[2] === "rem"
        ? { px: value * 16 }
        : number[2] === "px"
          ? { px: value }
          : number[2]
            ? null
            : { n: value };
    };
    const product = () => {
      let left = primary();
      while (tokens[position] === "*" || tokens[position] === "/") {
        const operator = tokens[position++];
        const right = primary();
        if (!left || !right) return null;
        const scalar = right.n ?? null;
        if (operator === "*") {
          if (left.n !== undefined && right.px !== undefined) left = { px: left.n * right.px };
          else if (scalar !== null)
            left = left.px !== undefined ? { px: left.px * scalar } : { n: left.n * scalar };
          else return null;
        } else if (scalar !== null && scalar !== 0) {
          left = left.px !== undefined ? { px: left.px / scalar } : { n: left.n / scalar };
        } else return null;
      }
      return left;
    };
    const sum = () => {
      let left = product();
      while (tokens[position] === "+" || tokens[position] === "-") {
        const operator = tokens[position++];
        const right = product();
        if (!left || !right || (left.px === undefined) !== (right.px === undefined)) return null;
        left =
          left.px !== undefined
            ? { px: left.px + (operator === "+" ? right.px : -right.px) }
            : { n: left.n + (operator === "+" ? right.n : -right.n) };
      }
      return left;
    };
    const value = sum();
    if (!value || position !== tokens.length) return null;
    return value.px !== undefined
      ? `${Math.round(value.px * 1000) / 1000}px`
      : `${Math.round(value.n * 1000) / 1000}`;
  };
  return resolve;
}

/** Tokens holding exactly `value` in every theme of `themes`, from names matching `family`. */
function tokensWithValue(definitions, resolve, family, value, themes, colorMode = false) {
  const out = [];
  if (themes.length === 0) return out;
  for (const [name, entries] of definitions) {
    if (!family.test(name) || isRuntimeToken(name)) continue;
    const matches = themes.every((themeId) => {
      if (colorMode) {
        const literal = entries
          .filter((entry) => entry.tokenBlock !== false && entry.themes.includes(themeId))
          .map((entry) => normalizeColor(entry.value));
        return literal.length > 0 && literal.every((candidate) => candidate === value);
      }
      return resolve(name, themeId) === value;
    });
    if (matches) out.push(name);
  }
  // Suggest app-wide tokens before ones scoped to a component.
  const global = (name) => (definitions.get(name) ?? []).some((entry) => entry.global);
  return out.sort(
    (left, right) => Number(global(right)) - Number(global(left)) || left.length - right.length,
  );
}

/** The scale a rule prefers when several tokens hold the value. */
const SCALE = {
  A2: /^--radius-/u,
  A3: /^--spacing/u,
  A4: /^--(?:text-[a-z0-9]+|leading-[a-z]+)$/u,
};

const FAMILY = {
  A2: /radius/u,
  A3: /^--(?:spacing|[\w-]*(?:height|width|size|pad|padding|inset|gap|margin|space))/u,
  A4font: /^--(?:text-[\w-]+$|font-size)|font-size/u,
  A4line: /line-height|leading/u,
};

export function classify(findings, definitions) {
  const resolve = makeResolver(definitions);
  const repeats = new Map();
  for (const entry of findings) {
    if (entry.rule === "A1" && entry.literals) {
      for (const literal of entry.literals) {
        const key = normalizeColor(literal);
        repeats.set(key, (repeats.get(key) ?? 0) + 1);
      }
    }
  }
  const colorTokens = new Map();
  for (const entry of findings) {
    const applicable = entry.themes ?? [];
    const enforced = applicable.filter((id) => THEMES.find((theme) => theme.id === id)?.enforced);
    const themes = enforced.length > 0 ? enforced : applicable;
    switch (entry.oxlint && entry.rule === "A1" ? "A1-tsx" : entry.rule) {
      case "A1": {
        const hints = entry.literals.map((literal) => {
          const key = `${normalizeColor(literal)}␟${themes.join(",")}`;
          if (!colorTokens.has(key)) {
            colorTokens.set(
              key,
              tokensWithValue(definitions, resolve, /^--/u, normalizeColor(literal), themes, true),
            );
          }
          return colorTokens.get(key);
        });
        if (hints.every((names) => names.length > 0)) {
          entry.fix = "mechanical";
          entry.hint = `same value as ${hints.map((names) => names[0]).join(", ")}`;
        } else if (entry.splittable) {
          entry.fix = "mechanical";
          entry.hint = "move the custom property into its own token block";
        } else {
          entry.fix = entry.literals.some(
            (literal) => (repeats.get(normalizeColor(literal)) ?? 0) > 1,
          )
            ? "new-token"
            : "judgement";
        }
        break;
      }
      case "A2":
      case "A3":
      case "A4": {
        const values =
          entry.rule === "A4"
            ? entry.literals.map(({ number, unit }) =>
                unit === "rem" ? `${number * 16}px` : unit ? `${number}${unit}` : `${number}`,
              )
            : entry.px.map((px) => `${px}px`);
        const family =
          entry.rule === "A4"
            ? entry.property === "font-size"
              ? FAMILY.A4font
              : FAMILY.A4line
            : FAMILY[entry.rule];
        const hints = values.map((value) => {
          const px = Number.parseFloat(value);
          // The spacing scale first: a named token that merely shares the value says the wrong thing.
          // Tailwind's leading-N is the same scale, so px line heights take it too.
          const onScale =
            entry.rule === "A3" || (entry.rule === "A4" && entry.property === "line-height");
          if (onScale && value.endsWith("px") && px % 2 === 0) {
            return `calc(var(--spacing) * ${px / 4})`;
          }
          const named = tokensWithValue(definitions, resolve, family, value, themes);
          return named.find((name) => SCALE[entry.rule].test(name)) ?? named[0] ?? null;
        });
        if (hints.every(Boolean)) {
          entry.fix = "mechanical";
          entry.hint = hints.join(", ");
        } else if (entry.splittable) {
          entry.fix = "mechanical";
          entry.hint = "move the custom property into its own token block";
        } else {
          entry.fix = /calc\(|var\(/u.test(entry.value) ? "judgement" : "new-token";
        }
        break;
      }
      case "A5":
        entry.fix =
          /same value/u.test(entry.message) || /\[var\(--/u.test(entry.message)
            ? "mechanical"
            : /Nearest on the scale/u.test(entry.message) || /\[\d/u.test(entry.message)
              ? "new-token"
              : "judgement";
        break;
      case "B4":
        entry.fix = /lucide-react|"lucide"/u.test(entry.source ?? "") ? "mechanical" : "judgement";
        break;
      case "C3":
        entry.fix = entry.definedSomewhere ? "new-token" : "judgement";
        break;
      case "C5":
        entry.fix = "mechanical";
        break;
      case "C6":
        entry.fix = entry.kind === "identical" ? "mechanical" : "new-token";
        break;
      default:
        entry.fix = "judgement";
    }
  }
  return findings;
}

export function collectFindings(root = REPO_ROOT, { oxlint = true } = {}) {
  const forkSheets = forkCssFiles(root).map((path) => loadStylesheet(path, read(root, path)));
  const fencedSheets = FENCED_CSS_FILES.filter((path) =>
    NodeFS.existsSync(NodePath.join(root, path)),
  ).map((path) => loadStylesheet(path, read(root, path), { fenced: true }));
  const checked = [...forkSheets, ...fencedSheets];
  const otherSheets = walk(root, WEB_SRC, (path) => path.endsWith(".css"))
    .filter((path) => !checked.some((sheet) => sheet.path === path))
    .map((path) => loadStylesheet(path, read(root, path)));
  const tailwind = tailwindTheme(root);
  const definitions = buildTokenIndex(
    [...(tailwind ? [tailwind] : []), ...checked, ...otherSheets].map((sheet) => ({
      ...sheet,
      owns: () => true,
    })),
    runtimeTokens(root),
  );

  // The design-mode engine draws in the previewed page's shadow root, not this document.
  const tsxConsumers = forkTsxFiles(root, ["custom", "overrides"])
    .filter((path) => !path.includes("/designMode/engine/"))
    .flatMap((path) =>
      tsxReferences(read(root, path)).map((reference) => ({
        ...reference,
        file: path,
        themes: THEMES.map((theme) => theme.id),
      })),
    );
  const sourceText = [
    ...walk(root, WEB_SRC, (path) => /\.(?:tsx?|mjs|html)$/u.test(path) && !isTestFile(path)),
    ...walk(root, "apps/desktop/src", (path) => /\.ts$/u.test(path) && !isTestFile(path)),
    "apps/web/index.html",
  ]
    .filter((path) => NodeFS.existsSync(NodePath.join(root, path)))
    .map((path) => read(root, path))
    .join("\n");

  const slots = primitiveSlots(root);
  let findings = [
    ...checked.flatMap((sheet) => checkStylesheet(sheet, slots)),
    ...checkDuplicatedThemeBlocks(checked),
    ...checkThemeContract([...checked.flatMap(cssConsumers), ...tsxConsumers], definitions),
    ...checkDeadForkAttributes(checked, sourceText),
    ...checkStories(root),
  ];
  findings = applySuppressions(findings, checked).filter((entry) => !allowlisted(entry));
  if (oxlint) {
    findings.push(
      ...runOxlint(root).map((entry) => {
        if (entry.rule !== "B4") return entry;
        const line = read(root, entry.file).split("\n")[entry.line - 1] ?? "";
        return { ...entry, source: /from\s+["']([^"']+)["']/u.exec(line)?.[1] ?? line };
      }),
    );
  }
  return classify(findings, definitions);
}

export function summarize(findings) {
  const byRule = {};
  const byFile = {};
  for (const entry of findings) {
    const rule = (byRule[entry.rule] ??= { total: 0, mechanical: 0, "new-token": 0, judgement: 0 });
    rule.total++;
    rule[entry.fix]++;
    byFile[entry.file] ??= {};
    byFile[entry.file][entry.rule] = (byFile[entry.file][entry.rule] ?? 0) + 1;
  }
  return { byRule, byFile };
}

/** Glass 3D is best effort: a finding only it can see is reported, never blocking. */
export function isBlocking(entry) {
  if (entry.rule === "C3") return entry.enforced;
  if (!entry.themes || entry.themes.length === 0) return true;
  return entry.themes.some((id) => THEMES.find((theme) => theme.id === id)?.enforced);
}

function printReport(findings) {
  const { byRule, byFile } = summarize(findings);
  console.log("rule  total  mechanical  new-token  judgement  what");
  for (const rule of Object.keys(RULE_TITLES)) {
    const counts = byRule[rule];
    if (!counts) continue;
    console.log(
      `${rule.padEnd(4)}  ${String(counts.total).padStart(5)}  ${String(counts.mechanical).padStart(10)}  ` +
        `${String(counts["new-token"]).padStart(9)}  ${String(counts.judgement).padStart(9)}  ${RULE_TITLES[rule]}`,
    );
  }
  const bestEffort = findings.filter((entry) => !isBlocking(entry)).length;
  console.log(
    `\n${findings.length} findings (${bestEffort} only in Glass 3D, best effort). Top files:`,
  );
  const files = Object.entries(byFile)
    .map(([file, rules]) => [
      file,
      Object.values(rules).reduce((sum, count) => sum + count, 0),
      rules,
    ])
    .sort((left, right) => right[1] - left[1]);
  for (const [file, total, rules] of files.slice(0, 25)) {
    const detail = Object.entries(rules)
      .map(([rule, count]) => `${rule} ${count}`)
      .join(", ");
    console.log(`  ${String(total).padStart(4)}  ${file}  (${detail})`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const report = args.includes("--report");
  const check = args.includes("--check");
  if (report === check) {
    console.error(
      "usage: node .fork/design-lint.mjs --report [--json <file>] | --check  [--no-oxlint]",
    );
    process.exit(2);
  }
  const findings = collectFindings(REPO_ROOT, { oxlint: !args.includes("--no-oxlint") });
  if (report) {
    printReport(findings);
    const jsonIndex = args.indexOf("--json");
    const jsonPath =
      jsonIndex === -1
        ? NodePath.join(REPO_ROOT, "node_modules/.cache/fork-design-lint/inventory.json")
        : NodePath.resolve(args[jsonIndex + 1]);
    NodeFS.mkdirSync(NodePath.dirname(jsonPath), { recursive: true });
    NodeFS.writeFileSync(
      jsonPath,
      `${JSON.stringify({ summary: summarize(findings), findings }, null, 2)}\n`,
    );
    console.log(`\ninventory: ${NodePath.relative(REPO_ROOT, jsonPath)}`);
    return;
  }
  const blocking = findings.filter(isBlocking);
  for (const entry of blocking) {
    console.error(`  ${entry.file}:${entry.line}  ${entry.rule}  ${entry.message}`);
  }
  if (blocking.length > 0) {
    console.error(
      `\ndesign-lint: ${blocking.length} finding(s). Rules and fixes: .fork/DESIGN-RULES.md`,
    );
    process.exit(1);
  }
  console.log("design-lint: clean.");
}

if (process.argv[1] && import.meta.url === NodeURL.pathToFileURL(process.argv[1]).href) {
  main();
}
