/** B5: every exported atomic component in custom/ has a Storybook story. */

import * as NodePath from "node:path";

import { finding, isTestFile, read, walk, WEB_SRC } from "../sources.mjs";

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
export function checkStories(root) {
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
