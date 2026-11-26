/** The repository files design-lint reads, and the finding shape every rule reports. */

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

export const REPO_ROOT = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../..",
);
export const WEB_SRC = "apps/web/src";
export const STORIES = "apps/fork-storybook/stories";

export const read = (root, relative) => NodeFS.readFileSync(NodePath.join(root, relative), "utf8");

export function walk(root, relativeDir, keep) {
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

/** Storybook sources: stories, docs pages and the fixtures they share (B5 reads them all). */
export const storybookSources = (root) =>
  walk(root, STORIES, (path) => /\.(?:tsx?|mdx)$/u.test(path));

/** The story files themselves (B6 stamps each one). */
export const storyFiles = (root) => walk(root, STORIES, (path) => /\.stories\.tsx?$/u.test(path));

export const isTestFile = (path) =>
  /\.(?:test|spec|bench)\.[cm]?[jt]sx?$|\/__fork_guards__\//u.test(path);

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

export const forkTsxFiles = (root, dirs) =>
  dirs.flatMap((dir) =>
    walk(root, `${WEB_SRC}/${dir}`, (path) => /\.tsx?$/u.test(path) && !isTestFile(path)),
  );

export function finding(rule, file, line, message, extra = {}) {
  return { rule, file, line, message, ...extra };
}
