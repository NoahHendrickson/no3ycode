/** B6: a story that changes gets its Figma kit component checked, recorded in figma-kit.json. */

import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { finding, read, walk } from "../sources.mjs";

export const FIGMA_STAMPS = ".fork/figma-kit.json";
const STORIES = "apps/fork-storybook/stories";

export const storyHash = (text) =>
  NodeCrypto.createHash("sha256").update(text).digest("hex").slice(0, 16);

const storyFiles = (root) => walk(root, STORIES, (path) => /\.stories\.tsx?$/u.test(path));

function readStamps(root) {
  const path = NodePath.join(root, FIGMA_STAMPS);
  return NodeFS.existsSync(path) ? JSON.parse(NodeFS.readFileSync(path, "utf8")) : {};
}

const fix = (path) =>
  `check its Figma kit component (.fork/AGENTS.md › Figma kit ↔ code), then run \`node .fork/design-lint.mjs --figma-checked ${path}\``;

/** `stamps` maps each story path to its hash when the kit was last checked against it. */
export function checkFigmaStamps(stories, stamps) {
  const out = [];
  for (const [path, text] of stories) {
    const stamp = stamps[path];
    if (stamp === storyHash(text)) continue;
    const what = stamp === undefined ? "new story" : "story changed since the kit was checked";
    out.push(finding("B6", path, 1, `${what}: ${fix(path)}`));
  }
  for (const path of Object.keys(stamps)) {
    if (!stories.has(path))
      out.push(finding("B6", FIGMA_STAMPS, 1, `stamp for a deleted story: ${fix(path)}`));
  }
  return out;
}

export const checkFigma = (root) =>
  checkFigmaStamps(
    new Map(storyFiles(root).map((path) => [path, read(root, path)])),
    readStamps(root),
  );

/** Records the kit as checked against these stories; a deleted story's stamp is dropped. */
export function stampFigma(root, paths) {
  const stamps = readStamps(root);
  for (const path of paths) {
    const relative = NodePath.relative(root, NodePath.resolve(path)).split(NodePath.sep).join("/");
    const absolute = NodePath.join(root, relative);
    if (NodeFS.existsSync(absolute)) stamps[relative] = storyHash(read(root, relative));
    else delete stamps[relative];
  }
  const sorted = Object.fromEntries(Object.entries(stamps).sort(([a], [b]) => a.localeCompare(b)));
  NodeFS.writeFileSync(NodePath.join(root, FIGMA_STAMPS), `${JSON.stringify(sorted, null, 2)}\n`);
  return paths.length;
}
