#!/usr/bin/env node
/**
 * Fork design-system lint: the CSS and cross-file rules of .fork/DESIGN-RULES.md, the ones
 * oxlint cannot see (`vp lint` carries the TSX rules). `--check` fails on any finding.
 */

import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import {
  compounds,
  loadStylesheet,
  simpleSelectors,
  splitTopLevel,
  stripFunctions,
  subjectCompound,
} from "./design-lint/css.mjs";

export { loadStylesheet } from "./design-lint/css.mjs";

const FORK_DIR = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const REPO_ROOT = NodePath.resolve(FORK_DIR, "..");
const WEB_SRC = "apps/web/src";

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
 * `match` is a substring of the selector (or of the component name for B5); a B5 `name` must match
 * the component exactly. Each needs a reason.
 */
export const ALLOWLIST = [
  // { rule: "A1", file: "apps/web/src/theme.custom.css", match: ".fork-wordmark", reason: "…" },
  ...b5Exempt("route page", {
    "scheduled/ScheduledPage.tsx": ["ScheduledPage"],
    "scheduled/ScheduledTaskDetail.tsx": ["ScheduledTaskDetail"],
    "scheduled/ScheduledTaskEditor.tsx": ["ScheduledTaskEditor"],
  }),
  ...b5Exempt("page layout: lays out one screen or panel", {
    "DraftLaunchpad.tsx": ["DraftLaunchpad"],
    "sideChat/SideChatShell.tsx": ["SideChatShell"],
    "splitThreads/SplitThreadPanes.tsx": ["SplitThreadPanes"],
    "bots/BotThreadsPanel.tsx": ["BotThreadsPanel"],
    "designMode/panel/ForkDesignPanel.tsx": ["ForkDesignPanel"],
    "designMode/ForkLayersTree.tsx": ["ForkLayersTree"],
  }),
  ...b5Exempt("section: lays out storied atoms for one region of one screen", {
    "SidebarV2ChromeRows.tsx": ["SidebarV2ChromeActionRows", "SidebarV2ChatActionRows"],
    "CollapsedThreadTabs.tsx": ["CollapsedThreadTabs"],
    "bots/CollapsedPetalTabs.tsx": ["CollapsedPetalTabs"],
    "bots/SidebarV2BotsSection.tsx": ["SidebarV2BotsRow"],
    "bots/BotMascotDetailsSection.tsx": ["BotMascotDetailsSection"],
    "bots/BotDigest.tsx": ["BotDigestAsks"],
    "scheduled/ScheduledRunsTable.tsx": ["ScheduledRunsHeader", "ScheduledRunRows"],
    "designMode/panel/SentPreviewResolution.tsx": ["SentPreviewResolution"],
    "designMode/panel/sections/AppearanceSection.tsx": ["AppearanceSection"],
    "designMode/panel/sections/LayoutSection.tsx": ["LayoutSection"],
    "designMode/panel/sections/PaintSections.tsx": [
      "FillSection",
      "StrokeSection",
      "MarginSection",
    ],
    "designMode/panel/sections/PositionSection.tsx": ["PositionSection"],
    "designMode/panel/sections/TypographySection.tsx": ["TypographySection"],
    "designMode/panel/sections/section.tsx": ["SideFields"],
  }),
  ...b5Exempt("provider/host: draws no UI of its own", {
    "ForkSubagentLinkChip.tsx": ["ForkSubagentLinkScope"],
    "forkTimelineRowMotion.tsx": ["ForkTimelineRowFrame"],
    "voice/ForkDictationHotkeyHost.tsx": ["ForkDictationHotkeyHost"],
    "designMode/ForkPreviewDesignMode.tsx": ["ForkPreviewDesignMode"],
    // Renders whatever the picker's host passes for a model row.
    "modelRowControl.tsx": ["RowControlSlot"],
  }),
  ...b5Exempt("screen backdrop: full-bleed art behind a screen", {
    "BasicNewAgentBackdrop.tsx": ["BasicNewAgentBackdrop"],
    "pixelTexture/PixelTextureBackdrop.tsx": ["PixelTextureBackdrop"],
  }),
  ...b5Exempt("wrapper: the unstyled base under Tabs and MenuTabs (Components/Tabs)", {
    "SegmentedTabs.tsx": ["SegmentedTabs", "SegmentedTab", "SegmentedMenuTabs", "SegmentedMenuTab"],
  }),
  ...b5Exempt("wrapper: reads live thread state, then draws a storied view", {
    // ForkSubagentCardView, Fork/Subagent card.
    "ForkSubagentGroup.tsx": ["ForkSubagentGroup", "ForkSubagentNotice"],
    // SubagentLinkMark in a ContextChip, Fork/Subagent link.
    "ForkSubagentLinkChip.tsx": ["ForkSubagentLinkChip"],
    // BotMascot, Fork/Petal mascot.
    "bots/BotMascot.tsx": ["BotEmptyConversation", "BotHeaderMascot"],
    // SidebarProviderUpdatesButtonView.
    "SidebarProviderUpdatesButton.tsx": ["SidebarProviderUpdatesButton"],
    // MusicStripCardView, Fork/Music strip.
    "music/MusicStrip.tsx": ["SidebarMusicStrip"],
  }),
  ...b5Exempt("wrapper around ComposerModelPicker", {
    "scheduled/ScheduledTaskModelPicker.tsx": ["ScheduledTaskModelPicker"],
  }),
  ...b5Exempt("wrapper around upstream's ThreadHoverCardPopup, which places it", {
    "SubagentRowHoverCardPopup.tsx": ["SubagentRowHoverCardPopup"],
  }),
  // Pending (Nov 25): these read live state (stores, queries, git status) and have no
  // props-only view yet, so a story needs a *View split first. The split is a design call.
  ...b5Exempt("pending: reads live state, needs a *View split for a story", {
    "ComposerModelPicker.tsx": ["ComposerModelPicker"],
    "ComposerNextStepPill.tsx": ["ComposerNextStepPill"],
    "DraftMachineChip.tsx": ["DraftMachineChip"],
    "DraftProjectPill.tsx": ["DraftProjectPill"],
    "SidebarV2AutomationsHoverCard.tsx": ["SidebarV2AutomationsHoverCard"],
    "bots/BotThreadsPanelToggle.tsx": ["BotThreadsPanelToggle"],
  }),
];

