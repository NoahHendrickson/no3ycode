import type { InstanceHandle, ResultSection } from "figma";

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

/** Joins JSX attribute fragments, dropping the ones a template left out. */
export const attrs = (...parts: ReadonlyArray<string | false | null | undefined>) =>
  parts.filter(Boolean).join("");

/** A label as a value prop: lowercase, words joined by dashes. */
export const slug = (label: string, fallback = "item") =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "") || fallback;

type Rendered = ReturnType<InstanceHandle["executeTemplate"]>;

/** The connected instances under `instance` (optionally one template id), each run through its own template. */
export function connected(instance: InstanceHandle, id?: string): Rendered[] {
  return instance
    .findConnectedInstances((child) => id === undefined || child.codeConnectId() === id)
    .flatMap((child) => (child.type === "INSTANCE" ? [child.executeTemplate()] : []));
}

/** A child's snippet re-indented to sit `pad` deep inside a parent's JSX. */
export const indent = (sections: ResultSection[], pad: string): ResultSection[] =>
  sections.map((section) =>
    section.type === "CODE"
      ? { ...section, code: section.code.split("\n").join(`\n${pad}`) }
      : section,
  );

/** Snippets one per line, `pad` deep; the parent's template supplies the first line's indent. */
export const stack = (children: Rendered[], pad = "  "): ResultSection[] =>
  children.flatMap((child, index) => [
    ...(index === 0 ? [] : [{ type: "CODE" as const, code: `\n${pad}` }]),
    ...indent(child.example, pad),
  ]);

/** Imports as one line per module, with the names each child asked for merged. */
export function mergeImports(lines: ReadonlyArray<string>): string[] {
  const names = new Map<string, Set<string>>();
  const other: string[] = [];
  for (const line of lines) {
    const match = /^import \{ ([^}]+) \} from "([^"]+)";$/u.exec(line);
    if (!match) {
      if (!other.includes(line)) other.push(line);
      continue;
    }
    const set = names.get(match[2]!) ?? new Set<string>();
    for (const name of match[1]!.split(",")) set.add(name.trim());
    names.set(match[2]!, set);
  }
  return [
    ...[...names].map(([from, set]) => `import { ${[...set].sort().join(", ")} } from "${from}";`),
    ...other,
  ];
}

/** A parent's own imports plus the ones its children carry in metadata (Figma drops imports
    nested two levels deep), merged per module. */
export const nestedImports = (children: Rendered[], own: ReadonlyArray<string> = []) =>
  mergeImports([
    ...own,
    ...children.flatMap(
      (child) => (child.metadata?.props?.["imports"] as string[] | undefined) ?? [],
    ),
  ]);

/** The swapped glyph's snippet and the import a parent must collect for it, or null. */
export function glyphWithImports(instance: InstanceHandle, prop: string) {
  const icon = glyph(instance, prop);
  return icon
    ? {
        example: icon.example,
        imports: (icon.metadata?.props?.["imports"] as string[] | undefined) ?? [],
      }
    : null;
}

/** A plain code section, for templates that assemble their snippet line by line. */
export const code = (text: string): ResultSection => ({ type: "CODE", code: text });

/** A nested instance's own snippet, or nothing when the layer is missing or unconnected. */
export function layer(instance: InstanceHandle, name: string) {
  const found = instance.findInstance(name);
  return found.type === "INSTANCE" && found.hasCodeConnect() ? found.executeTemplate() : null;
}
