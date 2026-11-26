/** A1–A4: fork CSS takes colours, radii, spacing and type from tokens. */

import { finding } from "../sources.mjs";
import { rootCompound, themesFor } from "../themes.mjs";
import { primitiveFindings, primitiveTarget } from "./primitives.mjs";

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
    // Channels from a token (rgb(from var(--x) r g b / 12%), rgb(var(--tint) / 8%)) derive from it.
    if (!/^\w+\(\s*(?:from\s+)?var\(/u.test(call)) out.push(call);
  }
  if (COLOR_PROPERTY.test(property)) {
    for (const match of text.matchAll(/(?<![\w-])[a-z]+(?![\w(-])/giu)) {
      if (NAMED_COLORS.has(match[0].toLowerCase())) out.push(match[0]);
    }
  }
  return out;
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
const INTERFACE_SCALED_REM =
  /-?\d*\.?\d+rem\s*\*\s*(?:var\(\s*--fork-chat-text-scale\s*,\s*1\s*\)\s*\*\s*)?var\(\s*--fork-interface-text-scale\s*,\s*1\s*\)/gu;
const SPACE_PROPERTY =
  /^(?:(?:min-|max-)?(?:width|height|block-size|inline-size)|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|gap|row-gap|column-gap)$/u;
const RADIUS_TOKEN_NAME = /radius/u;
const SPACE_TOKEN_NAME =
  /(?:^|-)(?:height|width|size|pad|padding|inset|gap|margin|space|spacing)(?:-|$)/u;
const TYPE_TOKEN_NAME = /(?:font-size|text-size|line-height|leading)/u;

/** A rule that only sets custom properties under a root selector (or in @theme) is a token block. */
export const isTokenBlock = (rule) =>
  rule.declarations.length > 0 &&
  rule.declarations.every((declaration) => declaration.property.startsWith("--")) &&
  (rule.selectors
    ? rule.selectors.every((selector) => rootCompound(selector) !== null)
    : rule.kind === "at");

function valueFindings(sheet, declaration, at, tokenBlock) {
  if (tokenBlock) return [];
  const out = [];
  const { property, value, line } = declaration;
  const custom = property.startsWith("--");
  const report = (rule) => out.push(finding(rule, sheet.path, line, `${property}: ${value}`, at));
  if (
    !/^(?:-webkit-)?mask/u.test(property) &&
    !property.startsWith("--tw-") &&
    colorLiterals(property, value).length > 0
  ) {
    report("A1");
  }
  if (custom ? RADIUS_TOKEN_NAME.test(property) : RADIUS_PROPERTY.test(property)) {
    if (pxLiterals(value).length > 0) report("A2");
  } else if (custom ? SPACE_TOKEN_NAME.test(property) : SPACE_PROPERTY.test(property)) {
    if (pxLiterals(value).length > 0) report("A3");
  }
  if (
    property === "font-size" ||
    property === "line-height" ||
    (custom && TYPE_TOKEN_NAME.test(property))
  ) {
    // A step on the spacing scale (calc(var(--spacing) * 4)) is the scale, not a ratio, and
    // a rem size times the interface text scale is a text size that follows the setting.
    const literals = numericLiterals(
      value
        .replace(/var\(\s*--spacing\s*\)\s*\*\s*-?\d*\.?\d+/gu, "var(--spacing)")
        .replace(INTERFACE_SCALED_REM, "var(--text-base)"),
    ).filter(({ number, unit }) =>
      property === "font-size" || /font-size|text-size/u.test(property)
        ? unit !== "" && !(number === 100 && unit === "%") && !(number === 1 && unit === "em")
        : !(unit === "" && (number === 0 || number === 1)),
    );
    if (literals.length > 0) report("A4");
  }
  return out;
}

/** A1–A4 and C1–C2 over one sheet, declaration by declaration. */
export function checkStylesheet(sheet, slots = new Set()) {
  const out = [];
  for (const rule of sheet.rules) {
    if (rule.kind === "at" && rule.name !== "theme" && !rule.selectors) continue;
    const tokenBlock = isTokenBlock(rule);
    const selectors = rule.selectors ?? [];
    const themes = [...new Set(selectors.flatMap(themesFor))];
    const target = primitiveTarget(rule, slots);
    for (const declaration of rule.declarations) {
      if (!sheet.owns(declaration.line)) continue;
      const at = { ruleLine: rule.line, selector: selectors[0] ?? `@${rule.name}`, themes };
      out.push(
        ...valueFindings(sheet, declaration, at, tokenBlock),
        ...primitiveFindings(sheet, rule, declaration, at, target),
      );
    }
  }
  return out;
}
