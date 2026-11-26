/** The themes the rules hold fork CSS to, and which of them a selector can apply in. */

import { compounds, simpleSelectors, splitTopLevel } from "./css.mjs";

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

/** The root compound without its theme qualifiers, so theme variants of one rule compare equal. */
export function themeKey(selector) {
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

/** Glass 3D is best effort: a finding only it can see is reported, never blocking. */
export function isBlocking(entry) {
  if (entry.rule === "C3") return entry.enforced;
  if (!entry.themes || entry.themes.length === 0) return true;
  return entry.themes.some((id) => THEMES.find((theme) => theme.id === id)?.enforced);
}
