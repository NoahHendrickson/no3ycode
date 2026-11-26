#!/usr/bin/env node
/**
 * Fork design-system lint: the CSS and cross-file rules of .fork/DESIGN-RULES.md, the ones
 * oxlint cannot see (`vp lint` carries the TSX rules). `--check` fails on any finding;
 * `--figma-checked <story files…>` records the Figma kit as checked against them (B6).
 */

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { loadStylesheet } from "./design-lint/css.mjs";
import { checkDeadForkAttributes } from "./design-lint/rules/attributes.mjs";
import { checkFigma, stampFigma } from "./design-lint/rules/figma.mjs";
import {
  buildTokenIndex,
  checkThemeContract,
  cssConsumers,
  runtimeTokens,
  tailwindTheme,
  tsxReferences,
} from "./design-lint/rules/contract.mjs";
import { primitiveSlots } from "./design-lint/rules/primitives.mjs";
import { checkDuplicatedThemeBlocks } from "./design-lint/rules/restated.mjs";
import { checkStories } from "./design-lint/rules/stories.mjs";
import { checkStylesheet } from "./design-lint/rules/values.mjs";
import {
  FENCED_CSS_FILES,
  forkCssFiles,
  forkTsxFiles,
  isTestFile,
  read,
  REPO_ROOT,
  walk,
  WEB_SRC,
} from "./design-lint/sources.mjs";
import { isBlocking, THEMES } from "./design-lint/themes.mjs";
import { allowlisted, applySuppressions } from "./design-lint/suppressions.mjs";

// What forkDesignLint.test.ts drives directly.
export { loadStylesheet } from "./design-lint/css.mjs";
export { checkDeadForkAttributes } from "./design-lint/rules/attributes.mjs";
export { buildTokenIndex, checkThemeContract } from "./design-lint/rules/contract.mjs";
export { checkFigmaStamps, storyHash } from "./design-lint/rules/figma.mjs";
export { checkDuplicatedThemeBlocks } from "./design-lint/rules/restated.mjs";
export { exportedComponents, storyImports } from "./design-lint/rules/stories.mjs";
export { checkStylesheet } from "./design-lint/rules/values.mjs";
export { isBlocking, themesFor } from "./design-lint/themes.mjs";
export { applySuppressions } from "./design-lint/suppressions.mjs";

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
    ...checkFigma(root),
  ];
  return applySuppressions(findings, checked).filter((entry) => !allowlisted(entry));
}

function main() {
  const [mode, ...paths] = process.argv.slice(2);
  if (mode === "--figma-checked" && paths.length > 0) {
    console.log(
      `design-lint: stamped ${stampFigma(REPO_ROOT, paths)} story file(s) as checked against Figma.`,
    );
    return;
  }
  if (mode !== "--check" || paths.length > 0) {
    console.error("usage: node .fork/design-lint.mjs --check | --figma-checked <story files…>");
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