/** B5 entries for components that are not atomic: one per name, which must match exactly. */
function b5Exempt(reason, byFile) {
  return Object.entries(byFile).flatMap(([file, names]) =>
    names.map((name) => ({ rule: "B5", file: `${WEB_SRC}/custom/${file}`, name, reason })),
  );
}

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
const GEOMETRY_PROPERTY =
  /^(?:(?:min-|max-)?(?:width|height|block-size|inline-size)|padding(?:-[\w-]+)?|border(?:-[\w-]+)?-radius|font-size)$/u;

/** A rule that only sets custom properties under a root selector (or in @theme) is a token block. */
const isTokenBlock = (rule) =>
  rule.declarations.length > 0 &&
  rule.declarations.every((declaration) => declaration.property.startsWith("--")) &&
  (rule.selectors
    ? rule.selectors.every((selector) => rootCompound(selector) !== null)
    : rule.kind === "at");

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

/** Does the subject compound style a primitive? A slot only inside :not(…) or :has(…) does not. */
const stylesPrimitive = (selector, slots) =>
  [
    ...stripFunctions(subjectCompound(selector), [":not(", ":has("]).matchAll(
      /\[\s*data-slot\s*=\s*["']?([\w-]+)/gu,
    ),
  ].some((match) => slots.has(match[1]));

export function checkStylesheet(sheet, slots = new Set()) {
  const out = [];
  for (const rule of sheet.rules) {
    if (rule.kind === "at" && rule.name !== "theme" && !rule.selectors) continue;
    const tokenBlock = isTokenBlock(rule);
    const selectors = rule.selectors ?? [];
    const themes = [...new Set(selectors.flatMap(themesFor))];
    const primitive =
      !rule.keyframes && selectors.some((selector) => stylesPrimitive(selector, slots));
    const pseudo = selectors.some(
      (selector) =>
        stylesPrimitive(selector, slots) &&
        /::(?:before|after)\b/u.test(subjectCompound(selector).replace(/\[[^\]]*\]/gu, "")),
    );
    for (const declaration of rule.declarations) {
      if (!sheet.owns(declaration.line)) continue;
      const { property, value, line } = declaration;
      const at = { ruleLine: rule.line, selector: selectors[0] ?? `@${rule.name}`, themes };
      const custom = property.startsWith("--");

      if (
        !tokenBlock &&
        !/^(?:-webkit-)?mask/u.test(property) &&
        !property.startsWith("--tw-") &&
        colorLiterals(property, value).length > 0
      ) {
        out.push(finding("A1", sheet.path, line, `${property}: ${value}`, at));
      }
      if (
        !tokenBlock &&
        (custom ? RADIUS_TOKEN_NAME.test(property) : RADIUS_PROPERTY.test(property))
      ) {
        if (pxLiterals(value).length > 0)
          out.push(finding("A2", sheet.path, line, `${property}: ${value}`, at));
      } else if (
        !tokenBlock &&
        (custom ? SPACE_TOKEN_NAME.test(property) : SPACE_PROPERTY.test(property))
      ) {
        if (pxLiterals(value).length > 0)
          out.push(finding("A3", sheet.path, line, `${property}: ${value}`, at));
      }
      if (
        !tokenBlock &&
        (property === "font-size" ||
          property === "line-height" ||
          (custom && TYPE_TOKEN_NAME.test(property)))
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
        if (literals.length > 0) {
          out.push(finding("A4", sheet.path, line, `${property}: ${value}`, at));
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

function cssConsumers(sheet) {
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

const EXPORTED_COMPONENT =
  /^export (?:default )?(?:function ([A-Z]\w*)|const ([A-Z]\w*)\s*(?::[^=]+)?=\s*(?:memo|forwardRef|React\.memo|function|\(|[a-z_$][\w$]*\s*=>))/gmu;

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
        used: new Set(),
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
    directive.used.add(entry.rule);
    return false;
  });
  for (const directive of directives) {
    if (!directive.reason)
      kept.push(finding("S1", directive.file, directive.line, "say why after `--`"));
    const unused = directive.rules.filter((rule) => !directive.used.has(rule));
    if (unused.length > 0)
      kept.push(
        finding(
          "S2",
          directive.file,
          directive.line,
          `nothing to suppress for ${unused.join(", ")}`,
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
      (allowed.name === undefined
        ? (entry.selector ?? entry.component ?? "").includes(allowed.match)
        : entry.component === allowed.name),
  );

export function collectFindings(root = REPO_ROOT) {
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
  const findings = [
    ...checked.flatMap((sheet) => checkStylesheet(sheet, slots)),
    ...checkDuplicatedThemeBlocks(checked),
    ...checkThemeContract([...checked.flatMap(cssConsumers), ...tsxConsumers], definitions),
    ...checkDeadForkAttributes(checked, sourceText),
    ...checkStories(root),
  ];
  return applySuppressions(findings, checked).filter((entry) => !allowlisted(entry));
}

/** Glass 3D is best effort: a finding only it can see is reported, never blocking. */
export function isBlocking(entry) {
  if (entry.rule === "C3") return entry.enforced;
  if (!entry.themes || entry.themes.length === 0) return true;
  return entry.themes.some((id) => THEMES.find((theme) => theme.id === id)?.enforced);
}

function main() {
  if (process.argv.slice(2).join(" ") !== "--check") {
    console.error("usage: node .fork/design-lint.mjs --check");
    process.exit(2);
  }
  const findings = collectFindings(REPO_ROOT);
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
