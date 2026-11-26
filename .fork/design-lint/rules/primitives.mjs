/** C1 and C2: theme CSS leaves a components/ui primitive's geometry and paint alone. */

import { stripFunctions, subjectCompound } from "../css.mjs";
import { finding, isTestFile, read, REPO_ROOT, walk, WEB_SRC } from "../sources.mjs";

const GEOMETRY_PROPERTY =
  /^(?:(?:min-|max-)?(?:width|height|block-size|inline-size)|padding(?:-[\w-]+)?|border(?:-[\w-]+)?-radius|font-size)$/u;

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

/** What C1 and C2 need to know about a rule: does it style a primitive, or its ::before/::after? */
export function primitiveTarget(rule, slots) {
  const selectors = rule.selectors ?? [];
  return {
    primitive: !rule.keyframes && selectors.some((selector) => stylesPrimitive(selector, slots)),
    pseudo: selectors.some(
      (selector) =>
        stylesPrimitive(selector, slots) &&
        /::(?:before|after)\b/u.test(subjectCompound(selector).replace(/\[[^\]]*\]/gu, "")),
    ),
  };
}

export function primitiveFindings(sheet, rule, declaration, at, { primitive, pseudo }) {
  if (!primitive) return [];
  const out = [];
  const { property, value, line } = declaration;
  const subject = subjectCompound(rule.selectors[0]);
  if (GEOMETRY_PROPERTY.test(property)) {
    out.push(finding("C1", sheet.path, line, `${property} on ${subject}`, at));
  }
  const none = /^(?:none|0|0px)$/u.test(value);
  const cancels =
    (pseudo &&
      ((property === "display" && value === "none") ||
        (property === "content" && value === "none"))) ||
    (/^border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$/u.test(property) &&
      none) ||
    (property === "border-width" && none) ||
    (/^(?:-webkit-)?mask(?:-image)?$/u.test(property) && value === "none") ||
    (/^(?:box-shadow|background-image|backdrop-filter|-webkit-backdrop-filter)$/u.test(property) &&
      value === "none");
  if (cancels) out.push(finding("C2", sheet.path, line, `${property}: ${value} on ${subject}`, at));
  return out;
}
