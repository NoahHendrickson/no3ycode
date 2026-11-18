import type { InstanceHandle } from "figma";

// Helpers the templates share; the Code Connect CLI bundles relative imports into each template.

/** Button's variants; the default is left out, so it emits no prop. */
export const BUTTON_VARIANTS = {
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  "ghost-muted": "ghost-muted",
  "ghost-destructive": "ghost-destructive",
  destructive: "destructive",
  "destructive-outline": "destructive-outline",
  "warning-outline": "warning-outline",
  link: "link",
} as const;

/** The swapped glyph's own snippet (icons.figma.batch.ts), or null when nothing is swapped in. */
export function glyph(instance: InstanceHandle, prop: string) {
  const swapped = instance.getInstanceSwap(prop);
  return swapped && swapped.type === "INSTANCE" ? swapped.executeTemplate() : null;
}

/** Editable text as JSX children: literal when safe, else a JS string expression. */
export const jsxText = (value: string) =>
  /[{}<>&]/u.test(value) ? `{${JSON.stringify(value)}}` : value;

/** Editable text as a JSX attribute value: quoted when safe, else a JS string expression. */
export const jsxAttr = (value: string) =>
  /["{}&]/u.test(value) ? `{${JSON.stringify(value)}}` : `"${value}"`;
