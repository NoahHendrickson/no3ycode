/**
 * The CSS reader design-lint and the fork guards (`__fork_guards__/cssRules.ts`) share. Not
 * lightningcss: it keeps no line per declaration (findings and suppressions point at one),
 * drops comments, and rewrites values (`white` reads back as `#fff`).
 */

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

/** Nested selectors written out against their parents, one complex selector per pair. */
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

/** Comments as spaces, so every offset still lines up with the original text. */
function blankComments(text) {
  const comments = [];
  let blanked = "";
  let from = 0;
  let quote = null;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === "\\") index++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2);
      const stop = end === -1 ? text.length : end + 2;
      comments.push({ start: index, text: text.slice(index + 2, end === -1 ? stop : end), stop });
      blanked += text.slice(from, index) + " ".repeat(stop - index);
      from = stop;
      index = stop - 1;
    }
  }
  return { blanked: blanked + text.slice(from), comments };
}

/**
 * Every block (style rule or at-rule) in the order they close; css.d.mts has the shape. An
 * at-rule nested in a style rule carries its host's selectors: it styles the same elements.
 * `header` blanks comments to spaces (cssRules.ts reads it); `prelude` drops them.
 */
export function readCss(text) {
  const { blanked, comments } = blankComments(text);
  const lineStarts = [0];
  for (let index = 0; index < text.length; index++)
    if (text[index] === "\n") lineStarts.push(index + 1);
  const lineAt = (offset) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (lineStarts[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };
  // Declarations and preludes read without their comments, as the browser does.
  const withoutComments = (start, end) => {
    let out = "";
    let from = start;
    for (const comment of comments) {
      if (comment.stop <= start || comment.start >= end) continue;
      out += text.slice(from, Math.max(from, comment.start));
      from = Math.min(end, comment.stop);
    }
    return out + text.slice(from, end);
  };
  const firstLine = (start, end) => {
    const offset = blanked.slice(start, end).search(/\S/u);
    return lineAt(offset === -1 ? start : start + offset);
  };

  const blocks = [];
  const stack = [];
  let start = 0;

  const statement = (end) => {
    const raw = withoutComments(start, end).trim();
    const frame = stack.at(-1);
    if (!raw || raw.startsWith("@") || !frame) return;
    const colon = raw.indexOf(":");
    if (colon <= 0) return;
    const rawProperty = raw.slice(0, colon).trim();
    frame.declarations.push({
      property: rawProperty.startsWith("--") ? rawProperty : rawProperty.toLowerCase(),
      value: raw
        .slice(colon + 1)
        .replace(/!important\s*$/iu, "")
        .trim(),
      line: firstLine(start, end),
    });
  };

  const open = (offset) => {
    const header = blanked.slice(start, offset).trim();
    const prelude = withoutComments(start, offset).trim().replace(/\s+/gu, " ");
    const atFrames = stack.filter((frame) => frame.kind === "at");
    const keyframes = atFrames.some((frame) => /^@(?:-\w+-)?keyframes\b/u.test(frame.prelude));
    const top = stack.at(-1);
    if (top) top.children++;
    const frame = {
      header,
      prelude,
      line: firstLine(start, offset),
      open: offset,
      atRules: atFrames.map((frame) => frame.prelude),
      atHeaders: atFrames.map((frame) => frame.header),
      parents: stack.filter((frame) => frame.kind === "style").map((frame) => frame.header),
      declarations: [],
      children: 0,
    };
    if (prelude.startsWith("@")) {
      const host = top?.selectors ? top : null;
      stack.push({
        ...frame,
        kind: "at",
        name: /^@([\w-]+)/u.exec(prelude)?.[1] ?? "",
        ...(host && !host.keyframes ? { selectors: host.selectors } : {}),
      });
      return;
    }
    const parent = stack.findLast((candidate) => candidate.kind === "style");
    stack.push({
      ...frame,
      kind: "style",
      selectors: keyframes
        ? [prelude]
        : resolveNesting(
            splitTopLevel(prelude, ","),
            parent?.keyframes ? undefined : parent?.selectors,
          ),
      keyframes,
    });
  };

  const close = (offset) => {
    statement(offset);
    const frame = stack.pop();
    if (frame) blocks.push({ ...frame, close: offset, endLine: lineAt(offset) });
  };

  let depth = 0;
  for (let index = 0; index < blanked.length; index++) {
    const char = blanked[index];
    if (char === '"' || char === "'") {
      let end = index + 1;
      while (end < blanked.length && blanked[end] !== char) end += blanked[end] === "\\" ? 2 : 1;
      index = end;
      continue;
    }
    if (char === "(") depth++;
    else if (char === ")") depth = Math.max(0, depth - 1);
    if (depth !== 0 || (char !== "{" && char !== ";" && char !== "}")) continue;
    if (char === "{") open(index);
    else if (char === ";") statement(index);
    else close(index);
    start = index + 1;
  }

  return {
    blocks,
    comments: comments.map((comment) => ({
      text: comment.text,
      line: lineAt(comment.start),
      endLine: lineAt(comment.stop - 1),
    })),
    body: (block) => blanked.slice(block.open + 1, block.close),
  };
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
export function simpleSelectors(compound) {
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

/** The last compound: the element a selector styles. */
export const subjectCompound = (selector) => compounds(selector).at(-1) ?? "";

/** A compound without the given functional pseudo-classes and what they hold. */
export function stripFunctions(compound, functions) {
  let out = compound;
  for (const fn of functions)
    for (let index = out.indexOf(fn); index !== -1; index = out.indexOf(fn)) {
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

/**
 * A sheet as the rules read it. `rules` are its style rules plus the at-rules that hold
 * declarations of their own (@theme, @property, @font-face, a nested @media); `owns(line)`
 * says whether a line is fork code (inside a fork fence, when `fenced`).
 */
export function loadStylesheet(path, text, { fenced = false } = {}) {
  const { blocks, comments } = readCss(text);
  const rules = blocks
    .filter((block) => block.kind === "style" || block.declarations.length > 0)
    .map(({ kind, name, prelude, selectors, declarations, line, endLine, atRules, keyframes }) => ({
      kind,
      ...(kind === "at" ? { name, prelude } : {}),
      ...(selectors ? { selectors } : {}),
      declarations,
      line,
      endLine,
      atRules,
      ...(kind === "style" ? { keyframes } : {}),
    }));
  const ranges = fenced ? fenceRanges(text) : null;
  const owns = (line) =>
    ranges === null || ranges.some(([start, end]) => line >= start && line <= end);
  return { path, text, rules, comments, owns };
}
